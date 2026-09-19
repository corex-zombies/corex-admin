import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Plus, Undo2, Clock, Ban as BanIcon, ShieldX, Crosshair, MessageSquareWarning,
  Bug, AlertOctagon, ChevronRight, Skull, UserCog, FileText, Gavel,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { bans as mockBans, type Ban } from "@/lib/data";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

type Filter = "active" | "expired" | "lifted" | "all";

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Returns { left, total } in seconds, where left/total ∈ [0, 1] for the progress bar
function banProgress(b: Ban): { remainingLabel: string; pct: number } | null {
  if (!b.expiresAt) return null;
  const total = (new Date(b.expiresAt).getTime() - new Date(b.at).getTime()) / 1000;
  if (!Number.isFinite(total) || total <= 0) return null;
  const left = Math.max(0, Math.floor((new Date(b.expiresAt).getTime() - Date.now()) / 1000));
  const pct = Math.max(0, Math.min(1, left / total));
  const label =
    left <= 0 ? "expired" :
    left < 3600 ? `${Math.floor(left / 60)}m left` :
    left < 86400 ? `${Math.floor(left / 3600)}h left` :
    `${Math.floor(left / 86400)}d left`;
  return { remainingLabel: label, pct };
}

// Pick an icon + tone for a ban reason
function reasonMeta(reason: string): { icon: typeof BanIcon; tone: string; tag: string } {
  const r = reason.toLowerCase();
  if (/cheat|aimbot|esp|wallhack|hack/.test(r))   return { icon: ShieldX, tone: "text-rose-400 bg-rose-500/[0.08] ring-rose-500/20", tag: "Cheating" };
  if (/rdm|vdm|combat|safe zone/.test(r))         return { icon: Crosshair, tone: "text-amber-400 bg-amber-500/[0.08] ring-amber-500/20", tag: "Combat" };
  if (/toxic|voice|chat|abuse|racism/.test(r))    return { icon: MessageSquareWarning, tone: "text-orange-400 bg-orange-500/[0.08] ring-orange-500/20", tag: "Toxicity" };
  if (/exploit|duplicate|dupe|glitch/.test(r))    return { icon: Bug, tone: "text-violet-400 bg-violet-500/[0.08] ring-violet-500/20", tag: "Exploit" };
  return { icon: AlertOctagon, tone: "text-zinc-300 bg-zinc-700/30 ring-zinc-600/30", tag: "Other" };
}

// Deterministic numeric id from any string (for avatar cycling)
function strHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function BansPage({ onNavigatePlayers }: { onNavigatePlayers: () => void }) {
  const [filter, setFilter] = useState<Filter>("active");
  const [q, setQ] = useState("");
  // Server returns the latest 250 entries; counts describe this loaded window.
  const [allBans, setAllBans] = useState<Ban[]>(mockBans);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    api.getBans("all").then((list) => { if (alive) setAllBans(list); })
      .catch((e) => { if (alive) { setError(String(e)); setLocked(true); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true);
    try { setAllBans(await api.getBans("all")); setError(""); setLocked(false); }
    catch (e) { setError(String(e)); setLocked(true); }
    finally { inFlight.current = false; setLoading(false); }
  }

  async function mutate(ban: Ban, action: "lift" | "extend") {
    if (inFlight.current || loading || locked) return;
    inFlight.current = true; setBusy(true); setError("");
    let acknowledged = false;
    try {
      if (action === "lift") await api.banLift(Number(ban.id));
      else await api.banExtend(Number(ban.id), 7 * 86400);
      acknowledged = true;
      setAllBans(await api.getBans("all"));
    } catch (e) {
      setError(`${acknowledged ? "Change saved, but refresh failed. " : ""}${String(e)}. Refresh bans and inspect the result before trying again.`);
      setLocked(true);
    } finally { inFlight.current = false; setBusy(false); }
  }

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return allBans.filter((b) =>
      (filter === "all" || b.status === filter)
      && (!q || b.player.toLowerCase().includes(lower) || b.reason.toLowerCase().includes(lower) || b.identifier.toLowerCase().includes(lower) || b.by.toLowerCase().includes(lower))
    );
  }, [filter, q, allBans]);

  const counts = useMemo(() => ({
    active:  allBans.filter((b) => b.status === "active").length,
    expired: allBans.filter((b) => b.status === "expired").length,
    lifted:  allBans.filter((b) => b.status === "lifted").length,
    all:     allBans.length,
    perma:   allBans.filter((b) => b.status === "active" && !b.expiresAt).length,
  }), [allBans]);

  const filterMeta: Record<Filter, { label: string; icon: typeof BanIcon; tone: string }> = {
    active:  { label: "Active",  icon: BanIcon,      tone: "text-rose-400" },
    expired: { label: "Expired", icon: Clock,        tone: "text-zinc-400" },
    lifted:  { label: "Lifted",  icon: Undo2,        tone: "text-emerald-400" },
    all:     { label: "All",     icon: FileText,     tone: "text-zinc-400" },
  };

  return (
    <>
      <PageHeader
        title="Bans"
        description={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <DescChip icon={BanIcon}    tone="danger" label={`${counts.active} active`} />
            <DescChip icon={Skull}      tone="danger" label={`${counts.perma} permanent`} />
            <DescChip icon={Clock}                    label={`${counts.expired} expired`} />
            <DescChip icon={Undo2}      tone="good"   label={`${counts.lifted} lifted`} />
          </span>
        }
        actions={
          <button
            onClick={onNavigatePlayers}
            title="Open the Players list to ban from a player's profile"
            className="motion-soft flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-zinc-100 px-3 text-[12px] font-medium text-zinc-900 hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            New ban
          </button>
        }
      />

      <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
        <span>Latest 250 bans. Counts and search apply to the loaded entries.</span>
        <button disabled={busy || loading} onClick={() => void refresh()} className="rounded border border-zinc-700 px-3 py-1 disabled:opacity-40">Refresh bans</button>
      </div>
      {error && <div role="alert" className="mb-3 rounded border border-rose-800 p-3 text-sm text-rose-300">{error}</div>}

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {(["active","expired","lifted","all"] as Filter[]).map((f) => {
            const M = filterMeta[f];
            const Icon = M.icon;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "motion-soft flex h-9 items-center gap-2 rounded-md border px-2.5 text-[12px]",
                  active
                    ? "border-zinc-500 bg-[#252529] text-zinc-50 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                    : "border-[#2a2a32] bg-[#141418] text-zinc-400 hover:border-[#383841] hover:text-zinc-200",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", M.tone)} strokeWidth={2.25} />
                <span>{M.label}</span>
                <span className={cn(
                  "rounded-sm px-1 py-0 font-mono text-[10px] tabular",
                  active ? "bg-[#16161a] text-zinc-300" : "bg-[#1d1d23] text-zinc-500",
                )}>
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex h-9 w-80 items-center gap-2 rounded-md border border-[#2a2a32] bg-[#141418] px-3 focus-within:border-[#46464e]">
          <Search className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by player, reason, license, or admin…"
            className="w-full bg-transparent text-[12.5px] text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          {q && <button onClick={() => setQ("")} className="font-mono text-[10.5px] text-zinc-500 hover:text-zinc-300">clear</button>}
        </div>
      </div>

      <section className="rounded-xl border border-[#252529] bg-[#121216]">
        {/* Table header */}
        <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,2fr)_120px_minmax(0,1.2fr)_140px_120px] items-center gap-4 border-b border-[#1d1d23] bg-[#18181c] px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
          <span>Player</span>
          <span>Reason</span>
          <span>Duration</span>
          <span>Issued by</span>
          <span>Time remaining</span>
          <span>Status</span>
        </div>

        <div className="divide-y divide-[#1d1d22]">
          {loading ? <div className="p-6 text-sm text-zinc-400">Loading bans…</div> : error && allBans.length === 0 ? null : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1d1d23] ring-1 ring-[#272730]">
                <Gavel className="h-4 w-4 text-zinc-500" strokeWidth={2} />
              </div>
              <div className="text-[12.5px] font-medium text-zinc-300">No bans match this filter</div>
              <div className="text-[11px] text-zinc-500">Try a different tab, or clear the search.</div>
            </div>
          ) : filtered.map((b) => <BanRow key={b.id} ban={b} disabled={busy || loading || locked} onAction={(action) => void mutate(b, action)} />)}
        </div>
      </section>
    </>
  );
}

function BanRow({ ban: b, disabled, onAction }: { ban: Ban; disabled: boolean; onAction: (action: "lift" | "extend") => void }) {
  const rm = reasonMeta(b.reason);
  const RIcon = rm.icon;
  const prog = banProgress(b);
  const isPerma = !b.expiresAt;

  return (
    <div className="motion-soft group relative grid grid-cols-[minmax(0,1.7fr)_minmax(0,2fr)_120px_minmax(0,1.2fr)_140px_120px] items-center gap-4 px-4 py-3 hover:bg-[#18181c]">
      {/* Player with avatar */}
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={b.player} id={strHash(b.player)} size="md" />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-medium text-zinc-50">{b.player}</div>
          <div className="mt-0.5 truncate font-mono text-[10.5px] text-zinc-600">
            {b.identifier.replace(/^license:/, "").slice(0, 14)}…
          </div>
        </div>
      </div>

      {/* Reason with category badge */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex h-5 items-center gap-1 rounded-md px-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-tight ring-1 ring-inset", rm.tone)}>
            <RIcon className="h-3 w-3" strokeWidth={2.25} />
            {rm.tag}
          </span>
          <span className="line-clamp-1 text-[12.5px] text-zinc-200">{b.reason}</span>
        </div>
      </div>

      {/* Duration */}
      <div>
        {isPerma ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/[0.08] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-tight text-rose-300 ring-1 ring-inset ring-rose-500/20">
            <Skull className="h-3 w-3" strokeWidth={2.25} />
            Permanent
          </span>
        ) : (
          <span className="inline-flex items-center rounded-md bg-[#1d1d23] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-tight text-zinc-300 ring-1 ring-inset ring-zinc-700/40">
            {b.duration}
          </span>
        )}
      </div>

      {/* Issued by */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1d1d23] ring-1 ring-[#272730]">
          <UserCog className="h-3 w-3 text-zinc-400" strokeWidth={2} />
        </div>
        <div className="min-w-0 leading-tight">
          <div className={cn("truncate text-[11.5px]", b.by === "you" ? "font-medium text-zinc-100" : "text-zinc-300")}>
            {b.by === "you" ? "You" : b.by}
          </div>
          <div className="font-mono text-[9.5px] text-zinc-600">{timeAgo(b.at)}</div>
        </div>
      </div>

      {/* Time remaining (progress) */}
      <div className="min-w-0">
        {isPerma ? (
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-600">
            <span className="text-zinc-500">∞</span>
            <span>no end</span>
          </div>
        ) : prog ? (
          <div>
            <div className="flex items-center justify-between font-mono text-[10.5px] tabular">
              <span className="text-zinc-400">{prog.remainingLabel}</span>
              <span className="text-zinc-600">{Math.round(prog.pct * 100)}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#1d1d23]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  prog.pct > 0.5 ? "bg-rose-500/70" : prog.pct > 0.2 ? "bg-amber-500/70" : "bg-zinc-600/70",
                )}
                style={{ width: `${prog.pct * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="font-mono text-[10.5px] text-zinc-600">—</span>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        {b.status === "active"  && <Badge tone="rose"    icon={BanIcon}>ACTIVE</Badge>}
        {b.status === "expired" && <Badge tone="zinc"    icon={Clock}>EXPIRED</Badge>}
        {b.status === "lifted"  && <Badge tone="emerald" icon={Undo2}>LIFTED</Badge>}
        <ChevronRight className="h-3.5 w-3.5 text-zinc-700 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" strokeWidth={2} />
      </div>

      {/* Hover actions — float right */}
      {b.status === "active" && (
        <div className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
          <div className="flex items-center gap-0.5 rounded-lg border border-[#383841] bg-[#16161a] p-1 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.7)] backdrop-blur-sm">
            {!isPerma && <ActionBtn
              icon={Clock} label="+7d"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onAction("extend");
              }}
            />}
            <ActionBtn
              icon={Undo2} label="Lift" tone="good"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onAction("lift");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, tone, onClick, disabled }: {
  icon: typeof BanIcon; label: string; tone?: "good"; onClick: (e: React.MouseEvent) => void; disabled: boolean;
}) {
  const toneCls = tone === "good"
    ? "text-emerald-300/90 hover:bg-emerald-500/10 hover:text-emerald-200"
    : "text-zinc-300 hover:bg-[#252529] hover:text-zinc-50";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn("motion-soft flex h-6 items-center gap-1 rounded-md px-1.5 text-[10.5px] font-medium leading-none", toneCls)}
    >
      <Icon className="h-3 w-3" strokeWidth={2.25} />
      {label}
    </button>
  );
}

function Badge({ children, tone, icon: Icon }: {
  children: React.ReactNode;
  tone: "rose" | "emerald" | "zinc";
  icon?: typeof BanIcon;
}) {
  const cls = {
    rose:    "bg-rose-500/10 text-rose-300 ring-rose-500/20",
    emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    zinc:    "bg-zinc-700/20 text-zinc-400 ring-zinc-600/30",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-tight ring-1 ring-inset", cls)}>
      {Icon && <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />}
      {children}
    </span>
  );
}

function DescChip({ icon: Icon, tone, label }: {
  icon: typeof BanIcon;
  tone?: "good" | "warn" | "danger";
  label: string;
}) {
  const toneCls =
    tone === "good"   ? "text-emerald-300/90 ring-emerald-500/15 bg-emerald-500/[0.06]" :
    tone === "warn"   ? "text-amber-300/90 ring-amber-500/15 bg-amber-500/[0.06]" :
    tone === "danger" ? "text-rose-300/90  ring-rose-500/15  bg-rose-500/[0.06]" :
                        "text-zinc-300     ring-[#2a2a32]    bg-[#1a1a1f]";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11.5px] ring-1 ring-inset",
      toneCls,
    )}>
      <Icon className="h-3 w-3" strokeWidth={2.25} />
      <span className="font-medium tabular">{label}</span>
    </span>
  );
}
