fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'corex-admin'
description 'COREX Framework — Admin Panel (NUI)'
author 'ABUGIZA'
version '1.0.0'
repository 'https://github.com/corex-zombies/corex-admin'

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/inventory_bridge.lua',
    'server/permissions.lua',
    'server/screenshots.lua',
    'server/mugshots.lua',
    'server/sessions.lua',
    'server/world.lua',
    'server/actions_log.lua',
    'server/api.lua',
    'server/actions.lua',
    'server/bans.lua',
    'server/reports.lua',
    'server/main.lua',
}

client_scripts {
    'client/main.lua',
    'client/nui.lua',
    'client/mugshots.lua',
    'client/actions.lua',
    'client/location_report.lua',
}

ui_page 'web/index.html'

files {
    'web/index.html',
    'web/assets/*',
}

dependencies {
    'corex-core',
    'oxmysql',
    'ox_lib',
}
-- Optional (script detects at runtime and silently no-ops if absent):
--   MugShotBase64      — player face thumbnails in the panel
--   screenshot-basic   — proof screenshots attached to Discord log
