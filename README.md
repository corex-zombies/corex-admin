# corex-admin

> Modern NUI admin panel for the COREX Framework — players, inventory, bans, reports, server stats, and an in-game report system. Built with React + Tailwind + Lua.

Part of the [COREX Framework](https://github.com/corex-zombies).

## Preview

[![Watch the demo](https://img.youtube.com/vi/voClH32XzMg/hqdefault.jpg)](https://youtu.be/voClH32XzMg)

> Click the thumbnail to watch the panel walkthrough on YouTube.

---

## Features

- **Players** — live list with mugshots, vitals, money, inventory, warnings, bans, playtime, joined date, zone, ping, skill points, and zombie-kill count.
- **Actions** — kick, ban, warn, revive (full heal), teleport to player, **long-range spectate** (auto-warps you into the target's scope from anywhere on the map), give/set money, give/remove items, server-wide announce.
- **Inventory editor** — pulls live items from whichever inventory CoreX has, supports any rarity and category. Add or remove items with optimistic UI.
- **Bans** — DB-backed `corex_bans` table with status (active / expired / lifted), filterable, with extend/lift actions.
- **Reports** — players can file reports via `/report`; admins see them in the panel, mark them resolved or dismissed.
- **Overview** — live player count, alive zombies (from `corex-zombies`), active red zones (from `corex-redzones`), current weather (from `corex-weather`), recent admin actions feed.
- **Discord webhook** — every successful admin action posts a clean embed to Discord, optionally with a screenshot of the target (requires `screenshot-basic`).
- **Mugshots** — player portraits captured via `MugShotBase64` and persisted in `corex-core` metadata.
- **Identity-aware** — the sidebar shows the logged-in admin's real name + portrait, not a hardcoded label.
- **Crash-resistant** — wrapped in a React ErrorBoundary; if the UI ever breaks, you can `/admin-reset` to release NUI focus and reopen cleanly.

---

## Install

Drop the folder into:
```
server-data/resources/[corex]/corex-admin/
```

### Required dependencies

| Resource | Why | Where |
|---|---|---|
| **corex-core** | player object, metadata, money, state | https://github.com/corex-zombies/corex-core |
| **ox_lib** | NUI helpers, callbacks, notifications, keymapping | https://github.com/overextended/ox_lib |
| **oxmysql** | DB queries (bans, reports, action log) | https://github.com/overextended/oxmysql |

### Optional dependencies (the panel detects them at runtime and silently no-ops if absent)

| Resource | Adds |
|---|---|
| **an inventory** | Inventory display and item give/remove. The panel asks CoreX for whichever inventory is installed, so `corex-inventory` is the default rather than a requirement — https://github.com/corex-zombies/corex-inventory |
| **Inventory provider capabilities** | Grid size, catalog and image URLs come through the selected CoreX inventory provider. The shipped UI uses the server-supplied `imageUrl`; if an image is absent or fails, it displays a category icon. Unsupported provider operations remain unavailable; installing this panel does not add those operations to an inventory. |
| **MugShotBase64** | Player face thumbnails — https://github.com/BaziForYou/MugShotBase64 |
| **screenshot-basic** | Attach JPEG of the target to Discord audit logs — https://github.com/citizenfx/screenshot-basic |
| **corex-skills** | "Skill pts" field in player History |
| **corex-zombies** | "Zombies alive" tile + per-player "Zombies killed" stat |
| **corex-redzones** | "Red zones active" tile + zone-aware player location |
| **corex-weather** | Current weather label |
| **corex-zones** | Safe-zone-aware player location |

### Load order

In `server.cfg`:

```cfg
ensure oxmysql
ensure ox_lib
ensure MugShotBase64        # optional
ensure screenshot-basic     # optional
ensure corex-core
ensure corex-inventory      # or any other inventory that registers with CoreX
ensure corex-admin
```

---

## Database

The resource auto-creates three tables on first boot, so **you do not have to run any SQL by hand**:

| Table | Purpose |
|---|---|
| `corex_bans` | Active/expired/lifted bans, used by the connect-time ban filter and the Bans page |
| `corex_reports` | Player-filed reports (`/report` command) |
| `corex_admin_actions` | Audit log feeding the Overview "Recent admin actions" panel |

If you prefer to provision the schema upfront, see [`sql/install.sql`](sql/install.sql).

---

## Permissions

Admin access is granted via **either** path:

### 1. ACE permissions (recommended — works with txAdmin)

In `server.cfg`:
```cfg
add_ace group.admin     corex.admin allow
add_ace group.moderator corex.admin allow
add_principal identifier.license:abcd1234... group.admin
```

The default allowed aces are `command.admin` (catch-all) and `corex.admin`. Edit `Config.AllowedAces` in `config.lua` to add more.

### 2. CoreX metadata flag

Server-side anywhere:
```lua
exports['corex-core']:SetMetaData(src, 'isStaff', true)
```

Useful for in-game promotion flows where you don't want to edit `server.cfg` for every new staff member. The metadata key is `Config.StaffMetadataKey`.

Only exact `true`, `1` or `'1'` grants metadata-based access. Never accept this flag from client-submitted data. Set `Config.UseCorexMetadataFlag = false` if staff access should use ACE alone. A txAdmin login does not automatically add the player's identifier to an in-game ACE group.

---

## Configuration

Open `config.lua` and adjust:

### Branding (top-left logo + server name)

```lua
Config.Branding = {
    ServerName = 'My Awesome Server',
    Tagline    = 'roleplay - zombie',
    Logo       = 'https://example.com/logo.png',
    Monogram   = 'CX',
}
```

### Discord audit log

```lua
Config.LogToDiscord       = true
Config.DiscordWebhook     = 'https://discord.com/api/webhooks/...'
Config.DiscordWebhookName = 'corex-admin'
```

> **Never commit your Discord webhook URL.** Anyone with the URL can post to your channel. Keep it out of public repos.

### Limits

```lua
Config.MaxGiveMoney      = 1000000
Config.MaxGiveItemCount  = 20
Config.MaxPlayersPerFetch = 64
```

---

## Commands

| Command | Description |
|---|---|
| `/admin` | Opens the admin panel (permission-gated) |
| `/report` | Opens the player report form — available to all players |
| `/admin-reset` | Force-releases NUI focus if the panel gets stuck (recovery) |
| `/unspectate` | Stops the active spectate session |

### Keybinds

| Key | Action |
|---|---|
| `Ctrl + K` | Quick action palette (search / navigate / announce) |
| `Esc` | Close any open dialog or the panel |
| `X` | Stop spectating (configurable in FiveM Settings) |

---

## Spectate — long-range mode

GTA streams player peds only within ~424 m. Naive spectate of a far target fails with "target not in scope". corex-admin works around this by:

1. Server resolves the target coords from their ped.
2. Client teleports the admin (invisible + frozen + no-collision) to those coords.
3. Waits for collision streaming, then for the target ped to appear in scope (up to 4 s).
4. Enables `NetworkSetInSpectatorMode` on the now-visible target.
5. On stop, restores the admin's original coords + visibility.

A small overlay shows while spectating with a `[X] Stop` hint.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Panel won't open after a crash | Run `/admin-reset` then `/admin` |
| Discord webhook returns 400 | Check the webhook URL is current; the resource auto-retries without screenshot |
| Screenshots missing in Discord | Verify `screenshot-basic` is started and `Config.CaptureEvidenceScreenshots = true` |
| Item images don't load | Check the selected provider's catalog `imageUrl`, that its asset resource is started, and that the path exists. The shipped UI uses that URL and falls back to an icon on failure; it does not invent a native-inventory URL for another provider. |
| Zone shows `Open world` | The client reports its location every 5 s after spawn; wait one cycle or move once |

---

## License

MIT — see [LICENSE](LICENSE).

## Editing the panel UI

Server owners run the included `web/` build; no JavaScript development tools are needed to operate the panel. Developers need Node.js and [Bun](https://bun.com/docs/installation). Keep the complete `ui-src/` source and its `bun.lock`, which records the dependency versions.

From the resource directory:

```sh
cd ui-src
bun install --frozen-lockfile
bun run build
```

The frozen installation preserves the versions recorded in `bun.lock`. The build type-checks the source and rebuilds `../web/`; keep the generated HTML and matching hashed assets together. Do not publish `node_modules/`, compiler caches, local preview logs or temporary audit builds. Browser preview/mock data is development-only and does not prove connected FiveM actions.

## Author

Built by **ABUGIZA** for the [COREX Framework](https://github.com/corex-zombies).
