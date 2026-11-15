"use client"

import { useEffect, useState } from "react"
import { fetchCatalog, type IndexedCatalog } from "@/lib/catalog"
import { hydrateFight, useFight } from "@/lib/store"
import { CatalogProvider } from "@/components/catalog-context"
import { FightView } from "@/components/fight-view"
import { MoveBook } from "@/components/move-book"
import { TeamView } from "@/components/team-view"
import { TypeLab } from "@/components/type-lab"
import { Button } from "@/components/ui/button"

type View = "fight" | "team" | "types" | "moves"

const VIEWS: { id: View; label: string }[] = [
  { id: "fight", label: "Fight" },
  { id: "team", label: "Team" },
  { id: "types", label: "Types" },
  { id: "moves", label: "Moves" },
]

export function SlateApp() {
  const { ready } = useFight()
  const [catalog, setCatalog] = useState<IndexedCatalog | null>(null)
  const [error, setError] = useState(false)
  const [view, setView] = useState<View>("fight")

  useEffect(() => {
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
    }
  }, [])

  if (!ready || !catalog) {
    return (
      <main className="slate-sky flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md">
          <p className="font-heading text-5xl">Slate</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {error ? "The type chart did not load. Refresh the page." : "Opening the type chart…"}
          </p>
        </div>
      </main>
    )
  }

  return (
    <CatalogProvider catalog={catalog}>
      <main className="slate-sky min-h-screen">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6">
          <header className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:mr-auto sm:w-auto">
              <p className="font-heading text-4xl leading-none">Slate</p>
              <p className="mt-1 text-sm text-muted-foreground">Fight coach for Pokémon Revolution Online</p>
            </div>
            <nav className="flex flex-wrap gap-1" aria-label="Sections">
              {VIEWS.map((item) => (
                <Button key={item.id} type="button" size="sm" variant={view === item.id ? "default" : "ghost"} onClick={() => setView(item.id)}>
                  {item.label}
                </Button>
              ))}
            </nav>
            <Button className="w-full sm:w-auto" render={<a href="/overlay" />}>
              Game overlay
            </Button>
          </header>
          <p className="text-sm leading-6 text-muted-foreground">
            Slate does not press buttons in the game. Game overlay is the small panel that stays on top of Pokémon Revolution Online and tells you the click.
          </p>
          {view === "fight" ? <FightView mode="page" /> : null}
          {view === "team" ? <TeamView /> : null}
          {view === "types" ? <TypeLab /> : null}
          {view === "moves" ? <MoveBook /> : null}
          <footer className="pb-6 text-xs leading-5 text-muted-foreground">
            Unofficial fan tool. Not affiliated with Pokémon Revolution Online, Nintendo, Game Freak, or Creatures. Pokémon is their trademark.
            Type matchups follow the Revolution Online chart, including Shadow. Species, moves, and base stats are the standard main-series set from Pokémon Showdown, so a few server-only tutors can differ. You can still type any move in.
          </footer>
        </div>
      </main>
    </CatalogProvider>
  )
}
