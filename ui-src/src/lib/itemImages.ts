import type { Item } from "./data";
import { IS_NUI } from "./nui";

/** Return only the fully resolved URL supplied by the selected inventory. */
export function imageFor(item: Pick<Item, "imageUrl">): string | null {
  if (!IS_NUI) return null;
  return item.imageUrl || null;
}
