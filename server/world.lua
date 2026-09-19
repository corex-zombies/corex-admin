-- corex-admin · world snapshot aggregator
--
-- The Overview page wants four live numbers: total online players (handled
-- by api.lua), alive zombies, active red zones, and the current weather.
-- This file is the single integration point with the other corex resources
-- so api.lua stays clean.
--
-- All reads are best-effort — if a sibling resource is stopped or missing
-- an export, we return safe zeros rather than crashing the overview.

-- ----- ZOMBIES ------------------------------------------------------------
-- Shared peds are counted once by the server owner. Only that resource can
-- deliver its consumed native lifetime decision; client reports are not kills.
local killedToday        = 0
local lastResetDate      = os.date('%Y-%m-%d')

local function rolloverIfNeeded()
    local today = os.date('%Y-%m-%d')
    if today ~= lastResetDate then
        killedToday = 0
        lastResetDate = today
    end
end

exports('RecordZombieKill', function(src, expected)
    if GetInvokingResource() ~= 'corex-zombies' or type(expected) ~= 'table'
        or expected.source ~= src then return false end
    local checked, current = pcall(function()
        if GetResourceState('corex-core') ~= 'started' then return false end
        local player = exports['corex-core']:GetPlayer(src)
        if not player or player.source ~= src or player.identifier ~= expected.identifier then return false end
        local matched = false
        for _, presence in ipairs(exports['corex-core']:GetPlayerPresence(expected.identifier) or {}) do
            if presence.source == src and presence.sessionToken == expected.sessionToken then matched = true; break end
        end
        return matched and GetResourceState('corex-core') == 'started'
            and GetPlayerPed(src) == expected.ped and expected.ped ~= 0
            and GetPlayerRoutingBucket(src) == expected.bucket
    end)
    if not checked or not current then return false end
    rolloverIfNeeded()
    -- This in-memory daily statistic counts validated deaths. The persistent
    -- per-player statistic has its own acknowledgement and is never retried.
    killedToday = killedToday + 1
    local ok, saved = pcall(function()
        local count = tonumber(exports['corex-core']:GetMetaData(src, 'zombies_killed')) or 0
        if count ~= count or math.abs(count) == math.huge then return false end
        return exports['corex-core']:SetMetaData(src, 'zombies_killed', math.max(0,math.floor(count)) + 1)
    end)
    if not ok or saved ~= true then
        print('[COREX-ADMIN] Zombie lifetime statistic write could not be confirmed; no automatic retry.')
        return false
    end
    return true
end)

-- ----- LOCATION ----------------------------------------------------------
-- `GetStreetNameAtCoord` is a client-only native. The client periodically
-- resolves its own street/zone name and pushes it here; the admin panel
-- reads from this cache when building player summaries. Declared BEFORE
-- the playerDropped handler so its closure binds to this local (Lua's
-- top-down scoping would otherwise capture a nil global).

local playerLocations = {}   -- src → street/zone label

RegisterNetEvent('corex-admin:server:reportLocation', function(label)
    local src = source
    if type(label) ~= 'string' or #label == 0 then return end
    if #label > 64 then label = label:sub(1, 64) end
    playerLocations[src] = label
end)

---Returns the client-reported street/zone label, or nil if none has been
---received yet (e.g. the player just connected).
---@param src number
---@return string|nil
function GetReportedLocation(src)
    return playerLocations[src]
end

AddEventHandler('playerDropped', function()
    local src = source
    playerLocations[src] = nil
end)

-- Never sum client observations: two clients may see the same shared ped.
local function ZombiesAlive()
    if GetResourceState('corex-zombies') ~= 'started' then return 0 end
    local ok,count = pcall(function() return exports['corex-zombies']:GetAliveCount() end)
    if not ok or type(count) ~= 'number' or count ~= count or count < 0 or count > 65535 then return 0 end
    return math.floor(count)
end

-- ----- RED ZONES ----------------------------------------------------------

local function RedZonesSummary()
    if GetResourceState('corex-redzones') ~= 'started' then
        return { activeCount = 0, totalCount = 0, playersInside = 0 }
    end

    local ok, manifest = pcall(exports['corex-redzones'].GetZoneManifest, exports['corex-redzones'])
    if not ok or type(manifest) ~= 'table' then
        return { activeCount = 0, totalCount = 0, playersInside = 0 }
    end

    -- Count players actually inside any red zone by walking the players list
    -- and asking the resource's exported tracker. We don't have a single
    -- "total occupants" export, so this is the cleanest path.
    local inside = 0
    local players = exports['corex-core']:GetPlayers() or {}
    for src in pairs(players) do
        local n = tonumber(src)
        if n and IsPlayerInRedZone(n) then inside = inside + 1 end
    end

    return {
        activeCount   = #manifest,
        totalCount    = #manifest,   -- every config'd zone is "active" in this resource — there's no enable flag
        playersInside = inside,
    }
end

-- corex-redzones doesn't export a per-player tracker, so we reach into it
-- via a tiny helper that re-uses its own coords check. Falls back to false
-- if the resource is missing — never crash the overview.
function IsPlayerInRedZone(src)
    if GetResourceState('corex-redzones') ~= 'started' then return false end
    -- Heuristic: pull the manifest once and test against each zone's coords.
    -- The resource keeps its own tracker but doesn't export it; rather than
    -- patching corex-redzones, we replicate the geometry test here.
    local ok, manifest = pcall(exports['corex-redzones'].GetZoneManifest, exports['corex-redzones'])
    if not ok or type(manifest) ~= 'table' then return false end

    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return false end
    local pc = GetEntityCoords(ped)
    if not pc or pc.x ~= pc.x then return false end

    for _, z in ipairs(manifest) do
        if z.coords and z.radius then
            local dx = pc.x - (z.coords.x or 0)
            local dy = pc.y - (z.coords.y or 0)
            if (dx * dx + dy * dy) <= (z.radius * z.radius) then
                return true, z.name or z.id
            end
        end
    end
    return false
end

-- Return the human-readable name of the red zone the player is currently in,
-- or nil if not in one. Used by the player drawer's "Zone" field.
function GetPlayerRedZoneName(src)
    local inside, name = IsPlayerInRedZone(src)
    if inside then return name end
    return nil
end

-- ----- WEATHER ------------------------------------------------------------

local WEATHER_LABEL = {
    EXTRASUNNY  = 'Clear',     CLEAR       = 'Clear',
    CLOUDS      = 'Cloudy',    SMOG        = 'Smoggy',
    FOGGY       = 'Foggy',     OVERCAST    = 'Overcast',
    RAIN        = 'Rainy',     THUNDER     = 'Thunder',
    CLEARING    = 'Clearing',  NEUTRAL     = 'Clear',
    SNOW        = 'Snow',      BLIZZARD    = 'Blizzard',
    SNOWLIGHT   = 'Light snow', XMAS       = 'Xmas snow',
    HALLOWEEN   = 'Halloween',
}

local function prettyWeather(code)
    if type(code) ~= 'string' then return '—' end
    return WEATHER_LABEL[code:upper()] or code:sub(1, 1) .. code:sub(2):lower()
end

local function WeatherSummary()
    if GetResourceState('corex-weather') ~= 'started' then
        return { current = '—', next = '—', changeIn = '—' }
    end
    local ok, current = pcall(exports['corex-weather'].GetCurrentWeather, exports['corex-weather'])
    if not ok or type(current) ~= 'string' then
        return { current = '—', next = '—', changeIn = '—' }
    end
    return {
        current  = prettyWeather(current),
        -- corex-weather chooses the next pattern at change time, so there's
        -- no deterministic "next" before then. We show — to be honest rather
        -- than guess.
        next     = '—',
        changeIn = '—',
    }
end

-- ----- PUBLIC API --------------------------------------------------------

function ApiGetWorldStats()
    rolloverIfNeeded()
    return {
        zombies = {
            alive       = ZombiesAlive(),
            killedToday = killedToday,
            hordeNext   = '—',
        },
        redzones = RedZonesSummary(),
        weather  = WeatherSummary(),
    }
end
