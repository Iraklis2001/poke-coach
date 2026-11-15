import type { IndexedCatalog } from "@/lib/catalog"
import { fillSlotFromSummary } from "@/lib/summary-text"
import { getSlateApi } from "@/lib/slate-api"
import { patchSlot } from "@/lib/store"
import type { Slot } from "@/lib/types"

export type FillSummaryResult =
  | { ok: true; message: string; slot: Partial<Slot> }
  | { ok: false; message: string }

/** Capture a summary region and write it into a party slot. */
export async function fillPartySlotFromSummary(
  catalog: IndexedCatalog,
  activeIndex: number,
  currentLevel: number,
): Promise<FillSummaryResult> {
  const api = getSlateApi()
  if (!api?.pickRegion || !api.readRegion) {
    return { ok: false, message: "Summary capture needs the desktop overlay." }
  }

  const box = await api.pickRegion()
  if (!box) return { ok: false, message: "Cancelled." }

  const result = await api.readRegion(box)
  if (result.error) return { ok: false, message: result.error }
  if (!result.text.trim()) {
    return { ok: false, message: "Nothing was read. Move Slate aside and try again." }
  }

  const filled = fillSlotFromSummary(result.text, {
    species: catalog.species,
    moves: catalog.moves,
    abilities: catalog.abilities,
    natures: catalog.natures,
    learnsets: catalog.learnsets,
  })
  if (!filled) {
    return { ok: false, message: "No Pokémon name found. Cover the whole summary, including the name." }
  }

  patchSlot(activeIndex, filled)
  const name = catalog.speciesById.get(filled.speciesId ?? "")?.name ?? "Pokémon"
  const moveCount = filled.moves?.length ?? 0
  const level = filled.level ?? currentLevel
  return {
    ok: true,
    slot: filled,
    message: `${name} Lv ${level} · slot ${activeIndex + 1}${
      moveCount ? ` · ${moveCount}/4 moves` : " · no moves read"
    } — tap Edit if wrong.`,
  }
}
