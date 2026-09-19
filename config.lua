-- corex-admin · config
-- Everything a server owner tunes lives here. Logic stays in /server and /client.

Config = {}

-----------------------------------------------------------------------
-- ACCESS CONTROL
-----------------------------------------------------------------------
-- A player can open the panel if EITHER of these passes:
--   1. ACE permission match (recommended for txAdmin / FXServer admins)
--   2. CoreX metadata flag (corex-core SetMetaData(src, 'isStaff', true))
--
-- ACE permissions are configured in `server.cfg` with:
--     add_ace group.admin     command.admin allow
--     add_ace group.mod       command.admin allow
--     add_principal identifier.license:abcd1234 group.admin
--
-- Set Config.AllowedAces to the list of aces this panel checks.

Config.UseAcePermissions = true
Config.AllowedAces = {
    'command.admin',         -- catch-all admin command
    'corex.admin',           -- our own ace, recommended
}

Config.UseCorexMetadataFlag = true
Config.StaffMetadataKey = 'isStaff'   -- exact true, 1 or '1' = allowed

-----------------------------------------------------------------------
-- TRIGGERS
-----------------------------------------------------------------------
-- Command that opens the panel. Lowercase; FiveM is case-sensitive.
Config.Command = 'admin'

-----------------------------------------------------------------------
-- BRANDING — shown in the panel's top-left sidebar header
-----------------------------------------------------------------------
-- The server's display name and a square-ish logo. Logo can be:
--   • an https URL                      (loaded directly by the CEF NUI)
--   • a path inside this resource       (e.g. 'web/logo.png' + listed in `files`)
--   • a 2-letter monogram               (set Logo = '' to render the CX badge)
-- Tagline is the small caption underneath — keep it short (≤24 chars).
Config.Branding = {
    ServerName = 'CoreX Admin',  -- e.g. 'My Awesome Server'
    Tagline    = 'zombie',
    Logo       = '',           -- e.g. 'https://example.com/logo.png'
    Monogram   = 'CX',          -- fallback when Logo is empty
}

-----------------------------------------------------------------------
-- DATA
-----------------------------------------------------------------------
-- Maximum players returned in a single api/players call. 64 covers any
-- normal FiveM server. Increase only if your `sv_maxclients` is higher.
Config.MaxPlayersPerFetch = 64

-- Default ban duration choices (label -> seconds). 'perma' means no expires_at.
Config.BanDurations = {
    ['1h']  = 3600,
    ['24h'] = 86400,
    ['7d']  = 604800,
    ['30d'] = 2592000,
    ['perma'] = -1,
}

-- Money payout caps per single admin action — prevents typos from wrecking economy
Config.MaxGiveMoney = 1000000

-- Item give cap per single action
Config.MaxGiveItemCount = 20

-----------------------------------------------------------------------
-- LOGGING
-----------------------------------------------------------------------
-- Every admin action is printed to console + (optionally) posted to a Discord
-- webhook. Leave webhook empty to disable Discord logging.
Config.LogToConsole = true
Config.LogToDiscord = true
Config.DiscordWebhook = ''            -- https://discord.com/api/webhooks/...
Config.DiscordWebhookName = 'corex-admin'

-----------------------------------------------------------------------
-- EVIDENCE (optional external resources)
-----------------------------------------------------------------------
-- Requires `screenshot-basic` (https://github.com/citizenfx/screenshot-basic).
-- When true, every kick/ban/warn captures a JPEG of the target's screen and
-- attaches it to the Discord log embed. Adds ~2-4s of latency per action.
Config.CaptureEvidenceScreenshots = true

-- Requires `MugShotBase64` (https://github.com/BaziForYou/MugShotBase64).
-- Player face thumbnails replace the placeholder initials in the panel.
-- Mugshots are cached per identifier; first request takes ~1s to render.
Config.UseMugshots = true
