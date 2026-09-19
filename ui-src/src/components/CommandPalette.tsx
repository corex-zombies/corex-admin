import { useEffect } from "react";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import {
  Hand, Users, Gavel, Search, Package, MapPin, Megaphone,
} from "lucide-react";
import type { Player } from "@/lib/data";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  players: Player[];
  onAction: (action: string, p?: Player) => void;
};

export function CommandPalette({ open, onClose, players, onAction }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.14, ease: [0.2, 0.4, 0.2, 1] }}
            className="fixed left-1/2 top-[18%] z-[70] w-full max-w-[560px] -translate-x-1/2"
          >
            <Command
              label="Command Menu"
              className="overflow-hidden rounded-xl border border-[#33333c] bg-[#18181c]/95 shadow-2xl ring-1 ring-white/[0.03] backdrop-blur-xl"
              loop
            >
              <div className="flex items-center gap-2.5 border-b border-[#272730] px-3.5 py-3">
                <Search className="h-4 w-4 text-zinc-500" strokeWidth={2} />
                <Command.Input
                  placeholder="Type a command, player name, or ID…"
                  className="flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
                />
                <kbd className="rounded border border-[#33333c] bg-[#1d1d23] px-1.5 py-0 font-mono text-[10px] text-zinc-500">esc</kbd>
              </div>

              <Command.List className="max-h-[420px] overflow-y-auto p-1.5">
                <Command.Empty className="py-8 text-center text-[12px] text-zinc-500">
                  No matches. Try a player name.
                </Command.Empty>

                {/* Navigation — every item here switches to a real page. */}
                <Command.Group heading="Navigate" className="cmdk-heading">
                  <CmdItem icon={Users}   label="Players"   onSelect={() => { onAction("nav:players");   onClose(); }} />
                  <CmdItem icon={Package} label="Inventory" onSelect={() => { onAction("nav:inventory"); onClose(); }} />
                  <CmdItem icon={Gavel}   label="Bans"      onSelect={() => { onAction("nav:bans");      onClose(); }} />
                  <CmdItem icon={MapPin}  label="Reports"   onSelect={() => { onAction("nav:reports");   onClose(); }} />
                </Command.Group>

                <Command.Group heading="Quick actions" className="cmdk-heading">
                  <CmdItem icon={Megaphone} label="Announce to all" onSelect={() => { onAction("announce"); onClose(); }} />
                </Command.Group>

                {/* Live player list — clicking opens that player's drawer. */}
                {players.length > 0 && (
                  <Command.Group heading="Players" className="cmdk-heading">
                    {players.map((p) => (
                      <PlayerCmdItem key={p.id} p={p} onSelect={() => { onAction("open", p); onClose(); }} />
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              <div className="flex items-center justify-between border-t border-[#272730] px-3 py-2 text-[10.5px] text-zinc-500">
                <div className="flex items-center gap-2">
                  <kbd className="rounded border border-[#33333c] bg-[#1d1d23] px-1 py-0 font-mono text-[9.5px]">↑↓</kbd>
                  <span>navigate</span>
                  <span className="text-zinc-700">·</span>
                  <kbd className="rounded border border-[#33333c] bg-[#1d1d23] px-1 py-0 font-mono text-[9.5px]">↵</kbd>
                  <span>run</span>
                </div>
                <span className="font-mono">corex</span>
              </div>
              <style>{`
                .cmdk-heading [cmdk-group-heading] {
                  padding: 6px 8px;
                  font-size: 10px;
                  font-weight: 500;
                  text-transform: uppercase;
                  letter-spacing: 0.08em;
                  color: #52525b;
                }
              `}</style>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CmdItem({ icon: Icon, label, hint, onSelect, tone }: { icon: typeof Hand; label: string; hint?: string; onSelect: () => void; tone?: "good" | "warn" | "danger" }) {
  const toneCls = tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : tone === "danger" ? "text-rose-400" : "text-zinc-400";
  return (
    <Command.Item
      onSelect={onSelect}
      className="group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] text-zinc-300 aria-selected:bg-[#252529] aria-selected:text-zinc-50"
    >
      <Icon className={cn("h-3.5 w-3.5", toneCls)} strokeWidth={1.75} />
      <span className="flex-1">{label}</span>
      {hint && (
        <kbd className="rounded border border-[#33333c] bg-[#1d1d23] px-1 py-0 font-mono text-[9.5px] text-zinc-500">{hint}</kbd>
      )}
    </Command.Item>
  );
}

function PlayerCmdItem({ p, onSelect }: { p: Player; onSelect: () => void }) {
  return (
    <Command.Item
      value={`${p.id} ${p.name}`}
      onSelect={onSelect}
      className="group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] text-zinc-300 aria-selected:bg-[#252529] aria-selected:text-zinc-50"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full",
        p.lifecycle === "active" ? "bg-emerald-400" :
        p.lifecycle === "dead" ? "bg-rose-500" :
        p.lifecycle === "spectating" ? "bg-blue-400" : "bg-amber-400",
      )} />
      <span className="font-mono text-[10.5px] tabular text-zinc-500">#{p.id}</span>
      <span className="flex-1 truncate">{p.name}</span>
      <span className="font-mono text-[10.5px] tabular text-zinc-600">{p.ping}ms</span>
    </Command.Item>
  );
}
