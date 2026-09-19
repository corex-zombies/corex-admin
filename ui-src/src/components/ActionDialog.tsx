import { useEffect, useRef, useState } from "react";
import {
  X, Hand, Ban, Coins, Send, AlertTriangle,
} from "lucide-react";
import { Avatar } from "./Avatar";
import type { Player } from "@/lib/data";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

export type ActionKind = "warn" | "ban" | "kick" | "money" | "announce";

type Props = {
  kind: ActionKind;
  targets: Player[];   // 1+ players. UI adapts copy ("1 player" vs "N players").
  onClose: () => void;
  onDone: () => void;   // called after a successful api call
};

const meta: Record<ActionKind, { title: string; desc: string; accent: "amber"|"rose"|"emerald"|"blue"; icon: typeof Hand; confirm: string }> = {
  warn:     { title: "Warn",        desc: "Logs a formal warning. The player gets an in-game notice and 1 warning is added to their record.", accent: "amber",   icon: Hand,  confirm: "Issue warning" },
  ban:      { title: "Ban",         desc: "Disconnects the player immediately and blocks reconnection for the chosen duration.",               accent: "rose",    icon: Ban,   confirm: "Ban now" },
  kick:     { title: "Kick",        desc: "Disconnects the player. They can reconnect immediately; the kick is logged.",                       accent: "amber",   icon: Hand,  confirm: "Kick player" },
  money:    { title: "Give money",  desc: "Adds the amount to each player's cash or bank balance. Logged as an admin transaction.",            accent: "emerald", icon: Coins, confirm: "Send funds" },
  announce: { title: "Send DM",     desc: "Sends a private in-game message. Only the selected players (or everyone, if none selected) see it.", accent: "blue",   icon: Send,  confirm: "Send message" },
};

const accentRing: Record<string, string> = {
  amber:   "bg-amber-500/10 ring-amber-500/20 text-amber-300",
  rose:    "bg-rose-500/10 ring-rose-500/20 text-rose-300",
  emerald: "bg-emerald-500/10 ring-emerald-500/20 text-emerald-300",
  blue:    "bg-blue-500/10 ring-blue-500/20 text-blue-300",
};
const accentBtn: Record<string, string> = {
  amber:   "bg-amber-500 text-zinc-950 hover:bg-amber-400",
  rose:    "bg-rose-500 text-white hover:bg-rose-400",
  emerald: "bg-emerald-500 text-zinc-950 hover:bg-emerald-400",
  blue:    "bg-zinc-100 text-zinc-900 hover:bg-white",
};

export function ActionDialog({ kind, targets, onClose, onDone }: Props) {
  const M = meta[kind];
  const Icon = M.icon;

  const [reason, setReason]           = useState("");
  const [message, setMessage]         = useState("");
  const [banDuration, setBanDuration] = useState<"1h"|"24h"|"7d"|"30d"|"perma">("7d");
  const [moneyType, setMoneyType]     = useState<"cash"|"bank">("cash");
  const [moneyAmount, setMoneyAmount] = useState(1000);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const broadcastAll = kind === "announce" && targets.length === 0;
  const targetCount = broadcastAll ? "All online" : `${targets.length} player${targets.length === 1 ? "" : "s"}`;

  const canConfirm = (() => {
    if (submitting || attempted.current) return false;
    if (kind === "warn" || kind === "kick" || kind === "ban") {
      if (!reason.trim()) return false;
      if (targets.length === 0) return false;
    }
    if (kind === "announce" && !message.trim()) return false;
    if (kind === "money" && (moneyAmount <= 0 || targets.length === 0)) return false;
    return true;
  })();

  const handleConfirm = async () => {
    if (!canConfirm || attempted.current) return;
    attempted.current = true;
    setSubmitting(true);
    setError(null);
    const confirmed: number[] = [];
    let pending: number | null = null;
    try {
      if (kind === "announce") {
        await api.announce(message, broadcastAll ? undefined : targets.map((x) => x.id));
      } else {
        for (const t of targets) {
          pending = t.id;
          switch (kind) {
            case "warn":  await api.warn(t.id, reason); break;
            case "kick":  await api.kick(t.id, reason); break;
            case "ban":   await api.banCreate(t.id, banDuration, reason); break;
            case "money": await api.giveMoney(t.id, moneyType, moneyAmount); break;
          }
          confirmed.push(t.id);
        }
      }
      onDone();
      onClose();
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Action failed";
      setError(`${detail}. Confirmed: ${confirmed.length ? confirmed.map(id => `#${id}`).join(", ") : "none"}. ` +
        `${pending !== null ? `Stopped at #${pending}. ` : ""}Check the action log and current state before submitting again; an unconfirmed reply does not prove the action was rolled back.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[520px] overflow-hidden rounded-xl border border-[#33333c] bg-[#16161a] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7)]">
        {/* Header */}
        <header className="flex items-start gap-3 border-b border-[#272730] bg-[#18181c] px-4 py-3.5">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", accentRing[M.accent])}>
            <Icon className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-medium text-zinc-50">{M.title}</h3>
              <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tabular ring-1 ring-inset", accentRing[M.accent])}>
                {targetCount}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">{M.desc}</p>
          </div>
          <button onClick={onClose} className="motion-soft -mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-[#252529] hover:text-zinc-200">
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </header>

        {/* Body */}
        <div className="space-y-4 p-4">
          {kind === "ban" && (
            <Field label="Duration">
              <div className="flex flex-wrap gap-1.5">
                {(["1h","24h","7d","30d","perma"] as const).map((d) => (
                  <Pill key={d} active={banDuration === d} onClick={() => setBanDuration(d)}>{d}</Pill>
                ))}
              </div>
            </Field>
          )}

          {(kind === "warn" || kind === "kick" || kind === "ban") && (
            <Field label="Reason" required>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={kind === "ban"  ? "e.g. RDM × 4 — rule 3.2 — clip attached"
                          : kind === "kick" ? "e.g. AFK in safe zone"
                                            : "e.g. combat in safe zone — rule 4.1"}
                rows={3}
                className="w-full resize-none rounded-md border border-[#2f2f38] bg-[#18181c] px-2.5 py-2 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[#46464e]"
                autoFocus
              />
            </Field>
          )}

          {kind === "money" && (
            <>
              <Field label="Account">
                <div className="flex gap-1.5">
                  <Pill icon={Coins} active={moneyType === "cash"} onClick={() => setMoneyType("cash")}>Cash</Pill>
                  <Pill icon={Coins} active={moneyType === "bank"} onClick={() => setMoneyType("bank")}>Bank</Pill>
                </div>
              </Field>
              <Field label="Amount">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 items-center rounded-md border border-[#2f2f38] bg-[#18181c] focus-within:border-[#46464e]">
                    <span className="pl-2.5 font-mono text-[12.5px] text-zinc-500">$</span>
                    <input type="number" value={moneyAmount}
                      onChange={(e) => setMoneyAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-32 bg-transparent px-2 py-1.5 font-mono text-[13px] tabular text-zinc-100 outline-none" />
                  </div>
                  {[100, 1000, 10_000].map((q) => (
                    <button key={q} onClick={() => setMoneyAmount(q)} className="motion-soft rounded-md border border-[#2f2f38] bg-[#18181c] px-2 py-1 font-mono text-[11px] tabular text-zinc-400 hover:border-[#383841] hover:text-zinc-200">
                      ${q.toLocaleString()}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {kind === "announce" && (
            <Field label="Message" required>
              <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 280))} placeholder="e.g. Server restarting in 5 minutes." rows={4}
                className="w-full resize-none rounded-md border border-[#2f2f38] bg-[#18181c] px-2.5 py-2 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[#46464e]"
                autoFocus />
              <div className="mt-1 text-right font-mono text-[10px] tabular text-zinc-600">{message.length}/280</div>
            </Field>
          )}

          {/* Targets preview */}
          {!broadcastAll && (
            <Field label="Recipients">
              <div className="rounded-lg border border-[#272730] bg-[#101013] p-2">
                {targets.length === 0 ? (
                  <div className="flex items-center gap-2 px-1 py-2 text-[11.5px] text-zinc-500">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" strokeWidth={2} />
                    No players selected.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {targets.slice(0, 10).map((t) => (
                      <span key={t.id} className="inline-flex items-center gap-1.5 rounded-md bg-[#16161a] py-0.5 pl-0.5 pr-2 ring-1 ring-[#272730]">
                        <Avatar name={t.name} id={t.id} mugshot={t.mugshot} size="xs" />
                        <span className="font-mono text-[10px] text-zinc-500">#{t.id}</span>
                        <span className="text-[11.5px] text-zinc-200">{t.name.split(" ")[0]}</span>
                      </span>
                    ))}
                    {targets.length > 10 && (
                      <span className="inline-flex items-center rounded-md bg-[#16161a] px-2 py-1 font-mono text-[10.5px] text-zinc-500 ring-1 ring-[#272730]">
                        +{targets.length - 10} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Field>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-rose-700/40 bg-rose-950/40 px-3 py-2 text-[11.5px] text-rose-300">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-2 border-t border-[#272730] bg-[#101013] px-3 py-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[10.5px] tabular text-zinc-600">
            <kbd className="rounded border border-[#33333c] bg-[#18181c] px-1 py-0 text-[9.5px]">esc</kbd>
            <span>to cancel</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={submitting} className="motion-soft h-8 rounded-md border border-[#2f2f38] bg-[#18181c] px-3 text-[12px] text-zinc-300 hover:border-[#383841] hover:text-zinc-100 disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={!canConfirm}
              className={cn("motion-soft flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-40", accentBtn[M.accent])}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              {submitting ? "Working…" : M.confirm}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-3">
      <div className="pt-2 text-[11.5px] font-medium text-zinc-400">
        {label}{required && <span className="ml-0.5 text-rose-400">*</span>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Pill({ children, active, onClick, icon: Icon }: { children: React.ReactNode; active?: boolean; onClick: () => void; icon?: typeof Coins }) {
  return (
    <button type="button" onClick={onClick} className={cn(
      "motion-soft flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px]",
      active ? "border-zinc-500 bg-[#252529] text-zinc-50" : "border-[#2f2f38] bg-[#18181c] text-zinc-400 hover:border-[#383841] hover:text-zinc-200",
    )}>
      {Icon && <Icon className="h-3 w-3" strokeWidth={2.25} />}
      <span className="font-mono tabular">{children}</span>
    </button>
  );
}
