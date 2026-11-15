"use client"

import { createContext, useContext } from "react"
import type { IndexedCatalog } from "@/lib/catalog"

const CatalogContext = createContext<IndexedCatalog | null>(null)

export function CatalogProvider({
  catalog,
  children,
}: {
  catalog: IndexedCatalog
  children: React.ReactNode
}) {
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const catalog = useContext(CatalogContext)
  if (!catalog) throw new Error("The battle catalog is not loaded.")
  return catalog
}
