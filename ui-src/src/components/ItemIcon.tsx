import { cn } from "@/lib/cn";
import { rarityMeta, type Item } from "@/lib/data";
import { useItem } from "@/lib/itemsCatalogContext";
import { ProviderItemImage } from "./ProviderItemImage";

type Props = {
  item: Item;
  size?: "sm" | "md" | "lg";
  showRarityRing?: boolean;
  className?: string;
};

export function ItemIcon({ item, size = "md", showRarityRing = true, className }: Props) {
  // Resolve against the live catalog so the `image` field is always current,
  // even if the caller passed a stale Item snapshot from mock data.
  const live = useItem(item.id) ?? item;
  const r = rarityMeta[live.rarity ?? item.rarity];
  const sz = { sm: "h-7 w-7", md: "h-10 w-10", lg: "h-12 w-12" }[size];
  const iconSize = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" }[size];
  const imgPad = { sm: "p-0.5", md: "p-1", lg: "p-1" }[size];

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-md ring-1 ring-inset",
        sz,
        r.bg,
        showRarityRing ? r.ring : "ring-[#2f2f38]",
        className,
      )}
      title={`${live.label ?? item.label} · ${r.label.toLowerCase()}`}
    >
      <ProviderItemImage
        item={{ ...live, label: live.label ?? item.label }}
        fallbackClassName={cn(iconSize, r.color)}
        imageClassName={cn("h-full w-full object-contain", imgPad)}
      />
    </span>
  );
}
