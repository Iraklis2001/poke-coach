"use client"

import { useEffect, useState } from "react"
import { fetchCatalog, type IndexedCatalog } from "@/lib/catalog"
import { hydrateFight, useFight } from "@/lib/store"
import { CatalogProvider } from "@/components/catalog-context"
import { CoachPanel } from "@/components/overlay/coach-panel"
import { PanelShell } from "@/components/overlay/panel-shell"

export function HudApp() {
  const { ready } = useFight()
  const [catalog, setCatalog] = useState<IndexedCatalog | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add("hud-root")
    hydrateFight()
    let cancelled = false
    fetchCatalog()
      .then((loaded) => {
        if (!cancelled) setCatalog(loaded)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
      document.documentElement.classList.remove("hud-root")
    }
  }, [])

  if (!ready || !catalog) {
    return (
      <div className="p-2">
        <PanelShell>
          <header className="hud-drag border-b-2 border-black bg-[#e3350d] px-3 py-1.5">
            <p className="text-[13px] font-bold text-white">Slate</p>
          </header>
          <p className="px-3 py-4 text-[13px] text-black">{error ? "The type chart did not load." : "Opening…"}</p>
        </PanelShell>
      </div>
    )
  }

  return (
    <CatalogProvider catalog={catalog}>
      <CoachPanel />
    </CatalogProvider>
  )
}
