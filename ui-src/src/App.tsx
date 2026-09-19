import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { PlayerDrawer, type MoneyInput } from "./components/PlayerDrawer";
import { CommandPalette } from "./components/CommandPalette";
import { UndoToast, type UndoEvent } from "./components/UndoToast";
import { ActionDialog, type ActionKind } from "./components/ActionDialog";
import { OverviewPage } from "./pages/OverviewPage";
import { PlayersPage } from "./pages/PlayersPage";
import { InventoryPage } from "./pages/InventoryPage";
import { BansPage } from "./pages/BansPage";
import { ReportsPage } from "./pages/ReportsPage";
import { WorldPage } from "./pages/WorldPage";
import { LogsPage } from "./pages/LogsPage";
import { StaffPage } from "./pages/StaffPage";
import type { Player } from "./lib/data";
import { api } from "./lib/api";
import type { PageId } from "./lib/nav";

const labels: Record<string, (n: string) => string> = {
  kick:       (n) => `Kicked ${n}.`,
  warn:       (n) => `Warned ${n}.`,
  ban:        (n) => `Banned ${n}.`,
  tp:         (n) => `Teleported to ${n}.`,
  revive:     (n) => `Healed ${n}.`,
  spectate:   (n) => `Spectating ${n} — click again to stop.`,
  money:      (n) => `Gave money to ${n}.`,
  set_money:  (n) => `Set ${n}'s wallet.`,
  give_item:  (n) => `Gave item to ${n}.`,
};

// Actions that fire immediately (no extra input needed).
// Destructive/parameterised actions (warn/kick/ban/money/announce) go through ActionDialog.
async function dispatchInstant(action: string, p: Player, money?: MoneyInput): Promise<void> {
  switch (action) {
    case "revive":   return void (await api.revive(p.id));
    case "tp":       return void (await api.teleport(p.id));
    case "spectate": return void (await api.spectate(p.id));
    case "money":
    case "set_money": {
      if (!money || !Number.isSafeInteger(money.amount) || money.amount < 0
          || (money.kind !== 'cash' && money.kind !== 'bank')) throw new Error('Invalid money input');
      if (action === "money") await api.giveMoney(p.id, money.kind, money.amount);
      else await api.setMoney(p.id, money.kind, money.amount);
      return;
    }
    default: throw new Error('Unsupported action');
  }
}

export default function App() {
  const [page, setPage] = useState<PageId>("overview");
  const [selected, setSelected] = useState<Player | null>(null);
  const [inventoryTarget, setInventoryTarget] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePlayers, setPalettePlayers] = useState<Player[]>([]);
  const [toasts, setToasts] = useState<UndoEvent[]>([]);
  // Lifted action dialog state — opened from drawer/overview/players
  const [actionDialog, setActionDialog] = useState<{ kind: ActionKind; targets: Player[] } | null>(null);
  // Live open-reports counter for the Topbar bell badge.
  const [openReports, setOpenReports] = useState(0);

  useEffect(() => {
    if (!paletteOpen) return;
    let alive = true;
    setPalettePlayers([]);
    api.getPlayers().then(list => { if (alive) setPalettePlayers(list); }).catch(() => {});
    return () => { alive = false; };
  }, [paletteOpen]);

  useEffect(() => {
    let alive = true;
    const tick = () => api.reportsCount().then((n) => { if (alive) setOpenReports(n); }).catch(() => {});
    tick();
    const id = window.setInterval(tick, 15_000);   // poll every 15s; cheap call
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape" && selected) setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const pushUndo = useCallback((message: string) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((t) => [...t, { id, message, expiresAt: Date.now() + 30_000 }]);
  }, []);

  const handleAction = useCallback((action: string, p?: Player, money?: MoneyInput) => {
    if (!p) return;
    if (action === "give_item") {
      setInventoryTarget(p.id); setPage("inventory"); setSelected(null);
      return;
    }
    // Destructive/parameterised actions → open dialog (needs input).
    if (action === "kick" || action === "warn" || action === "ban" || (action === "money" && !money)) {
      setActionDialog({ kind: action, targets: [p] });
      return;
    }
    // Only a successful backend acknowledgement can produce a success toast.
    const label = labels[action]?.(p.name);
    dispatchInstant(action, p, money).then(() => {
      if (label) pushUndo(label);
      if (action === 'revive' || action === 'money' || action === 'set_money') {
        api.getPlayer(p.id).then(updated => {
          setSelected(current => current?.id === p.id && current.identifier === p.identifier
            ? (updated?.identifier === p.identifier ? updated : null) : current);
        }).catch(() => {
          setSelected(current => current?.id === p.id && current.identifier === p.identifier ? null : current);
          pushUndo('Action succeeded, but player data could not be refreshed. Reopen the player to check.');
        });
      }
    }).catch((err) => {
      pushUndo(`Failed: ${err?.message ?? action}`);
    });
  }, [pushUndo]);

  const openAnnounce = useCallback(() => {
    // Announce with no preselected targets = broadcast to everyone.
    setActionDialog({ kind: "announce", targets: [] });
  }, []);

  const handlePaletteAction = useCallback((action: string, p?: Player) => {
    if (action.startsWith("nav:")) {
      setPage(action.slice(4) as PageId);
      return;
    }
    if (action === "open" && p) {
      setSelected(p);
      return;
    }
    // Quick action "Announce to all" doesn't carry a player target — open the
    // broadcast dialog directly. Without this branch the palette item is a
    // no-op (the legacy code only fired when a player was attached).
    if (action === "announce") {
      openAnnounce();
      return;
    }
    if (p) handleAction(action, p);
  }, [handleAction, openAnnounce]);

  return (
    // Outer: full-viewport, transparent so the game stays visible behind the panel.
    // Click outside the window dispatches the close event picked up by main.tsx.
    <div
      className="fixed inset-0 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) window.dispatchEvent(new CustomEvent('corex-admin:close')); }}
    >
      {/* The window — ~60% × 75% of the player's screen, capped to keep content readable on 4K. */}
      <div
        className="relative flex h-[75vh] max-h-[920px] min-h-[600px] w-[min(72vw,1480px)] min-w-[1080px] overflow-hidden rounded-2xl border border-[#2f2f38] bg-[#0e0e11] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        <Sidebar currentPage={page} onNavigate={setPage} />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <Topbar
            onOpenPalette={() => setPaletteOpen(true)}
            onlineCount={0}
            reportsOpen={openReports}
            currentPage={page}
            onOpenReports={() => setPage("reports")}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="w-full px-6 py-5 xl:px-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={page}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{ duration: 0.18, ease: [0.2, 0.4, 0.2, 1] }}
                >
                  {page === "overview"  && <OverviewPage selected={selected} setSelected={setSelected} onPaletteOpen={() => setPaletteOpen(true)} onNavigate={setPage} onAnnounce={openAnnounce} />}
                  {page === "players"   && <PlayersPage onSelect={(p) => setSelected(p)} onAction={handleAction} onAnnounce={openAnnounce} />}
                  {page === "inventory" && <InventoryPage key={inventoryTarget ?? 'default'} initialTargetId={inventoryTarget} />}
                  {page === "bans"      && <BansPage onNavigatePlayers={() => setPage("players")} />}
                  {page === "reports"   && <ReportsPage />}
                  {page === "world"     && <WorldPage />}
                  {page === "logs"      && <LogsPage />}
                  {page === "staff"     && <StaffPage />}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>

        <PlayerDrawer
          player={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
          onOpenInventory={(p) => { setInventoryTarget(p.id); setPage("inventory"); setSelected(null); }}
        />

        {/* Toasts live INSIDE the admin window so they can't spill onto the
            game world behind the panel. The component is absolute-positioned
            at the bottom — clipped to the rounded card. */}
        <UndoToast
          events={toasts}
          onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
        />
      </div>

      {/* Command palette is centred on the viewport (intentional — it's a
          focused overlay), so it stays outside the window box. */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        players={palettePlayers}
        onAction={handlePaletteAction}
      />

      {actionDialog && (
        <ActionDialog
          kind={actionDialog.kind}
          targets={actionDialog.targets}
          onClose={() => setActionDialog(null)}
          onDone={() => {
            const label = labels[actionDialog.kind]?.(actionDialog.targets[0]?.name ?? "everyone");
            if (label) pushUndo(label);
          }}
        />
      )}
    </div>
  );
}
