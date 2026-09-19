import type { LifecycleState } from "./data";

const statusMeta: Record<LifecycleState, { color: string; label: string }> = {
  loading: { color: "bg-amber-400", label: "Loading" },
  active: { color: "bg-emerald-400", label: "Active" },
  dead: { color: "bg-rose-500", label: "Dead" },
  spectating: { color: "bg-blue-400", label: "Spectating" },
};

export function statusLabel(state: LifecycleState) {
  return statusMeta[state].label;
}

export function statusColor(state: LifecycleState) {
  return statusMeta[state].color;
}
