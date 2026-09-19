-- corex-admin · bans (oxmysql)
-- Owns the `corex_bans` table: list/create/lift/extend, plus the connect filter
-- that drops players whose identifier has an active ban.

local DURATION_SECONDS = Config.BanDurations or {}

local coreEpoch = 0
AddEventHandler('onResourceStop', function(resource)
    if resource == 'corex-core' then coreEpoch = coreEpoch + 1 end
end)

local function captureSession(src)
    local ok, session = pcall(function()
        local player = exports['corex-core']:GetPlayer(src)
        if not player or type(player.identifier) ~= 'string' or player.identifier == '' then return nil end
        for _, presence in ipairs(exports['corex-core']:GetPlayerPresence(player.identifier)) do
            if presence.source == src and type(presence.sessionToken) == 'string' and presence.sessionToken ~= '' then
                return {identifier=player.identifier, token=presence.sessionToken, epoch=coreEpoch}
            end
        end
    end)
    return ok and session or nil
end

local function sameSession(src, expected)
    if not expected or expected.epoch ~= coreEpoch then return false end
    local current = captureSession(src)
    return current and current.identifier == expected.identifier and current.token == expected.token
end

local function positiveInteger(value)
    return type(value) == 'number' and value > 0 and value < math.huge and value % 1 == 0
end

local function isoDate(epoch)
    epoch = tonumber(epoch)
    if not positiveInteger(epoch) then return nil end
    return os.date('!%Y-%m-%dT%H:%M:%SZ', epoch)
end

-- Auto-create the table on resource start so first-time installers don't need to
-- copy/paste SQL. Idempotent.
CreateThread(function()
    if GetResourceState('oxmysql') ~= 'started' then
        print('^1[corex-admin]^7 oxmysql is not started — bans will not work.')
        return
    end
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `corex_bans` (
            `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `identifier`    VARCHAR(60)  NOT NULL,
            `player_name`   VARCHAR(64)  NOT NULL,
            `reason`        TEXT         NOT NULL,
            `duration`      VARCHAR(16)  NOT NULL DEFAULT 'perma',
            `banned_by`     VARCHAR(64)  NOT NULL,
            `banned_by_id`  VARCHAR(60)  NULL,
            `banned_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `expires_at`    TIMESTAMP    NULL,
            `status`        ENUM('active','expired','lifted') NOT NULL DEFAULT 'active',
            `lifted_at`     TIMESTAMP    NULL,
            `lifted_by`     VARCHAR(64)  NULL,
            PRIMARY KEY (`id`),
            KEY `idx_identifier` (`identifier`),
            KEY `idx_status`     (`status`),
            KEY `idx_expires`    (`expires_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end)

---List bans, newest first. Filter is 'active'|'expired'|'lifted'|'all'.
function BansList(filter)
    filter = filter or 'active'
    if filter ~= 'all' and filter ~= 'active' and filter ~= 'expired' and filter ~= 'lifted' then
        return nil, 'bad_filter'
    end
    local where = filter == 'all' and '' or 'WHERE status = ?'
    local args  = filter == 'all' and {}  or { filter }
    -- Effective expiry is computed before filtering. A read never races a lift
    -- by writing an old status back, and never issues one query per row.
    local queried, rows = pcall(MySQL.query.await, ([[
        SELECT * FROM (
            SELECT id, identifier, player_name, reason, duration, banned_by,
                UNIX_TIMESTAMP(banned_at) AS banned_epoch,
                UNIX_TIMESTAMP(expires_at) AS expires_epoch,
                CASE WHEN status = 'active' AND expires_at <= CURRENT_TIMESTAMP
                    THEN 'expired' ELSE status END AS status
            FROM corex_bans
        ) AS effective_bans %s ORDER BY banned_epoch DESC, id DESC LIMIT 250
    ]]):format(where), args)
    if not queried or type(rows) ~= 'table' then return nil, 'bans_unavailable' end
    local result = {}
    for _, row in ipairs(rows) do
        result[#result + 1] = {
            id=tostring(row.id), identifier=row.identifier, player=row.player_name,
            reason=row.reason, duration=row.duration, by=row.banned_by,
            at=isoDate(row.banned_epoch), expiresAt=isoDate(row.expires_epoch), status=row.status,
        }
    end
    return result
end

---Create a ban + kick the player if online. Returns the new row id.
function BansCreate(actorSrc, targetSrc, duration, reason)
    if not IsAdmin(actorSrc) then return nil, 'permission_denied' end
    targetSrc = tonumber(targetSrc)
    if not positiveInteger(targetSrc) then return nil, 'bad_target' end
    duration = duration or 'perma'
    local seconds = DURATION_SECONDS[duration]
    if seconds ~= -1 and not positiveInteger(seconds) then return nil, 'bad_duration' end
    if reason ~= nil and type(reason) ~= 'string' then return nil, 'bad_reason' end
    local actorSession, targetSession = captureSession(actorSrc), captureSession(targetSrc)
    if not actorSession or not targetSession then return nil, 'session_unavailable' end

    local player = exports['corex-core']:GetPlayer(targetSrc)
    if not player then return nil, 'target_offline' end
    -- corex-core player object is flat (no PlayerData wrapper)
    local pName = player.name or GetPlayerName(targetSrc) or '?'
    local pIdent = targetSession.identifier
    local actorName, actorIdent = GetActor(actorSrc)

    -- Evidence can yield; collect it before submitting the irreversible write.
    local shot
    if Config.LogToDiscord and Config.DiscordWebhook ~= '' and Config.CaptureEvidenceScreenshots then
        shot = CaptureScreenshotBytes(targetSrc)
    end
    if not IsAdmin(actorSrc) then return nil, 'permission_denied' end
    if not sameSession(actorSrc, actorSession) or not sameSession(targetSrc, targetSession) then
        return nil, 'session_changed'
    end

    local inserted, id = pcall(MySQL.insert.await, [[
        INSERT INTO corex_bans (identifier, player_name, reason, duration, banned_by, banned_by_id, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = -1 THEN NULL ELSE TIMESTAMPADD(SECOND, ?, CURRENT_TIMESTAMP) END)
    ]], {
        pIdent,
        pName,
        reason or 'no reason',
        duration or 'perma',
        actorName,
        actorIdent,
        seconds,
        seconds,
    })

    if not inserted or not positiveInteger(id) then
        -- An absent reply is not proof that SQL rolled back. Do not retry or
        -- claim a ban/kick succeeded; the operator must inspect the ban list.
        return nil, 'ban_save_unconfirmed_check_ban_list'
    end

    -- The saved identity remains banned if either party disconnected during
    -- SQL. A recycled source must never receive the previous session's kick.
    if IsAdmin(actorSrc) and sameSession(actorSrc, actorSession) and sameSession(targetSrc, targetSession) then
        DropPlayer(targetSrc, ('[BANNED] %s — %s'):format(duration, reason or 'no reason'))
    end
    print(('^3[corex-admin]^7 banned %s (%s) duration=%s by %s'):format(
        pName, pIdent, duration or 'perma', actorName))

    if Config.LogToDiscord and Config.DiscordWebhook ~= '' then
        PostActionToDiscord(
            'ban',
            ('%s (#%d)'):format(actorName, actorSrc),
            ('%s (#%d)'):format(pName, targetSrc),
            { duration = duration, reason = reason, identifier = pIdent },
            true,
            shot
        )
    end
    return id
end

---Lift an active ban by id. Returns true on success.
function BansLift(actorSrc, banId)
    if not IsAdmin(actorSrc) then return false, 'permission_denied' end
    banId = tonumber(banId); if not positiveInteger(banId) then return false, 'bad_id' end
    local actorName = GetActor(actorSrc)
    local updated, affected = pcall(MySQL.update.await, [[
        UPDATE corex_bans
        SET status = 'lifted', lifted_at = CURRENT_TIMESTAMP, lifted_by = ?
        WHERE id = ? AND status = 'active'
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ]], { actorName, banId })
    if not updated or type(affected) ~= 'number' then return false, 'ban_update_unconfirmed_refresh_before_retry' end
    if affected ~= 1 then return false, 'ban_not_active' end
    return true
end

---Extend an active ban by N seconds. Returns true on success.
function BansExtend(actorSrc, banId, addSeconds)
    if not IsAdmin(actorSrc) then return false, 'permission_denied' end
    banId = tonumber(banId); addSeconds = tonumber(addSeconds)
    if not positiveInteger(banId) or not positiveInteger(addSeconds) or addSeconds > 2147483647 then
        return false, 'bad_args'
    end
    -- One atomic relative write: no lost increments or permanent-to-timed
    -- downgrade, and a concurrent lift cannot be overwritten.
    local updated, affected = pcall(MySQL.update.await, [[
        UPDATE corex_bans SET expires_at = TIMESTAMPADD(SECOND, ?, expires_at)
        WHERE id = ? AND status = 'active' AND expires_at > CURRENT_TIMESTAMP
    ]], { addSeconds, banId })
    if not updated or type(affected) ~= 'number' then return false, 'ban_update_unconfirmed_refresh_before_retry' end
    if affected ~= 1 then return false, 'ban_not_active_or_permanent' end
    return true
end

-- ---------- Connect filter: block banned identifiers ----------------------

AddEventHandler('playerConnecting', function(_, setKickReason, deferrals)
    deferrals.defer()
    local src = source
    Wait(0)
    local idents = GetPlayerIdentifiers(src) or {}
    local license
    for _, id in ipairs(idents) do
        if id:sub(1, 8) == 'license:' then license = id break end
    end
    if not license then
        deferrals.done()
        return
    end

    local queried, row = pcall(MySQL.single.await, [[
        SELECT id, reason, duration, UNIX_TIMESTAMP(expires_at) AS expires_epoch
        FROM corex_bans
        WHERE identifier = ? AND status = 'active'
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        ORDER BY banned_at DESC, id DESC LIMIT 1
    ]], { license })

    if not queried then
        deferrals.done('COREX could not verify access. Please try again later or contact the server owner.')
        return
    end

    if not row then
        deferrals.done()
        return
    end

    local expires = isoDate(row.expires_epoch)
    local msg = ('[BANNED] %s — %s%s'):format(
        row.duration,
        row.reason,
        expires and (' — expires ' .. expires) or ''
    )
    setKickReason(msg)
    deferrals.done(msg)
end)
