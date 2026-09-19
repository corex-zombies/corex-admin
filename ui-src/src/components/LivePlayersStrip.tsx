import { useRef } from "react";
import { ArrowLeft, ArrowRight, Wifi, ShieldAlert } from "lucide-react";
import { Avatar } from "./Avatar";
import { statusColor } from "@/lib/statusMeta";
import type { Player } from "@/lib/data";
import { cn } from "@/lib/cn";

type Props = {
  players: Player[];
  selectedId: number | null;
  onSelect: (p: Player) => void;
};

function pingTone(p: number) {
  if (p < 50) return "text-emerald-400";
  if (p < 100) return "text-zinc-400";
  return "text-amber-400";
}

export function LivePlayersStrip({ players, selectedId, onSelect }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => scrollerRef.current?.scrollBy({ left: dir * 360, behavior: "smooth" });

  return (
    <section className="relative">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[12.5px] font-medium text-zinc-200">Active players</h2>
          <span className="font-mono text-[10.5px] tabular text-zinc-500">
            {players.length}
          </span>
        </div>
        {/* Paired arrow control — a single segmented pill rather than two
            separate buttons. Reads as one component, matches the refined
            badge style used elsewhere in the panel. */}
        <div className="motion-soft flex h-6 items-center divide-x divide-[#2a2a32] overflow-hidden rounded-full border border-[#2a2a32] bg-[#18181c]">
          <button
            onClick={() => scroll(-1)}
            className="flex h-full w-7 items-center justify-center text-zinc-500 hover:bg-[#1d1d23] hover:text-zinc-200"
            aria-label="Scroll left"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} />
          </button>
          <button
            onClick={() => scroll(1)}
            className="flex h-full w-7 items-center justify-center text-zinc-500 hover:bg-[#1d1d23] hover:text-zinc-200"
            aria-label="Scroll right"
          >
            <ArrowRight className="h-3 w-3" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#0e0e11] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0e0e11] to-transparent" />
        <div
          ref={scrollerRef}
          className="scrollbar-hide flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {players.map((p) => {
            const selected = selectedId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className={cn(
                  "motion-soft group flex shrink-0 items-center gap-3 rounded-xl border px-2.5 py-2 pr-3 text-left",
                  selected
                    ? "border-zinc-600/70 bg-[#252529] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                    : "border-[#252529] bg-[#1d1d23] hover:border-[#33333c] hover:bg-[#1b1b20]",
                )}
              >
                <div className="relative">
                  <Avatar name={p.name} id={p.id} mugshot={p.mugshot} loadingHint={!p.mugshot} size="md" />
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-[2.5px]",
                      selected ? "ring-[#252529]" : "ring-[#1d1d23] group-hover:ring-[#1b1b20]",
                      statusColor(p.lifecycle),
                    )}
                  />
                </div>

                <div className="flex min-w-[88px] flex-col leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] tabular text-zinc-500">
                      #{p.id}
                    </span>
                    <span
                      className={cn(
                        "truncate text-[12.5px] font-medium",
                        selected ? "text-zinc-50" : "text-zinc-100 group-hover:text-zinc-50",
                      )}
                    >
                      {p.name.split(" ")[0]}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <Wifi className={cn("h-2.5 w-2.5", pingTone(p.ping))} strokeWidth={2.25} />
                    <span className={cn("font-mono text-[10px] tabular", pingTone(p.ping))}>
                      {p.ping}ms
                    </span>
                  </div>
                </div>

                {p.warnings > 0 && (
                  <span
                    title={`${p.warnings} active warning(s)`}
                    className="ml-0.5 inline-flex h-5 items-center gap-1 rounded-md bg-amber-500/[0.08] px-1.5 font-mono text-[10px] font-semibold tabular text-amber-300 ring-1 ring-amber-500/20"
                  >
                    <ShieldAlert className="h-2.5 w-2.5" strokeWidth={2.25} />
                    {p.warnings}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
