import {
  Activity, Skull, MapPin, Gavel, Megaphone,
  Sun, Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Sparkline } from "@/components/Sparkline";
import { LivePlayersStrip } from "@/components/LivePlayersStrip";
import { RecentActions } from "@/components/RecentActions";
import { PageHeader } from "@/components/PageHeader";
import {
  players as mockPlayers, recentActions as mockActions, bans as mockBans,
  onlineHistory,
  type Player, type Ban, type AdminAction,
} from "@/lib/data";
import { api, type ServerSummary } from "@/lib/api";
import type { PageId } from "@/lib/nav";
import { cn } from "@/lib/cn";

type Props = {
  selected: Player | null;
  setSelected: (p: Player | null) => void;
  onPaletteOpen: () => void;
  onNavigate: (page: PageId) => void;
  onAnnounce: () => void;
};

// Refresh world stats this often. 5s matches the zombie-count cadence on
// the client, so the alive counter doesn't lag behind reality by much.
const WORLD_POLL_MS = 5000;

export function OverviewPage({ selected, setSelected, onPaletteOpen, onNavigate, onAnnounce }: Props) {
  const [players, setPlayers]     = useState<Player[]>(mockPlayers);
  const [bans, setBans]           = useState<Ban[]>(mockBans);
  const [overview, setOverview]   = useState<ServerSummary | null>(null);
  const [recent, setRecent]       = useState<AdminAction[]>(mockActions);

  // Players + bans load once; the overview snapshot (zombies / red zones /
  // weather) polls on an interval because those numbers actually change.
  useEffect(() => {
    let alive = true;
    api.getPlayers().then((list) => { if (alive) setPlayers(list); }).catch(() => {});
    api.getBans("active").then((list) => { if (alive) setBans(list); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      api.getOverview().then((ov) => { if (alive) setOverview(ov); }).catch(() => {});
      api.getRecentActions(20).then((rows) => { if (alive && rows.length > 0) setRecent(rows); }).catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, WORLD_POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const activeCount  = players.filter((p) => p.lifecycle === "active").length;
  const totalOnline  = players.length;
  const activeBans   = bans.filter((b) => b.status === "active").length;
  const maxPlayers   = overview?.maxPlayers ?? 32;
  const zombies      = overview?.zombies   ?? { alive: 0, killedToday: 0, hordeNext: "—" };
  const redzones     = overview?.redzones  ?? { activeCount: 0, totalCount: 0, playersInside: 0 };
  const weather      = overview?.weather   ?? { current: "—", next: "—", changeIn: "—" };

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="tabular">
              {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
          </>
        }
        title="Server overview"
        description={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <DescChip icon={Users}  label={`${activeCount} active`} dot="bg-emerald-400" />
            <DescChip icon={Gavel}  label={`${activeBans} active bans`} tone="danger" />
          </span>
        }
        actions={
          <>
            <button
              onClick={onPaletteOpen}
              className="motion-soft hidden h-8 items-center gap-2 rounded-md border border-[#2f2f38] bg-[#18181c] px-3 text-[12px] text-zinc-300 hover:border-[#383841] hover:bg-[#1d1d24] md:flex"
            >
              Quick action
              <kbd className="rounded border border-[#33333c] bg-[#252529] px-1 py-0 font-mono text-[10px] text-zinc-500">⌘K</kbd>
            </button>
            <button onClick={onAnnounce} className="motion-soft flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-zinc-100 px-3 text-[12px] font-medium text-zinc-900 hover:bg-white">
              <Megaphone className="h-3.5 w-3.5" strokeWidth={2.25} />
              Announce
            </button>
          </>
        }
      />

      <div className="mb-5">
        <LivePlayersStrip players={players} selectedId={selected?.id ?? null} onSelect={(p) => setSelected(p)} />
      </div>

      {/* 4 server health stats — all distinct, no AI-slop */}
      <section className="mb-5 grid grid-cols-4 divide-x divide-[#252529] overflow-hidden rounded-xl border border-[#252529] bg-[#141418]">
        <Metric
          label="Players online"
          value={`${totalOnline}`}
          unit={`/ ${maxPlayers}`}
          icon={Activity}
          data={onlineHistory}
          stroke="#34d399"
          meta={`${activeCount} active · ${totalOnline - activeCount} other`}
        />
        <Metric
          label="Zombies alive"
          value={zombies.alive.toString()}
          icon={Skull}
          stroke="#a1a1aa"
          meta={`${zombies.killedToday.toLocaleString()} killed today`}
        />
        <Metric
          label="Red zones active"
          value={redzones.activeCount.toString()}
          icon={MapPin}
          stroke="#f43f5e"
          meta={`${redzones.playersInside} players inside`}
        />
        <Metric
          label="Weather"
          value={weather.current}
          icon={Sun}
          stroke="#a1a1aa"
        />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4">
        <RecentActions actions={recent} />
        <div className="space-y-4">
          {/* Open bans peek */}
          <section className="overflow-hidden rounded-xl border border-[#252529] bg-[#121216]">
            <header className="flex items-center justify-between border-b border-[#1d1d23] px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
                <h3 className="text-[12.5px] font-medium text-zinc-200">Active bans</h3>
                <span className="font-mono text-[10.5px] tabular text-zinc-500">{activeBans}</span>
              </div>
              <button onClick={() => onNavigate("bans")} className="text-[11px] text-zinc-500 hover:text-zinc-300">
                Open
              </button>
            </header>
            <ul className="divide-y divide-[#1d1d22]">
              {bans.filter((b) => b.status === "active").slice(0, 4).map((b) => (
                <li key={b.id} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-zinc-100">{b.player}</span>
                    <span className={cn(
                      "shrink-0 rounded-sm px-1.5 py-0 font-mono text-[9.5px] font-semibold uppercase tracking-tight ring-1 ring-inset",
                      b.duration === "perma" ? "bg-rose-500/10 text-rose-300 ring-rose-500/20" : "bg-zinc-700/20 text-zinc-300 ring-zinc-600/30",
                    )}>
                      {b.duration}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{b.reason}</div>
                </li>
              ))}
            </ul>
          </section>

        </div>
      </div>
    </>
  );
}

function Metric({ label, value, unit, icon: Icon, data, stroke, meta }: { label: string; value: string; unit?: string; icon: typeof Activity; data?: number[]; stroke: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-500">
          <Icon className="h-3 w-3" strokeWidth={2} />
          {label}
        </div>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="font-mono text-[22px] font-semibold tabular tracking-tight text-zinc-50">{value}</span>
          {unit && <span className="font-mono text-[12px] tabular text-zinc-500">{unit}</span>}
        </div>
        {meta && <div className="mt-0.5 truncate text-[10.5px] text-zinc-600">{meta}</div>}
      </div>
      {data && (
        <div style={{ color: stroke }} className="shrink-0">
          <Sparkline values={data} width={72} height={32} stroke={stroke} fill={stroke} />
        </div>
      )}
    </div>
  );
}

function DescChip({ icon: Icon, dot, tone, label }: {
  icon?: typeof Activity;
  dot?: string;
  tone?: "warn" | "danger";
  label: string;
}) {
  const toneCls =
    tone === "warn"   ? "text-amber-300/90 ring-amber-500/15 bg-amber-500/[0.06]" :
    tone === "danger" ? "text-rose-300/90  ring-rose-500/15  bg-rose-500/[0.06]"  :
                        "text-zinc-300     ring-[#2a2a32]    bg-[#1a1a1f]";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11.5px] ring-1 ring-inset",
      toneCls,
    )}>
      {dot && <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dot)} />}
      {Icon && <Icon className="h-3 w-3" strokeWidth={2.25} />}
      <span className="font-medium tabular">{label}</span>
    </span>
  );
}
