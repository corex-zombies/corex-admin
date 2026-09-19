// corex-admin · data layer
//
// PRODUCTION shape:
//   - Types and UI constants are always shipped.
//   - The item catalog is loaded from the active server provider, not assumed
//     to match a static development sample.
//   - Mock arrays for players/bans/etc. live in ./mock and are re-exported
//     here ONLY in dev mode. In a prod bundle the conditional is folded to
//     `false`, the dead branch is dropped, and the mock module is tree-shaken.
//   - Result: opening the FiveM NUI never shows fabricated players or bans.
//     Pages that don't yet call `api.*` simply render empty states.

import * as devMock from "./mock";

const IS_DEV = !import.meta.env.PROD;

// ----- Types (always) ----------------------------------------------------

export type LifecycleState = "loading" | "active" | "dead" | "spectating";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export type ItemCategory =
  | "pistol" | "smg" | "rifle" | "shotgun" | "ammo"
  | "consumable" | "food" | "drink" | "medical"
  | "material" | "blueprint" | "vehicle";

export type Item = {
  id: string;
  label: string;
  weight: number;
  size: { w: number; h: number };
  stackable: boolean;
  maxStack?: number;
  category: ItemCategory;
  rarity: Rarity;
  /** Provider-specific filename, retained for inventories that expose one. */
  image?: string;
  /** Fully resolved image URL supplied by the active inventory provider. */
  imageUrl?: string;
};

export type InventorySlot = { itemId: string; count: number };

export type PlayerStats = {
  hunger: number; thirst: number; stress: number; infection: number;
  bleeding: number; sick: number; cold: number; poison: number;
};

export type Player = {
  id: number;
  identifier: string;
  name: string;
  cash: number;
  bank: number;
  ping: number;
  lifecycle: LifecycleState;
  zone: string;
  playtime: string;
  joinedAgo: string;
  stats: PlayerStats;
  warnings: number;
  bans: number;
  skillPoints: number;
  isStaff?: boolean;
  inventory: InventorySlot[];
  /** Total slots in the inventory grid (Config.GridWidth × GridHeight from corex-inventory). */
  invMaxSlots?: number;
  /** Lifetime zombies the player has killed (tracked in corex-core metadata). */
  zombiesKilled?: number;
  /** base64 mugshot from MugShotBase64; '' or undefined if unavailable */
  mugshot?: string;
};

export type AdminAction = {
  id: string;
  type:
    | "kick" | "ban" | "warn" | "give_money" | "set_money" | "give_item"
    | "remove_item" | "teleport" | "revive" | "spectate"
    | "spawn_zombie" | "clear_zombies" | "weather";
  targetName?: string;
  targetId?: number;
  by: string;
  at: string;
  detail?: string;
  reversible: boolean;
};

export type Ban = {
  id: string;
  player: string;
  identifier: string;
  by: string;
  at: string;
  reason: string;
  duration: string;
  expiresAt?: string;
  status: "active" | "expired" | "lifted";
};

export type ZoneInfo = {
  id: string; label: string;
  type: "redzone" | "safezone";
  enabled: boolean;
  playersInside: number;
  refillIn: string;
};

export type ZombieStats = {
  alive: number;
  killedToday: number;
  hordeNext: string;
  byType: { id: string; label: string; count: number }[];
};

export type WeatherInfo = { current: string; next: string; changeIn: string };

export type LogEntry = {
  id: string;
  ts: string;
  level: "info" | "warn" | "error" | "admin" | "security";
  area: "auth" | "economy" | "combat" | "inventory" | "admin" | "system" | "zombies" | "redzone";
  message: string;
  actor?: string;
};

export type StaffMember = {
  id: number;
  name: string;
  rank: "Helper" | "Moderator" | "Admin" | "Senior Admin" | "Head Admin";
  status: "on-duty" | "off-duty" | "investigating";
  actionsToday: number;
  hoursThisWeek: number;
};

export type ReportCategory = "cheating" | "harassment" | "rdm" | "bug" | "other";

export type Report = {
  id: number;
  reporter_id: string;        // license:xxx of who filed it
  reporter_name: string;
  target_name: string;        // what the reporter typed
  target_id: string;          // server id or '?' if unknown
  category: ReportCategory;
  description: string;
  status: "open" | "in_progress" | "resolved" | "dismissed";
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
};

// ----- UI constants (always) ---------------------------------------------

export const rarityMeta: Record<Rarity, { label: string; color: string; ring: string; bg: string }> = {
  common:    { label: "COMMON",    color: "text-zinc-300",    ring: "ring-zinc-600/30",    bg: "bg-zinc-700/10" },
  uncommon:  { label: "UNCOMMON",  color: "text-emerald-400", ring: "ring-emerald-500/30", bg: "bg-emerald-500/10" },
  rare:      { label: "RARE",      color: "text-blue-400",    ring: "ring-blue-500/30",    bg: "bg-blue-500/10" },
  epic:      { label: "EPIC",      color: "text-violet-400",  ring: "ring-violet-500/30",  bg: "bg-violet-500/10" },
  legendary: { label: "LEGENDARY", color: "text-amber-400",   ring: "ring-amber-500/30",   bg: "bg-amber-500/10" },
  mythic:    { label: "MYTHIC",    color: "text-rose-400",    ring: "ring-rose-500/30",    bg: "bg-rose-500/10" },
};

export const categoryLabels: Record<ItemCategory, string> = {
  pistol: "Pistols", smg: "SMGs", rifle: "Rifles", shotgun: "Shotguns",
  ammo: "Ammo", consumable: "Consumables", food: "Food", drink: "Drinks",
  medical: "Medical", material: "Materials", blueprint: "Blueprints", vehicle: "Vehicles",
};

// ----- Static items catalog (real, mirrors corex-inventory) -------------

export const items: Item[] = IS_DEV ? devMock.items : [];
export const itemsById: Record<string, Item> = Object.fromEntries(items.map((i) => [i.id, i]));

// ----- Mock arrays — dev-only, EMPTY in production ----------------------

export const players:       Player[]      = IS_DEV ? devMock.players       : [];
export const bans:          Ban[]         = IS_DEV ? devMock.bans          : [];
export const recentActions: AdminAction[] = IS_DEV ? devMock.recentActions : [];
export const zonesData:     ZoneInfo[]    = IS_DEV ? devMock.zonesData     : [];
export const zombieStats:   ZombieStats   = IS_DEV ? devMock.zombieStats   : { alive: 0, killedToday: 0, hordeNext: "—", byType: [] };
export const weather:       WeatherInfo   = IS_DEV ? devMock.weather       : { current: "—", next: "—", changeIn: "—" };
export const logs:          LogEntry[]    = IS_DEV ? devMock.logs          : [];
export const staff:         StaffMember[] = IS_DEV ? devMock.staff         : [];
export const onlineHistory: number[]      = IS_DEV ? devMock.onlineHistory : [];
