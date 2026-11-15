"use client"

import { useMemo, useState } from "react"
import { searchSpecies } from "@/lib/catalog"
import { LESSONS, defensiveList, explainMatchup, typeHit } from "@/lib/typechart"
import { TYPES } from "@/lib/types"
import { useFight } from "@/lib/store"
import { useCatalog } from "@/components/catalog-context"
import { Suggest } from "@/components/suggest"
import { TypeChip } from "@/components/type-chip"
import { cn } from "cn"

const SHORT: Record<string, string> = {
  Normal: "Nor",
  Fire: "Fir",
  Water: "Wat",
  Electric: "Ele",
  Grass: "Gra",
  Ice: "Ice",
  Fighting: "Fig",
  Poison: "Poi",
  Ground: "Gro",
  Flying: "Fly",
  Psychic: "Psy",
  Bug: "Bug",
  Rock: "Roc",
  Ghost: "Gho",
  Dragon: "Dra",
  Dark: "Dar",
  Steel: "Ste",
  Fairy: "Fai",
  Shadow: "Sha",
}

export function TypeLab() {
  const catalog = useCatalog()
  const { fight } = useFight()
  const [attack, setAttack] = useState("Fire")
  const [defense, setDefense] = useState<string[]>(["Steel"])
  const [speciesId, setSpeciesId] = useState("magnemite")
  const match = explainMatchup({ moveType: attack, defenderTypes: defense })
  const species = catalog.speciesById.get(speciesId)
  const profile = useMemo(() => (species ? defensiveList(species.types) : []), [species])

  function toggleDefense(type: string) {
    setDefense((current) => {
      if (current.includes(type)) return current.filter((item) => item !== type)
      if (current.length >= 2) return [current[1], type]
      return [...current, type]
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-4xl leading-none">Types, in sentences</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Pick the move&apos;s type and the types you are hitting. The chart includes Shadow, which Revolution Online adds on top of the 18 normal types.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Move type</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TYPES.map((type) => (
              <button key={type} type="button" onClick={() => setAttack(type)} className={cn(attack === type && "ring-2 ring-[#e25b2a] ring-offset-2 ring-offset-card rounded-full")}>
                <TypeChip type={type} />
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">Defending types, up to two</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TYPES.map((type) => (
              <button key={type} type="button" onClick={() => toggleDefense(type)} className={cn(defense.includes(type) && "ring-2 ring-[#e25b2a] ring-offset-2 ring-offset-card rounded-full")}>
                <TypeChip type={type} />
              </button>
            ))}
          </div>
          <article className="mt-5 rounded-[22px] bg-[#f6f1e6] px-4 py-4 text-[#221c16]">
            <p className="text-xs font-bold tracking-[0.18em] text-[#e25b2a] uppercase">{attack} into {defense.join(" / ") || "nothing"}</p>
            <p className="font-heading mt-2 text-3xl leading-tight">{match.factor === 0 ? "No effect" : match.factor === 1 ? "A normal hit" : match.factor === 2 ? "Twice as hard" : match.factor === 4 ? "Four times as hard" : `${match.factor}×`}</p>
            <p className="mt-3 text-sm leading-6">{match.sentence}</p>
          </article>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <Suggest
            label="Look up a Pokémon"
            selectedLabel={species?.name ?? ""}
            placeholder="Magnemite"
            options={(query) =>
              searchSpecies(catalog, query).map((entry) => ({
                id: entry.id,
                label: entry.name,
                hint: entry.types.join(" / "),
              }))
            }
            onSelect={setSpeciesId}
          />
          {species ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-1">
                {species.types.map((type) => (
                  <TypeChip key={type} type={type} />
                ))}
              </div>
              <ul className="space-y-2 text-sm leading-6">
                {profile
                  .filter((row) => row.factor >= 2 || row.factor === 0)
                  .map((row) => (
                    <li key={row.type}>
                      <TypeChip type={row.type} factor={row.factor === 0 ? 0 : row.factor} />
                      <span className="ml-2 text-muted-foreground">{row.sentence}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/80 p-4">
        <h3 className="font-heading text-2xl">The whole chart</h3>
        <p className="mt-1 text-sm text-muted-foreground">Rows are the move. Columns are the Pokémon being hit. A blank cell is a normal hit.</p>
        <div className="mt-3 overflow-auto">
          <table className="border-separate border-spacing-0 text-[11px]">
            <caption className="sr-only">Type chart. Each row is an attacking type and each column is a defending type.</caption>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-2 py-1 text-left">Move</th>
                {TYPES.map((type) => (
                  <th key={type} className="px-1 py-1 font-medium">
                    <span className="block w-8" title={type}>
                      {SHORT[type]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TYPES.map((row) => (
                <tr key={row}>
                  <th className="sticky left-0 z-10 bg-card px-2 py-1 text-left font-medium">{row}</th>
                  {TYPES.map((column) => {
                    const factor = typeHit(row, column)
                    return (
                      <td
                        key={column}
                        title={explainMatchup({ moveType: row, defenderTypes: [column] }).sentence}
                        className={cn(
                          "px-1 py-1 text-center",
                          factor === 0 && "bg-[#3a2420] text-[#f3c7be]",
                          factor === 0.5 && "bg-[#3a3420] text-[#ead7a2]",
                          factor === 2 && "bg-[#1d3a28] text-[#c9efd4]",
                          factor === 4 && "bg-[#1d3a28] text-[#c9efd4]",
                        )}
                      >
                        {factor === 1 ? "" : factor === 0.5 ? "½" : factor === 0 ? "0" : factor}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="font-heading text-2xl">What you have already seen in a fight</h3>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {Object.entries(LESSONS).map(([id, lesson]) => {
            const seen = fight.lessons.includes(id)
            return (
              <li key={id} className={cn("rounded-2xl border px-4 py-3", seen ? "border-border bg-card/80" : "border-dashed border-border/70 text-muted-foreground")}>
                <p className="text-xs font-semibold tracking-wide uppercase">{seen ? "Seen" : "Not yet"}</p>
                <p className="mt-1 font-semibold text-foreground">{lesson.title}</p>
                <p className="mt-1 text-sm leading-6">{lesson.body}</p>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
