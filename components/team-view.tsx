"use client"

import { emptySlot } from "@/lib/sample"
import { patchSlot, resetPractice, useFight } from "@/lib/store"
import { useCatalog } from "@/components/catalog-context"
import { AbilityField, LevelNatureFields, MoveEditor, SpeciesField, StatEditor, TypeOverride } from "@/components/editors"
import { Button } from "@/components/ui/button"

export function TeamView() {
  const catalog = useCatalog()
  const { fight } = useFight()
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-4xl leading-none">Your six</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Put in the Pokémon you actually walk around with. Slate remembers them on this browser. Moves can be anything you know, even if a tutor on Revolution Online is not in the main-series list.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={resetPractice}>
          Reset the practice fight
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {fight.party.map((slot, index) => {
          const species = catalog.speciesById.get(slot.speciesId)
          return (
            <section key={index} className="rounded-2xl border border-border bg-card/80 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-heading text-2xl">{species?.name ?? `Slot ${index + 1}`}</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => patchSlot(index, emptySlot())}>
                  Empty
                </Button>
              </div>
              <div className="space-y-3">
                <SpeciesField slot={slot} label="Pokémon" onChange={(patch) => patchSlot(index, patch)} />
                <LevelNatureFields slot={slot} onChange={(patch) => patchSlot(index, patch)} />
                <AbilityField slot={slot} onChange={(patch) => patchSlot(index, patch)} />
                <MoveEditor slot={slot} onChange={(patch) => patchSlot(index, patch)} />
                <TypeOverride slot={slot} onChange={(patch) => patchSlot(index, patch)} />
                <StatEditor slot={slot} onChange={(patch) => patchSlot(index, patch)} />
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
