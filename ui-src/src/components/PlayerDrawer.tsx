import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Hand, Shield, Crosshair, HeartPulse, Coins, Eye,
  MapPin, Activity, Clock, Fingerprint, Copy, Ban, Package,
  Plus, ChevronRight,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { ItemIcon } from "./ItemIcon";
import { StatBar } from "./StatBar";
import { StatusDot } from "./StatusDot";
import { statusLabel } from "@/lib/statusMeta";
import { type Player } from "@/lib/data";
import { useItemsCatalog } from "@/lib/itemsCatalogContext";
import { cn } from "@/lib/cn";

export type MoneyInput = { kind: 'cash' | 'bank'; amount: number };
type PlayerAction = (action: string, player: Player, money?: MoneyInput) => void;

type Props = {
  player: Player | null;
  onClose: () => void;
  onAction: PlayerAction;
  onOpenInventory?: (p: Player) => void;
};

const fmt = (n: number) => n.toLocaleString("en-US");

export function PlayerDrawer({ player, onClose, onAction, onOpenInventory }: Props) {
  return (
    <AnimatePresence>
      {player && (
        <>
          {/* Veil is `absolute` (scoped to the panel window), not `fixed`, so
              the drawer & dim can't spill outside the rounded admin window
              onto the bare game world. */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          />
          <motion.aside
            initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0.4, 0.2, 1] }}
            className="absolute right-3 top-3 bottom-3 z-50 flex w-[400px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-[#222226] bg-[#141418] ring-1 ring-white/[0.02]"
          >
            <Header player={player} onClose={onClose} />
            <Body player={player} onAction={onAction} onOpenInventory={() => onOpenInventory?.(player)} />
            <Footer player={player} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Header({ player, onClose }: { player: Player; onClose: () => void }) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-[#1d1d23] px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="relative">
          <Avatar name={player.name} id={player.id} mugshot={player.mugshot} loadingHint={!player.mugshot} size="lg" />
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#141418]",
            player.lifecycle === "active" ? "bg-emerald-400" :
            player.lifecycle === "dead" ? "bg-rose-500" :
            player.lifecycle === "spectating" ? "bg-blue-400" : "bg-amber-400",
          )} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-medium text-zinc-50">{player.name}</span>
            {player.isStaff && (
              <span className="rounded-sm bg-emerald-500/[0.08] px-1 py-0 font-mono text-[9px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                STAFF
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] tabular text-zinc-500">
            <span>#{player.id}</span>
            <span className="text-zinc-700">·</span>
            <StatusDot state={player.lifecycle} />
            <span>{statusLabel(player.lifecycle)}</span>
          </div>
        </div>
      </div>
      <button onClick={onClose} className="motion-soft -mr-1 flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-[#1d1d22] hover:text-zinc-200">
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </header>
  );
}

// Defensive defaults — older server responses or rare race conditions may
// omit stats; we never want the drawer to crash because of one missing field.
const DEFAULT_STATS = { hunger: 100, thirst: 100, stress: 0, infection: 0, bleeding: 0, sick: 0, cold: 0, poison: 0 };

function Body({ player, onAction, onOpenInventory }: { player: Player; onAction: PlayerAction; onOpenInventory: () => void }) {
  const stats = { ...DEFAULT_STATS, ...(player.stats ?? {}) };
  const catalog = useItemsCatalog();
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Vitals */}
      <Section title="Vitals">
        <div className="space-y-1.5">
          <StatBar label="Hunger"    value={stats.hunger} tone="vital" />
          <StatBar label="Thirst"    value={stats.thirst} tone="vital" />
          <StatBar label="Stress"    value={stats.stress} tone="status" inverted />
          <StatBar label="Infection" value={stats.infection} tone="status" inverted />
        </div>
        {(stats.bleeding > 0 || stats.sick > 0 || stats.cold > 0 || stats.poison > 0) && (
          <div className="mt-3 border-t border-[#1d1d23] pt-3">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500">Status meters</div>
            <div className="space-y-1.5">
              {stats.bleeding > 0 && <StatBar label="Bleeding" value={stats.bleeding} tone="status" inverted />}
              {stats.sick > 0     && <StatBar label="Sick"     value={stats.sick}     tone="status" inverted />}
              {stats.cold > 0     && <StatBar label="Cold"     value={stats.cold}     tone="status" inverted />}
              {stats.poison > 0   && <StatBar label="Poison"   value={stats.poison}   tone="status" inverted />}
            </div>
          </div>
        )}
      </Section>

      {/* Quick actions */}
      <Section title="Actions">
        <div className="grid grid-cols-4 gap-1.5">
          <Action label="TP to"     icon={Crosshair}  onClick={() => onAction("tp", player)} />
          <Action label="Spectate"  icon={Eye}        onClick={() => onAction("spectate", player)} />
          {/* Revive doubles as a full-heal — admin should be able to top up
              an alive player's HP / vitals, so we don't gate this button on
              lifecycle === "active" anymore. */}
          <Action label="Revive"    icon={HeartPulse} onClick={() => onAction("revive", player)} tone="good" />
          <Action label="Warn"      icon={Hand}       onClick={() => onAction("warn", player)} tone="warn" />
        </div>
      </Section>

      {/* Money */}
      <MoneySection player={player} onAction={onAction} />

      {/* Inventory peek */}
      <Section title="Inventory" right={
        <button onClick={onOpenInventory} className="motion-soft flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200">
          Edit
          <ChevronRight className="h-3 w-3" strokeWidth={2} />
        </button>
      }>
        <div className="flex items-center justify-between rounded-md border border-[#1d1d23] bg-[#18181c] px-2.5 py-2">
          <div className="flex items-center gap-2.5">
            <Package className="h-3.5 w-3.5 text-zinc-500" strokeWidth={1.75} />
            <div className="text-[12px] text-zinc-300">
              {player.inventory.length}
              {player.invMaxSlots ? <span className="text-zinc-500"> / {player.invMaxSlots}</span> : null}
              {" "}<span className="text-zinc-500">slots used</span>
            </div>
          </div>
          <div className="font-mono text-[10.5px] tabular text-zinc-500">
            {player.inventory.reduce((s, slot) => s + ((catalog.get(slot.itemId)?.weight ?? 0) * slot.count), 0).toFixed(1)} kg
          </div>
        </div>
        {/* Mini item preview grid */}
        {player.inventory.length > 0 && (
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {player.inventory.slice(0, 6).map((slot, i) => {
              const item = catalog.get(slot.itemId);
              if (!item) return null;
              return (
                <div
                  key={i}
                  title={`${item.label} × ${slot.count}`}
                  className="relative"
                >
                  <ItemIcon item={item} size="md" />
                  {slot.count > 1 && (
                    <span className="absolute -right-0.5 -top-0.5 rounded-sm bg-black/80 px-1 font-mono text-[9px] font-semibold tabular text-zinc-100 ring-1 ring-white/[0.08]">
                      ×{slot.count}
                    </span>
                  )}
                </div>
              );
            })}
            {player.inventory.length > 6 && (
              <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-[#2f2f38] font-mono text-[10px] tabular text-zinc-500">
                +{player.inventory.length - 6}
              </div>
            )}
          </div>
        )}
        <button onClick={() => onAction("give_item", player)} className="motion-soft mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-700/40 bg-emerald-500/[0.06] py-1.5 text-[11.5px] font-medium text-emerald-300 hover:border-emerald-600/60 hover:bg-emerald-500/[0.1]">
          <Plus className="h-3 w-3" strokeWidth={2.25} />
          Give item
        </button>
      </Section>

      {/* History */}
      <Section title="History">
        <div className="grid grid-cols-2 gap-2">
          <HistoryStat label="Warnings"  value={player.warnings} tone={player.warnings > 0 ? "warn" : undefined} />
          <HistoryStat label="Past bans" value={player.bans}     tone={player.bans > 0 ? "danger" : undefined} />
          <HistoryStat label="Playtime"  value={player.playtime} isText />
          <HistoryStat label="Skill pts" value={player.skillPoints} />
          <HistoryStat label="Zombies killed" value={(player.zombiesKilled ?? 0).toLocaleString("en-US")} isText />
        </div>
      </Section>

      {/* Identity */}
      <Section title="Identity">
        <div className="space-y-1.5">
          <KV k="Zone"    v={player.zone}      icon={MapPin} />
          <KV k="Joined"  v={player.joinedAgo} icon={Clock} />
          <KV k="Ping"    v={`${player.ping}ms`} icon={Activity} />
          <div className="group/sid mt-1 flex items-center gap-1.5 rounded-md border border-[#252529] bg-[#18181c] px-2 py-1.5">
            <Fingerprint className="h-3 w-3 shrink-0 text-zinc-600" strokeWidth={2} />
            <code className="flex-1 truncate font-mono text-[10.5px] text-zinc-400">{player.identifier}</code>
            <button className="motion-soft flex h-4 w-4 items-center justify-center rounded text-zinc-600 opacity-0 hover:bg-[#1d1d23] hover:text-zinc-300 group-hover/sid:opacity-100">
              <Copy className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="Danger zone">
        <div className="space-y-1.5">
          <button onClick={() => onAction("kick", player)} className="motion-soft flex w-full items-center justify-between rounded-md border border-amber-700/40 bg-amber-500/[0.05] px-3 py-2 text-left hover:border-amber-600/60 hover:bg-amber-500/[0.08]">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-amber-300">
              <Shield className="h-3.5 w-3.5" strokeWidth={2} />
              Kick from server
            </div>
            <span className="font-mono text-[10.5px] text-amber-400/60">→</span>
          </button>
          <button onClick={() => onAction("ban", player)} className="motion-soft flex w-full items-center justify-between rounded-md border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-left hover:border-rose-800/60 hover:bg-rose-950/50">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-rose-300">
                <Ban className="h-3.5 w-3.5" strokeWidth={2} />
                Ban from server
              </div>
              <div className="mt-0.5 text-[10.5px] text-rose-400/70">Choose duration & reason next</div>
            </div>
            <span className="font-mono text-[10.5px] text-rose-500/70">→</span>
          </button>
        </div>
      </Section>
    </div>
  );
}

function MoneySection({ player, onAction }: { player: Player; onAction: PlayerAction }) {
  const [type, setType] = useState<"cash" | "bank">("cash");
  const [op, setOp] = useState<"give" | "set">("give");
  const [amount, setAmount] = useState(1000);
  const current = type === "cash" ? player.cash : player.bank;

  return (
    <Section title="Money">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-[#1d1d23] bg-[#18181c] px-2.5 py-1.5">
          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
            <Coins className="h-2.5 w-2.5" strokeWidth={2} />
            CASH
          </div>
          <div className="font-mono text-[14px] font-medium tabular text-zinc-100">${fmt(player.cash)}</div>
        </div>
        <div className="rounded-md border border-[#1d1d23] bg-[#18181c] px-2.5 py-1.5">
          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
            <Coins className="h-2.5 w-2.5" strokeWidth={2} />
            BANK
          </div>
          <div className="font-mono text-[14px] font-medium tabular text-zinc-100">${fmt(player.bank)}</div>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-[#252529] bg-[#18181c] p-2.5">
        {/* Type + op pills */}
        <div className="mb-2 flex items-center gap-1">
          <Pill active={op === "give"} onClick={() => setOp("give")}>Give</Pill>
          <Pill active={op === "set"}  onClick={() => setOp("set")}>Set</Pill>
          <span className="mx-1 h-3 w-px bg-[#252529]" />
          <Pill active={type === "cash"} onClick={() => setType("cash")}>cash</Pill>
          <Pill active={type === "bank"} onClick={() => setType("bank")}>bank</Pill>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
            className="h-7 flex-1 rounded-md border border-[#2f2f38] bg-[#141418] px-2 font-mono text-[12.5px] tabular text-zinc-100 outline-none focus:border-zinc-700"
          />
          <button
            onClick={() => onAction(op === "give" ? "money" : "set_money", player, {kind:type, amount})}
            className="motion-soft flex h-7 items-center gap-1 rounded-md border border-emerald-700/40 bg-emerald-500/[0.08] px-3 text-[11.5px] font-medium text-emerald-300 hover:border-emerald-600/60 hover:bg-emerald-500/[0.12]"
          >
            <Plus className="h-3 w-3" strokeWidth={2.25} />
            Apply
          </button>
        </div>
        <div className="mt-1.5 font-mono text-[10.5px] tabular text-zinc-600">
          {op === "give" ? `→ ${type} ${current.toLocaleString()} + ${amount.toLocaleString()} = ${(current + amount).toLocaleString()}`
                       : `→ set ${type} to ${amount.toLocaleString()} (was ${current.toLocaleString()})`}
        </div>
      </div>
    </Section>
  );
}

function Pill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      "motion-soft rounded-md border px-2 py-0.5 font-mono text-[10.5px] tabular",
      active ? "border-zinc-600 bg-[#252529] text-zinc-100" : "border-[#2f2f38] bg-[#141418] text-zinc-400 hover:border-[#383841] hover:text-zinc-200",
    )}>
      {children}
    </button>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#1d1d23] px-4 py-3.5 last:border-b-0">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-500">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

function Action({ label, icon: Icon, onClick, tone, disabled }: { label: string; icon: typeof Hand; onClick: () => void; tone?: "good" | "warn"; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "motion-soft flex flex-col items-center gap-1 rounded-md border border-[#252529] bg-[#1d1d23] px-2 py-2 text-center hover:border-[#383841] hover:bg-[#1b1b20] disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      <Icon className={cn(
        "h-3.5 w-3.5",
        tone === "good" && "text-emerald-400",
        tone === "warn" && "text-amber-400",
        !tone && "text-zinc-400",
      )} strokeWidth={1.75} />
      <span className="text-[10.5px] text-zinc-300">{label}</span>
    </button>
  );
}

function HistoryStat({ label, value, tone, isText }: { label: string; value: string | number; tone?: "warn" | "danger"; isText?: boolean }) {
  return (
    <div className="rounded-md border border-[#1d1d23] bg-[#18181c] px-2.5 py-1.5">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={cn(
        "mt-0.5 font-mono text-[13px] font-medium tabular",
        tone === "warn" ? "text-amber-300" : tone === "danger" ? "text-rose-300" : "text-zinc-100",
        isText && "text-[11.5px] font-normal",
      )}>
        {value}
      </div>
    </div>
  );
}

function KV({ k, v, icon: Icon }: { k: string; v: string; icon?: typeof MapPin }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[#1d1d22] bg-[#18181c] px-2 py-1.5">
      <span className="flex items-center gap-1.5 text-[11.5px] text-zinc-500">
        {Icon && <Icon className="h-3 w-3 text-zinc-600" strokeWidth={2} />}
        {k}
      </span>
      <span className="font-mono text-[11.5px] tabular text-zinc-200">{v}</span>
    </div>
  );
}

function Footer({ player }: { player: Player }) {
  return (
    <footer className="border-t border-[#1d1d23] bg-[#18181c] px-3.5 py-2">
      <div className="flex items-center justify-between text-[10.5px] text-zinc-600">
        <div className="flex items-center gap-1.5">
          <StatusDot state={player.lifecycle} />
          <span className="tabular">{statusLabel(player.lifecycle).toLowerCase()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="rounded border border-[#2f2f38] bg-[#18181c] px-1 py-0 font-mono text-[9.5px] text-zinc-500">esc</kbd>
          <span>close</span>
        </div>
      </div>
    </footer>
  );
}
