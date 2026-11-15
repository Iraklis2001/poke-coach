"use client"

import { useMemo, useState } from "react"
import { searchMoves } from "@/lib/catalog"
import { offensiveList } from "@/lib/typechart"
import { TYPES } from "@/lib/types"
import { useCatalog } from "@/components/catalog-context"
import { TypeChip } from "@/components/type-chip"
import { Input } from "@/components/ui/input"
import { cn } from "cn"

export function MoveBook() {
  const catalog = useCatalog()
  const [query, setQuery] = useState("flamethrower")
  const [type, setType] = useState<string | null>(null)
  const [selected, setSelected] = useState("flamethrower")
  const results = useMemo(() => {
    const found = query.trim() ? searchMoves(catalog, query, null, 30).known : catalog.moves.slice(0, 30)
    return found.filter((move) => !type || move.type === type).slice(0, 24)
  }, [catalog, query, type])
  const move = catalog.moveById.get(selected) ?? results[0]
  const chart = move ? offensiveList(move.type) : []

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-4xl leading-none">Moves</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Power, accuracy, and who the move is good into. On Revolution Online, Hidden Power keeps the type shown in the summary and is always 60 power.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-border bg-card/80 p-4">
          <label className="text-xs font-medium tracking-wide text-muted-foreground" htmlFor="move-search">
            Search
            <Input
              id="move-search"
              className="mt-1 h-10 bg-background/70"
              value={query}
              placeholder="Earthquake, Will-O-Wisp, Roost"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setType(null)} className={cn("rounded-full px-2 py-1 text-xs", type === null ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
              All types
            </button>
            {TYPES.map((entry) => (
              <button key={entry} type="button" onClick={() => setType(entry)} className={cn(type === entry && "ring-2 ring-[#e25b2a] ring-offset-2 ring-offset-card rounded-full")}>
                <TypeChip type={entry} />
              </button>
            ))}
          </div>
          <ul className="mt-4 divide-y divide-border">
            {results.map((entry) => (
              <li key={entry.id}>
                <button type="button" className="flex w-full items-baseline justify-between gap-3 py-2 text-left" onClick={() => setSelected(entry.id)}>
                  <span className={cn("font-medium", entry.id === move?.id && "text-[#e25b2a]")}>{entry.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.type} · {entry.category} · {entry.bp || "varies"}
                  </span>
                </button>
              </li>
            ))}
            {results.length === 0 ? <li className="py-6 text-sm text-muted-foreground">No move matches that.</li> : null}
          </ul>
        </section>
        {move ? (
          <article className="rounded-[22px] bg-[#f6f1e6] p-4 text-[#221c16]">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-3xl leading-none">{move.name}</h3>
              <TypeChip type={move.type} />
            </div>
            <p className="mt-3 text-sm leading-6">{move.desc}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-[#5c5348]">Class</dt>
                <dd>{move.category}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#5c5348]">Power</dt>
                <dd>{move.bp || "Varies"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#5c5348]">Accuracy</dt>
                <dd>{move.acc == null ? "Always hits" : `${move.acc}%`}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#5c5348]">Points</dt>
                <dd>{move.pp} PP{move.priority ? ` · priority ${move.priority > 0 ? "+" : ""}${move.priority}` : ""}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs font-semibold tracking-wide text-[#5c5348] uppercase">Strong into</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {chart.filter((row) => row.factor >= 2).map((row) => (
                <TypeChip key={row.type} type={row.type} factor={row.factor} />
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold tracking-wide text-[#5c5348] uppercase">Does nothing to</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {chart.filter((row) => row.factor === 0).map((row) => (
                <TypeChip key={row.type} type={row.type} />
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </div>
  )
}
