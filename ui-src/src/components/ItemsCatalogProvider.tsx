import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import {
  ItemsContext,
  seedCatalog,
  type Catalog,
} from "@/lib/itemsCatalogContext";

export function ItemsCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(seedCatalog);

  useEffect(() => {
    let alive = true;
    api.getItems()
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        setCatalog(new Map(list.map((item) => [item.id, item])));
      })
      .catch(() => { /* production seed is empty; never substitute sample items */ });
    return () => { alive = false; };
  }, []);

  return <ItemsContext.Provider value={catalog}>{children}</ItemsContext.Provider>;
}
