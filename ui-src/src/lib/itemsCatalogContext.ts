import { createContext, useContext } from "react";
import { items as mockItems, type Item } from "./data";

export type Catalog = Map<string, Item>;

export const seedCatalog: Catalog = new Map(mockItems.map((item) => [item.id, item]));
export const ItemsContext = createContext<Catalog>(seedCatalog);

export function useItemsCatalog() {
  return useContext(ItemsContext);
}

/** Resolve an item by id. Returns undefined if the catalog doesn't know it. */
export function useItem(id: string | null | undefined): Item | undefined {
  const catalog = useItemsCatalog();
  if (!id) return undefined;
  return catalog.get(id);
}
