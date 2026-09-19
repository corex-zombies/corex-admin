import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type UndoEvent = {
  id: string;
  message: string;
  expiresAt: number; // ms timestamp
};

type Props = {
  events: UndoEvent[];
  onDismiss: (id: string) => void;
};

// Toasts render INSIDE the admin window (absolute, not fixed) so they never
// spill onto the bare game world below. The stack uses a 3D card metaphor:
// only the newest toast is fully visible; older ones peek behind it. Click
// the stack (or the chevron) to fan them out vertically. Click again — or
// click anywhere outside — to collapse back into the stack.
//
// `events` arrives newest-last from App.tsx (push order); we render newest
// at the bottom of the array which becomes the front of the visual stack.
export function UndoToast({ events, onDismiss }: Props) {
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const newestEventId = events.at(-1)?.id ?? null;
  const expanded = newestEventId !== null && expandedFor === newestEventId;

  // Auto-collapse when the user clicks elsewhere inside the panel.
  useEffect(() => {
    if (!expanded) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-toast-stack]')) setExpandedFor(null);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [expanded]);

  if (events.length === 0) return null;

  // Newest events first in the visual list — index 0 is the front card.
  const ordered = [...events].reverse();
  const visibleStack = ordered.slice(0, 3); // up to 3 layers peek out

  return (
    <div
      data-toast-stack
      className="pointer-events-none absolute bottom-4 left-1/2 z-[70] -translate-x-1/2"
      // Click-through for the dead area, but each card re-enables pointer events.
    >
      {expanded ? (
        // Expanded: vertical column of every active toast, top → bottom = newest → oldest.
        <motion.div
          layout
          className="pointer-events-auto flex flex-col-reverse gap-2"
        >
          <AnimatePresence initial={false}>
            {ordered.map((e) => (
              <ToastItem
                key={e.id}
                event={e}
                onDismiss={() => onDismiss(e.id)}
                stacked={false}
              />
            ))}
          </AnimatePresence>
          {events.length > 1 && (
            <button
              onClick={() => setExpandedFor(null)}
              className="pointer-events-auto mx-auto -mb-1 flex h-5 items-center gap-1 rounded-full bg-[#1d1d23]/90 px-2 text-[10px] text-zinc-400 ring-1 ring-white/[0.04] hover:text-zinc-200"
            >
              collapse
              <ChevronDown className="h-2.5 w-2.5 rotate-180" strokeWidth={2} />
            </button>
          )}
        </motion.div>
      ) : (
        // Collapsed 3D stack: front card is full-opacity; backs peek as smaller, dimmer slices.
        <div
          onClick={() => events.length > 1 && setExpandedFor(newestEventId)}
          role={events.length > 1 ? "button" : undefined}
          tabIndex={events.length > 1 ? 0 : undefined}
          onKeyDown={(e) => {
            if (e.target === e.currentTarget && events.length > 1 && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault(); setExpandedFor(newestEventId);
            }
          }}
          className={cn(
            "pointer-events-auto relative block",
            events.length > 1 && "cursor-pointer",
          )}
          aria-label={events.length > 1 ? `Expand ${events.length} notifications` : undefined}
        >
          {visibleStack.map((e, i) => {
            // i=0 is the front; depth grows backwards. Each card lifts a few
            // pixels and shrinks slightly — the classic stacked-cards look.
            const depth = i;
            const isFront = depth === 0;
            return (
              <motion.div
                key={e.id}
                layout
                initial={{ y: 12, opacity: 0, scale: 0.96 }}
                animate={{
                  y: -depth * 6,
                  opacity: 1 - depth * 0.25,
                  scale: 1 - depth * 0.04,
                }}
                exit={{ y: 14, opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.22, ease: [0.2, 0.4, 0.2, 1] }}
                className={cn(
                  isFront ? "relative" : "absolute inset-0 -z-10",
                )}
                style={{ zIndex: 10 - depth }}
              >
                <ToastCard
                  event={e}
                  onDismiss={() => onDismiss(e.id)}
                  dimmed={!isFront}
                  showUndo={isFront}
                  extraCount={isFront && events.length > visibleStack.length
                    ? events.length - visibleStack.length
                    : 0}
                  totalCount={isFront ? events.length : 0}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// One row in the EXPANDED view — slightly different layout (no peeking, full
// width, individual progress bar). Reuses ToastCard for the visual chrome.
function ToastItem({ event, onDismiss }: { event: UndoEvent; onDismiss: () => void; stacked: boolean }) {
  return (
    <motion.div
      layout
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 8, opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.2, 0.4, 0.2, 1] }}
      className="pointer-events-auto"
    >
      <ToastCard event={event} onDismiss={onDismiss} dimmed={false} showUndo />
    </motion.div>
  );
}

// The card chrome — same look for collapsed-front and expanded rows. Inline
// progress bar at the bottom drives the auto-dismiss countdown.
function ToastCard({
  event, onDismiss, dimmed, showUndo, extraCount = 0, totalCount = 0,
}: {
  event: UndoEvent;
  onDismiss: () => void;
  dimmed: boolean;
  showUndo: boolean;
  extraCount?: number;
  totalCount?: number;
}) {
  const total = 30; // seconds — must match App.tsx pushUndo()
  const [remaining, setRemaining] = useState(total);

  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((event.expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(t);
        onDismiss();
      }
    }, 200);
    return () => clearInterval(t);
  }, [event.expiresAt, onDismiss]);

  const pct = (remaining / total) * 100;

  return (
    <div
      className={cn(
        "relative flex w-[400px] items-center gap-3 overflow-hidden rounded-lg border border-[#33333c] bg-[#18181c]/95 px-3.5 py-2.5 ring-1 ring-white/[0.02] backdrop-blur-md shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)]",
        dimmed && "pointer-events-none",
      )}
    >
      {/* Progress bar at the bottom (only when fully shown — the back cards
          shouldn't compete visually). */}
      {!dimmed && (
        <span className="absolute bottom-0 left-0 h-px bg-zinc-700" style={{ width: `${pct}%` }} />
      )}

      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1d1d22] ring-1 ring-white/[0.04]">
        <Info className="h-3.5 w-3.5 text-zinc-300" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-[12.5px] text-zinc-100">{event.message}</div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[10.5px] tabular text-zinc-500">
          <span>{`auto-dismisses in ${remaining}s`}</span>
          {totalCount > 1 && (
            <>
              <span className="text-zinc-700">·</span>
              <span>
                {totalCount} stacked{extraCount > 0 ? ` (+${extraCount} hidden)` : ""}
              </span>
            </>
          )}
        </div>
      </div>
      {showUndo && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="motion-soft rounded-md border border-[#383841] bg-[#1d1d23] px-2 py-1 text-[11px] font-medium text-zinc-200 hover:border-[#42424c] hover:bg-[#1d1d24]"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
