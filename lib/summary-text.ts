import { fold } from "@/lib/catalog"
import type { CatalogAbility, CatalogMove, CatalogNature, CatalogSpecies, MoveChoice, Slot } from "@/lib/types"

export type SummaryRead = {
  species: string | null
  level: number | null
  ability: string | null
  nature: string | null
  moves: string[]
}

export function readSummaryText(text: string): SummaryRead {
  const clean = text.replace(/\s+/g, " ").trim()
  const levelMatch = clean.match(/lv\.?\s*(\d{1,3})/i)
  const level = levelMatch ? Number(levelMatch[1]) : null
  return {
    species: null,
    level: level != null && level > 0 && level <= 100 ? level : null,
    ability: null,
    nature: null,
    moves: [],
  }
}

export function fillSlotFromSummary(
  text: string,
  catalog: {
    species: CatalogSpecies[]
    moves: CatalogMove[]
    abilities: CatalogAbility[]
    natures: CatalogNature[]
  },
): Partial<Slot> | null {
  const folded = fold(text)
  if (!folded) return null

  const species = findNamedInText(folded, catalog.species)
  if (!species) return null

  const nature = findNamedInText(folded, catalog.natures)
  const ability = findNamedInText(folded, catalog.abilities) ?? species.abilities[0] ?? null
  const moves: MoveChoice[] = []
  for (const move of findAllNamedInOrder(text, catalog.moves)) {
    if (!moves.some((entry) => entry.id === move.id)) moves.push({ id: move.id })
    if (moves.length >= 4) break
  }

  const levelMatch = text.replace(/\s+/g, " ").match(/lv\.?\s*(\d{1,3})/i)
  const level = levelMatch ? Number(levelMatch[1]) : null

  return {
    speciesId: species.id,
    abilityId: ability?.id ?? "",
    natureId: nature?.id ?? "hardy",
    moves,
    types: null,
    stats: null,
    ...(level != null && level > 0 && level <= 100 ? { level } : {}),
  }
}

function findNamedInText<T extends { id: string; name: string }>(foldedText: string, entries: T[]): T | null {
  let best: T | null = null
  let bestLength = 0
  for (const entry of entries) {
    const name = fold(entry.name)
    if (name.length < 3) continue
    if (!foldedText.includes(name)) continue
    if (name.length > bestLength) {
      best = entry
      bestLength = name.length
    }
  }
  return best
}

function findAllNamedInOrder<T extends { id: string; name: string }>(text: string, entries: T[]): T[] {
  const foldedText = fold(text)
  const hits: { start: number; end: number; entry: T }[] = []
  for (const entry of entries) {
    const name = fold(entry.name)
    if (name.length < 3) continue
    let from = 0
    while (from < foldedText.length) {
      const start = foldedText.indexOf(name, from)
      if (start < 0) break
      hits.push({ start, end: start + name.length, entry })
      from = start + 1
    }
  }
  // Longer names claim a range first so "Thunder" inside "Thunderbolt" is ignored,
  // while a later standalone "Thunder" still counts.
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start)
  const claimed: { start: number; end: number }[] = []
  const accepted: { start: number; entry: T }[] = []
  for (const hit of hits) {
    if (claimed.some((range) => hit.start < range.end && hit.end > range.start)) continue
    if (accepted.some((entry) => entry.entry.id === hit.entry.id)) continue
    claimed.push({ start: hit.start, end: hit.end })
    accepted.push({ start: hit.start, entry: hit.entry })
  }
  return accepted.sort((a, b) => a.start - b.start).map((hit) => hit.entry)
}
