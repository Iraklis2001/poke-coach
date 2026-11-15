"use client"

import { useEffect, useRef } from "react"
import { matchNameplateSpecies } from "@/lib/battle-text"
import type { IndexedCatalog } from "@/lib/catalog"
import { loadFoeBox } from "@/lib/overlay-storage"
import type { SavedFight } from "@/lib/sample"
import { patchFoe } from "@/lib/store"

const POLL_MS = 1200

/**
 * Poll the saved foe nameplate region while a fight is being watched.
 * Updates the foe slot when the name/Lv change (trainer send-outs).
 */
export function useFoeWatch(options: {
  watching: boolean
  boxTick: number
  fight: SavedFight
  catalog: IndexedCatalog
  onStatus: (message: string) => void
}) {
  const { watching, boxTick, fight, catalog, onStatus } = options
  const fightRef = useRef(fight)
  const catalogRef = useRef(catalog)
  const onStatusRef = useRef(onStatus)

  useEffect(() => {
    fightRef.current = fight
    catalogRef.current = catalog
    onStatusRef.current = onStatus
  }, [fight, catalog, onStatus])

  useEffect(() => {
    if (!watching || !window.slate?.readRegion) return
    const box = loadFoeBox()
    if (!box) return
    const region = box

    let stopped = false
    let lastFoeId: string | null = null
    let emptyTicks = 0

    async function look() {
      try {
        const result = await window.slate?.readRegion?.(region)
        if (stopped || !result) return
        if (result.error) {
          onStatusRef.current(result.error)
          return
        }

        const hit = matchNameplateSpecies(result.text, catalogRef.current.species)
        const preview = result.text.replace(/\s+/g, " ").trim().slice(0, 40)

        if (!hit) {
          emptyTicks += 1
          if (lastFoeId && emptyTicks >= 3) {
            const prev = catalogRef.current.speciesById.get(lastFoeId)?.name ?? "Foe"
            onStatusRef.current(`${prev} fainted — waiting for the next Pokémon…`)
          } else {
            onStatusRef.current(
              preview
                ? `Saw “${preview}” — redraw a tight box on the foe name + Lv.`
                : "Empty read — redraw a tight box on the foe name + Lv.",
            )
          }
          return
        }

        emptyTicks = 0
        const found = hit.species
        const levelPatch = hit.level ? { level: hit.level } : {}

        if (found.id !== fightRef.current.foe.speciesId) {
          const prevName = lastFoeId ? catalogRef.current.speciesById.get(lastFoeId)?.name : null
          patchFoe({
            speciesId: found.id,
            abilityId: found.abilities[0]?.id ?? "",
            moves: [],
            types: null,
            stats: null,
            ...levelPatch,
          })
          lastFoeId = found.id
          onStatusRef.current(
            prevName && prevName !== found.name
              ? `${prevName} fainted · next: ${found.name}${hit.level ? ` Lv ${hit.level}` : ""}`
              : `Foe: ${found.name}${hit.level ? ` Lv ${hit.level}` : ""}`,
          )
          return
        }

        lastFoeId = found.id
        if (hit.level && hit.level !== fightRef.current.foe.level) patchFoe({ level: hit.level })
        onStatusRef.current(`Foe: ${found.name}${hit.level ? ` Lv ${hit.level}` : ""}`)
      } catch {
        if (!stopped) onStatusRef.current("The foe name box could not be read.")
      }
    }

    const timer = window.setInterval(() => void look(), POLL_MS)
    void look()
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [watching, boxTick])
}
