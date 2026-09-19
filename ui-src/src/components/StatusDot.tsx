import { cn } from "@/lib/cn";
import type { LifecycleState } from "@/lib/data";
import { statusColor, statusLabel } from "@/lib/statusMeta";

export function StatusDot({ state, className }: { state: LifecycleState; className?: string }) {
  return (
    <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", statusColor(state), className)} aria-label={statusLabel(state)} />
  );
}
