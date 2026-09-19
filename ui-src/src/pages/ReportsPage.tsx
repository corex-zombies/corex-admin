import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Receipt, Search, Check, X as XIcon, AlertOctagon, MessageSquareWarning,
  Bug, Crosshair, ShieldX, ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import type { Report, ReportCategory } from "@/lib/data";
import { cn } from "@/lib/cn";

type Filter = "open" | "resolved" | "all";

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const categoryMeta: Record<ReportCategory, { label: string; icon: typeof Receipt; tone: string }> = {
  cheating:   { label: "Cheating",   icon: ShieldX,                tone: "text-rose-400 bg-rose-500/[0.08] ring-rose-500/20" },
  harassment: { label: "Harassment", icon: MessageSquareWarning,   tone: "text-orange-400 bg-orange-500/[0.08] ring-orange-500/20" },
  rdm:        { label: "RDM/VDM",    icon: Crosshair,              tone: "text-amber-400 bg-amber-500/[0.08] ring-amber-500/20" },
  bug:        { label: "Bug",        icon: Bug,                    tone: "text-violet-400 bg-violet-500/[0.08] ring-violet-500/20" },
  other:      { label: "Other",      icon: AlertOctagon,           tone: "text-zinc-300 bg-zinc-700/30 ring-zinc-600/30" },
};

export function ReportsPage() {
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [reports, setReports] = useState<Report[]>([]);

  const refresh = useCallback(() => {
    api.getReports(filter).then(setReports).catch(() => {});
  }, [filter]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return reports.filter((r) =>
      !q || r.reporter_name.toLowerCase().includes(lower) ||
            r.description.toLowerCase().includes(lower)
    );
  }, [reports, q]);

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${reports.filter((r) => r.status === "open").length} open · ${reports.filter((r) => r.status === "resolved" || r.status === "dismissed").length} closed.`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {(["open", "resolved", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "motion-soft h-9 rounded-md border px-3 text-[12px] capitalize",
                filter === f
                  ? "border-zinc-500 bg-[#252529] text-zinc-50"
                  : "border-[#2a2a32] bg-[#141418] text-zinc-400 hover:border-[#383841] hover:text-zinc-200",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="ml-auto flex h-9 w-80 items-center gap-2 rounded-md border border-[#2a2a32] bg-[#141418] px-3 focus-within:border-[#46464e]">
          <Search className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reporter, target, or detail…"
            className="w-full bg-transparent text-[12.5px] text-zinc-200 outline-none placeholder:text-zinc-600" />
        </div>
      </div>

      <section className="rounded-xl border border-[#252529] bg-[#121216]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1d1d23] ring-1 ring-[#272730]">
              <Receipt className="h-4 w-4 text-zinc-500" strokeWidth={2} />
            </div>
            <div className="text-[12.5px] font-medium text-zinc-300">No reports here</div>
            <div className="text-[11px] text-zinc-500">Players file reports with <kbd className="rounded border border-[#33333c] bg-[#18181c] px-1 py-0 font-mono text-[10px]">/report</kbd> in chat.</div>
          </div>
        ) : (
          <ul className="divide-y divide-[#1d1d22]">
            {filtered.map((r) => <ReportRow key={r.id} report={r} onResolved={refresh} />)}
          </ul>
        )}
      </section>
    </>
  );
}

function ReportRow({ report: r, onResolved }: { report: Report; onResolved: () => void }) {
  const cm = categoryMeta[r.category] ?? categoryMeta.other;
  const CIcon = cm.icon;
  return (
    <li className="group relative grid grid-cols-[110px_minmax(0,1fr)_140px_120px] items-start gap-4 px-4 py-3 hover:bg-[#18181c]">
      <div>
        <span className={cn("inline-flex h-5 items-center gap-1 rounded-md px-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-tight ring-1 ring-inset", cm.tone)}>
          <CIcon className="h-3 w-3" strokeWidth={2.25} />
          {cm.label}
        </span>
        <div className="mt-1 font-mono text-[10px] text-zinc-600">{timeAgo(r.created_at)}</div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[12.5px]">
          <span className="font-medium text-zinc-50">{r.reporter_name}</span>
          <span className="text-zinc-600">filed a report</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-zinc-400">{r.description}</p>
      </div>

      <div className="font-mono text-[10.5px] tabular text-zinc-500">
        <div className="truncate">From: {r.reporter_id.replace(/^license:/, "").slice(0, 12)}…</div>
        {r.resolved_by && <div className="mt-0.5 truncate">By: {r.resolved_by}</div>}
      </div>

      <div className="flex items-center gap-1">
        {r.status === "open" ? (
          <>
            <button
              onClick={() => { void api.reportResolve(r.id, "resolved").then(onResolved); }}
              className="motion-soft flex h-6 items-center gap-1 rounded-md border border-emerald-700/40 bg-emerald-500/[0.06] px-2 text-[10.5px] font-medium text-emerald-300 hover:border-emerald-600/60 hover:bg-emerald-500/[0.1]"
            >
              <Check className="h-3 w-3" strokeWidth={2.25} />
              Resolve
            </button>
            <button
              onClick={() => { void api.reportResolve(r.id, "dismissed").then(onResolved); }}
              className="motion-soft flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-[#252529] hover:text-zinc-200"
              title="Dismiss"
            >
              <XIcon className="h-3 w-3" strokeWidth={2.25} />
            </button>
          </>
        ) : (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-tight ring-1 ring-inset",
            r.status === "resolved" ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" :
                                      "bg-zinc-700/20 text-zinc-400 ring-zinc-600/30",
          )}>
            {r.status}
          </span>
        )}
        <ChevronRight className="ml-auto h-3.5 w-3.5 text-zinc-700" strokeWidth={2} />
      </div>
    </li>
  );
}
