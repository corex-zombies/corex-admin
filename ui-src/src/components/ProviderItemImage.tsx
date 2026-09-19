import { useState } from "react";
import {
  Bandage, Beef, Bike, Crosshair, GlassWater, Hammer, Pill,
  ScrollText, Sword, Target, Wrench, Zap,
} from "lucide-react";
import type { Item } from "@/lib/data";
import { imageFor } from "@/lib/itemImages";

const categoryIcon: Record<Item["category"], typeof Crosshair> = {
  pistol: Crosshair,
  smg: Target,
  rifle: Crosshair,
  shotgun: Zap,
  ammo: Sword,
  consumable: Bandage,
  food: Beef,
  drink: GlassWater,
  medical: Pill,
  material: Hammer,
  blueprint: ScrollText,
  vehicle: Bike,
};

type Props = {
  item: Pick<Item, "category" | "imageUrl" | "label">;
  imageClassName?: string;
  fallbackClassName?: string;
  fallbackStrokeWidth?: number;
  loading?: "eager" | "lazy";
};

export function ProviderItemImage(props: Props) {
  const src = imageFor(props.item);
  return <ResolvedProviderItemImage key={src ?? "fallback"} {...props} src={src} />;
}

function ResolvedProviderItemImage({
  item,
  src,
  imageClassName,
  fallbackClassName,
  fallbackStrokeWidth = 1.75,
  loading = "lazy",
}: Props & { src: string | null }) {
  const [errored, setErrored] = useState(false);
  const FallbackIcon = categoryIcon[item.category] ?? Wrench;

  if (errored || !src) {
    return <FallbackIcon className={fallbackClassName} strokeWidth={fallbackStrokeWidth} />;
  }

  return (
    <img
      src={src}
      alt={item.label}
      loading={loading}
      draggable={false}
      onError={() => setErrored(true)}
      className={imageClassName}
    />
  );
}
