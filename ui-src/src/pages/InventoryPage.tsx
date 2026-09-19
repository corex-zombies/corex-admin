import { useMemo, useState, useRef, useEffect } from "react";
import {
  Search, Plus, Trash2, Package, X, ChevronDown,
  Coins, Weight, AlertTriangle,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ItemIcon } from "@/components/ItemIcon";
import { ProviderItemImage } from "@/components/ProviderItemImage";
import { StatusDot } from "@/components/StatusDot";
import { PageHeader } from "@/components/PageHeader";
import {
  players as mockPlayers,
  categoryLabels, rarityMeta, type Player, type Item, type ItemCategory, type InventorySlot,
} from "@/lib/data";
import { api } from "@/lib/api";
import { useItemsCatalog } from "@/lib/itemsCatalogContext";
import { statusLabel } from "@/lib/statusMeta";
import { cn } from "@/lib/cn";

const FALLBACK_GRID_SLOTS = 80; // matches corex-inventory's default 8×10 grid
const fmt = (n: number) => n.toLocaleString("en-US");

export function InventoryPage({ initialTargetId = null }: { initialTargetId?: number | null }) {
  const catalog = useItemsCatalog();
  const allItems: Item[] = Array.from(catalog.values());

  const [q, setQ] = useState("");
  const [allPlayers, setAllPlayers] = useState<Player[]>(mockPlayers);
  const [selectedId, setSelectedId] = useState<number | null>(initialTargetId ?? mockPlayers[0]?.id ?? null);
  // Live grid size pulled from corex-inventory's Config.GridWidth × GridHeight.
  // Falls back to 80 so admins don't see a "0 slots" state if the overview
  // call hasn't resolved yet.
  const [gridSlots, setGridSlots] = useState<number>(FALLBACK_GRID_SLOTS);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const mutationPending = useRef(false);
  // Last server-confirmed contents; never invent a successful item mutation.
  const [invMap, setInvMap] = useState<Record<number, InventorySlot[]>>(() =>
    Object.fromEntries(mockPlayers.map((p) => [p.id, [...p.inventory]])),
  );

  // Fetch live players on mount; pull each selected player's full inventory on selection.
  useEffect(() => {
    let alive = true;
    api.getPlayers()
      .then((list) => {
        if (!alive) return;
        setAllPlayers(list);
        setInvMap((prev) => {
          const next = { ...prev };
          list.forEach((p) => { if (!next[p.id]) next[p.id] = p.inventory ?? []; });
          return next;
        });
        if (list.length > 0 && selectedId === null) {
          setSelectedId(list[0].id);
        }
      })
      .catch(() => { /* api logs the failure */ });
    api.getOverview()
      .then((ov) => { if (alive && ov.inventory?.gridSize) setGridSlots(ov.inventory.gridSize); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    let currentSelection = true;
    setLoading(true);
    setActionError(null);
    api.getPlayer(selectedId).then(player => {
      if (!currentSelection) return;
      if (!player) throw new Error("Selected player is no longer online");
      setInvMap(m => ({...m, [selectedId]: player.inventory ?? []}));
      setAllPlayers(list => list.map(p => p.id === selectedId ? player : p));
      setLoading(false);
    }).catch(error => {
      if (currentSelection) setActionError(error instanceof Error ? error.message : "Inventory could not be loaded");
    });
    return () => { currentSelection = false; };
  }, [selectedId]);

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return allPlayers.filter((p) => !q || p.name.toLowerCase().includes(lower) || String(p.id).includes(lower) || p.identifier.toLowerCase().includes(lower));
  }, [q, allPlayers]);

  const selected = allPlayers.find((p) => p.id === selectedId);
  const inv = selected ? (invMap[selected.id] ?? []) : [];
  const totalWeight = inv.reduce((s, slot) => s + ((catalog.get(slot.itemId)?.weight ?? 0) * slot.count), 0);
  const used = inv.length;

  const mutateInventory = async (operations: Array<() => Promise<unknown>>) => {
    if (!selected || mutationPending.current || loading) return;
    const id = selected.id;
    mutationPending.current = true;
    setMutating(true);
    setActionError(null);
    try {
      for (const operation of operations) await operation();
    } catch (error) {
      setActionError(`${error instanceof Error ? error.message : "Inventory action failed"}. The operation stopped; check the refreshed inventory and action log before trying again.`);
    } finally {
      try {
        const current = await api.getPlayer(id);
        if (!current) throw new Error("Player is no longer online");
        setInvMap(m => ({...m, [id]: current.inventory ?? []}));
        setAllPlayers(list => list.map(p => p.id === id ? current : p));
      } catch {
        setActionError(previous => `${previous ?? ""} Inventory refresh failed; contents shown may be stale. Reopen the editor before making another change.`);
        setLoading(true);
      }
      mutationPending.current = false;
      setMutating(false);
    }
  };

  const giveItem = (item: Item, count: number) => {
    if (!selected || !Number.isSafeInteger(count) || count <= 0) return;
    const id = selected.id;
    void mutateInventory([() => api.giveItem(id, item.id, count)]);
  };

  const removeSlot = (idx: number) => {
    if (!selected) return;
    const id = selected.id;
    const slot = inv[idx];
    if (slot) void mutateInventory([() => api.removeItem(id, slot.itemId, slot.count)]);
  };

  const clearAll = () => {
    if (!selected) return;
    const id = selected.id;
    void mutateInventory(inv.map(slot => () => api.removeItem(id, slot.itemId, slot.count)));
  };

  // Empty state when there are no players online (production with no live data yet).
  if (!selected) {
    return (
      <>
        <PageHeader
          title="Inventory editor"
          description="Pick a player, then add or remove items from their stash."
        />
        <div className="flex h-[400px] items-center justify-center rounded-xl border border-[#252529] bg-[#121216]">
          <div className="text-center">
            <Package className="mx-auto h-8 w-8 text-zinc-600" strokeWidth={1.5} />
            <div className="mt-2 text-[13px] font-medium text-zinc-300">No players online</div>
            <div className="mt-1 text-[11.5px] text-zinc-500">When a player connects they'll appear here.</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Inventory editor"
        description="Pick a player, then add or remove items from their stash. Mirrors the live corex-inventory."
      />

      <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-4">
        {/* Player picker */}
        <aside className="overflow-hidden rounded-xl border border-[#252529] bg-[#121216]">
          <div className="border-b border-[#1d1d23] p-2">
            <div className="flex h-7 items-center gap-1.5 rounded-md border border-[#2a2a32] bg-[#141418] px-2">
              <Search className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find player…" className="w-full bg-transparent text-[12px] text-zinc-200 placeholder:text-zinc-600" />
            </div>
          </div>
          <ul className="max-h-[calc(100vh-260px)] divide-y divide-[#1d1d22] overflow-y-auto">
            {filtered.map((p) => {
              const active = p.id === selectedId;
              const pInv = invMap[p.id] ?? [];
              return (
                <li key={p.id}>
                  <button
                    disabled={mutating}
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "motion-soft flex w-full items-center gap-2.5 px-3 py-2 text-left",
                      active ? "bg-[#201d2a]" : "hover:bg-[#18181c]",
                    )}
                  >
                    <Avatar name={p.name} id={p.id} mugshot={p.mugshot} loadingHint={!p.mugshot} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] tabular text-zinc-500">#{p.id}</span>
                        <span className={cn("truncate text-[12px] font-medium", active ? "text-zinc-50" : "text-zinc-200")}>
                          {p.name}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] tabular text-zinc-500">
                        <StatusDot state={p.lifecycle} />
                        <span>{pInv.length}/{gridSlots} slots</span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Editor */}
        <fieldset disabled={loading || mutating} className="min-w-0 space-y-4">
          {actionError && <div role="alert" className="rounded-md border border-rose-700/40 bg-rose-950/40 p-3 text-sm text-rose-300">{actionError}</div>}
          {loading && !actionError && <p role="status">Loading current inventory…</p>}
          {mutating && <p role="status">Applying change and refreshing inventory…</p>}
          {/* Player summary header */}
          <header className="flex items-center justify-between gap-4 rounded-xl border border-[#252529] bg-[#141418] p-3.5">
            <div className="flex items-center gap-3">
              <Avatar name={selected.name} id={selected.id} mugshot={selected.mugshot} loadingHint={!selected.mugshot} size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-medium text-zinc-50">{selected.name}</span>
                  <span className="font-mono text-[11px] tabular text-zinc-500">#{selected.id}</span>
                  <StatusDot state={selected.lifecycle} />
                  <span className="text-[11px] text-zinc-500">{statusLabel(selected.lifecycle)}</span>
                </div>
                <div className="mt-0.5 font-mono text-[10.5px] text-zinc-600">{selected.identifier}</div>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <SummaryStat label="Cash"   value={`$${fmt(selected.cash)}`} icon={Coins} />
              <SummaryStat label="Bank"   value={`$${fmt(selected.bank)}`} icon={Coins} />
              <SummaryStat label="Slots"  value={`${used} / ${gridSlots}`} icon={Package} tone={used >= gridSlots ? "warn" : undefined} />
              <SummaryStat label="Weight" value={`${totalWeight.toFixed(1)} kg`} icon={Weight} />
            </div>
          </header>

          {/* Give-item form */}
          <GiveItemForm onGive={giveItem} allItems={allItems} />

          {/* Inventory grid */}
          <section className="overflow-hidden rounded-xl border border-[#252529] bg-[#121216]">
            <header className="flex items-center justify-between border-b border-[#1d1d23] px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-[12.5px] font-medium text-zinc-200">Inventory</h3>
                <span className="font-mono text-[10.5px] tabular text-zinc-500">{used} of {gridSlots}</span>
              </div>
              <button onClick={clearAll} disabled={inv.length === 0} className="motion-soft flex h-7 items-center gap-1.5 rounded-md border border-rose-900/40 bg-rose-950/30 px-2.5 text-[11.5px] text-rose-300 hover:border-rose-800/60 hover:bg-rose-950/50 disabled:opacity-40 disabled:cursor-not-allowed">
                <Trash2 className="h-3 w-3" strokeWidth={2} />
                Clear inventory
              </button>
            </header>

            <div className="grid grid-cols-6 gap-2 p-3.5">
              {Array.from({ length: gridSlots }, (_, i) => {
                const slot = inv[i];
                if (!slot) return <EmptySlot key={i} />;
                const item = catalog.get(slot.itemId);
                if (!item) return (
                  <div key={i} className="flex aspect-square min-w-0 flex-col justify-between rounded-md border border-amber-700/40 bg-[#141418] p-2 text-xs">
                    <span className="break-all text-zinc-200">{slot.itemId}</span>
                    <span className="text-amber-300">×{slot.count} · Item details unavailable</span>
                    <button className="text-left text-rose-300" onClick={() => removeSlot(i)}>Remove</button>
                  </div>
                );
                return <FilledSlot key={i} item={item} count={slot.count} onRemove={() => removeSlot(i)} />;
              })}
            </div>
          </section>
        </fieldset>
      </div>
    </>
  );
}

function SummaryStat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Coins; tone?: "warn" }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500">
        <Icon className="h-2.5 w-2.5" strokeWidth={2} />
        {label}
      </div>
      <div className={cn("mt-0.5 font-mono text-[13px] font-medium tabular", tone === "warn" ? "text-amber-300" : "text-zinc-100")}>
        {value}
      </div>
    </div>
  );
}

function GiveItemForm({ onGive, allItems }: { onGive: (item: Item, count: number) => void; allItems: Item[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ItemCategory | "all">("all");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [amount, setAmount] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return allItems.filter((it) =>
      (!q || it.label.toLowerCase().includes(lower) || it.id.toLowerCase().includes(lower))
      && (cat === "all" || it.category === cat)
    );
  }, [q, cat, allItems]);

  const submit = () => {
    if (!selectedItem || amount <= 0) return;
    onGive(selectedItem, amount);
    setSelectedItem(null);
    setAmount(1);
    setOpen(false);
  };

  const maxAmount = selectedItem?.stackable ? (selectedItem.maxStack ?? 100) : 10;

  return (
    <section className="rounded-xl border border-[#252529] bg-[#121216]">
      <header className="flex items-center justify-between rounded-t-xl border-b border-[#1d1d23] bg-[#0e0e11]/40 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.25} />
          <h3 className="text-[12.5px] font-medium text-zinc-200">Give item</h3>
          {selectedItem && (
            <span className="rounded-full bg-emerald-500/[0.08] px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-tight text-emerald-300 ring-1 ring-emerald-500/20">
              ready
            </span>
          )}
        </div>
        <span className="font-mono text-[10.5px] tabular text-zinc-600">pulls from corex-inventory · {allItems.length} items</span>
      </header>

      <div className="flex flex-wrap items-center gap-2 p-3">
        <div ref={wrapRef} className="relative flex-1 min-w-[320px]">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "motion-soft flex h-9 w-full items-center gap-2.5 rounded-md border bg-[#141418] px-2.5 text-left",
              open
                ? "border-[#46464e]"
                : "border-[#2f2f38] hover:border-[#383841]",
            )}
          >
            {selectedItem ? (
              <>
                <ItemIcon item={selectedItem} size="sm" />
                <span className="truncate text-[12.5px] font-medium text-zinc-100">
                  {selectedItem.label}
                </span>
                <span className={cn(
                  "rounded-sm px-1 py-0 font-mono text-[9px] font-semibold uppercase tracking-tight ring-1 ring-inset",
                  rarityMeta[selectedItem.rarity].color,
                  rarityMeta[selectedItem.rarity].bg,
                  rarityMeta[selectedItem.rarity].ring,
                )}>
                  {rarityMeta[selectedItem.rarity].label}
                </span>
                <span className="ml-auto font-mono text-[10px] tabular text-zinc-600">
                  {categoryLabels[selectedItem.category]} · {selectedItem.weight}kg
                </span>
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedItem(null); setAmount(1); }}
                  className="motion-soft flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-[#252529] hover:text-rose-300"
                  title="Clear selection"
                >
                  <X className="h-3 w-3" strokeWidth={2.25} />
                </span>
              </>
            ) : (
              <>
                <Package className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
                <span className="flex-1 text-[12.5px] text-zinc-500">Pick an item…</span>
              </>
            )}
            <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-500 transition-transform", open && "rotate-180")} strokeWidth={2} />
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-[44px] z-30 overflow-hidden rounded-xl border border-[#33333c] bg-[#18181c] shadow-2xl">
              <div className="flex h-9 items-center gap-1.5 border-b border-[#272730] px-2.5">
                <Search className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" className="w-full bg-transparent text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600" autoFocus />
              </div>
              <div className="flex flex-wrap gap-1 border-b border-[#272730] p-2">
                <CatChip active={cat === "all"} onClick={() => setCat("all")}>all</CatChip>
                {(Object.keys(categoryLabels) as ItemCategory[]).map((c) => (
                  <CatChip key={c} active={cat === c} onClick={() => setCat(c)}>{categoryLabels[c]}</CatChip>
                ))}
              </div>
              <ul className="max-h-[280px] overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-6 text-center text-[12px] text-zinc-500">No matches.</li>
                ) : filtered.map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => { setSelectedItem(it); setOpen(false); setAmount(1); }}
                      className="motion-soft flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-[#1d1d24]"
                    >
                      <ItemIcon item={it} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[12px] font-medium text-zinc-100">{it.label}</span>
                          <span className={cn("rounded-sm px-1 py-0 font-mono text-[9px] font-semibold uppercase tracking-tight ring-1 ring-inset", rarityMeta[it.rarity].color, rarityMeta[it.rarity].bg, rarityMeta[it.rarity].ring)}>
                            {rarityMeta[it.rarity].label}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-zinc-600">
                          {it.id} · {categoryLabels[it.category]} · {it.weight} kg
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <label className="flex h-9 items-center gap-2 rounded-md border border-[#2f2f38] bg-[#141418] px-2.5">
          <span className="text-[11.5px] text-zinc-500">Amount</span>
          <input
            type="number"
            min={1}
            max={maxAmount}
            value={amount}
            disabled={!selectedItem}
            onChange={(e) => setAmount(Math.max(1, Math.min(maxAmount, parseInt(e.target.value) || 1)))}
            className="w-16 bg-transparent text-center font-mono text-[12.5px] tabular text-zinc-100 outline-none disabled:opacity-40"
          />
        </label>

        <button
          onClick={submit}
          disabled={!selectedItem}
          className="motion-soft flex h-9 items-center gap-1.5 rounded-md border border-emerald-700/50 bg-emerald-500/[0.08] px-3 text-[12px] font-medium text-emerald-300 hover:border-emerald-600/60 hover:bg-emerald-500/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Give to player
        </button>
      </div>
    </section>
  );
}

function CatChip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn(
      "motion-soft rounded-md border px-2 py-0.5 text-[11px]",
      active ? "border-zinc-600 bg-[#252529] text-zinc-100" : "border-[#2f2f38] bg-[#141418] text-zinc-400 hover:border-[#383841] hover:text-zinc-200",
    )}>
      {children}
    </button>
  );
}

function EmptySlot() {
  return <div className="aspect-square rounded-md border border-dashed border-[#252529] bg-[#18181c]/40" />;
}

function FilledSlot({ item, count, onRemove }: { item: Item; count: number; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);
  const r = rarityMeta[item.rarity];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "motion-soft group relative aspect-square overflow-hidden rounded-md border bg-[#141418] ring-1 ring-inset",
        r.ring,
        "border-[#2c2c33] hover:border-zinc-700",
      )}
    >
      {/* Subtle rarity tint behind the image — gives the slot personality */}
      <div className={cn("pointer-events-none absolute inset-0 opacity-40", r.bg)} />

      {/* Top-right count badge */}
      {count > 1 && (
        <span className="absolute right-1.5 top-1.5 z-10 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular text-zinc-50 ring-1 ring-white/[0.06]">
          ×{count}
        </span>
      )}

      {/* Big image — fills the slot, label sits at bottom */}
      <div className="relative flex h-full w-full flex-col p-1.5">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <ProviderItemImage
            item={item}
            fallbackClassName={cn("h-1/2 w-1/2", r.color)}
            fallbackStrokeWidth={1.5}
            imageClassName="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
          />
        </div>
        <div className="line-clamp-1 pt-1 text-center text-[10.5px] font-medium text-zinc-200">
          {item.label}
        </div>
      </div>

      {/* Hover remove */}
      {hovered && (
        <button
          onClick={onRemove}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-rose-950/85 text-rose-200 hover:bg-rose-900/90"
        >
          <X className="h-5 w-5" strokeWidth={2} />
          <span className="text-[11px] font-medium">Remove</span>
        </button>
      )}
    </div>
  );
}

// suppress unused import warning for AlertTriangle (kept for future "illegal" warnings)
void AlertTriangle;
