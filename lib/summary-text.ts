import { fold } from "@/lib/catalog"
import { matchSpeciesName } from "@/lib/battle-text"
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
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const levelMatch = clean.match(/lv\.?\s*(\d{1,3})/i)
  const level = levelMatch ? Number(levelMatch[1]) : null
  const ability =
    tidyCapture(clean.match(/ability\s*:?\s*([a-z][a-z.'’\- ]{1,28}?)(?:\s+nature|\s+ot\b|\s+moves?\b|$)/i)?.[1]) ??
    tidyCapture(lines.find((line) => /^ability\b/i.test(line))?.replace(/^ability\s*:?\s*/i, ""))
  const nature =
    tidyCapture(clean.match(/nature\s*:?\s*([a-z][a-z.'’\- ]{1,18}?)(?:\s+ot\b|\s+moves?\b|$)/i)?.[1]) ??
    tidyCapture(lines.find((line) => /^nature\b/i.test(line))?.replace(/^nature\s*:?\s*/i, ""))

  const moves: string[] = []
  const movesIndex = lines.findIndex((line) => /^moves?\b/i.test(line))
  const moveLines = movesIndex >= 0 ? lines.slice(movesIndex + 1) : lines
  for (const line of moveLines) {
    if (/^(ability|nature|ot|exp|current|till|atk|def|spd|spatk|spdef|hp)\b/i.test(line)) continue
    const move = tidyCapture(line.replace(/\s+\d+\s*\/\s*\d+\s*$/, "").replace(/^\d+\s*\/\s*\d+\s+/, ""))
    if (!move || /^(moves?|lv\.?|id:)/i.test(move)) continue
    if (move.split(" ").length > 4) continue
    moves.push(move)
    if (moves.length >= 4) break
  }

  const speciesLine =
    lines.find((line) => {
      const head = line.replace(/[♂♀].*$/, "").replace(/\s+lv\.?\s*\d+.*$/i, "").trim()
      return /^[A-Za-z][A-Za-z.'’\- ]{1,18}$/.test(head) && !/^(ability|nature|moves?|ot|exp)\b/i.test(head)
    }) ?? null
  const species = speciesLine
    ? tidyCapture(speciesLine.replace(/[♂♀].*$/, "").replace(/\s+lv\.?\s*\d+.*$/i, ""))
    : null

  return {
    species,
    level: level != null && level > 0 && level <= 100 ? level : null,
    ability,
    nature,
    moves,
  }
}

function tidyCapture(value: string | null | undefined) {
  if (!value) return null
  const tidy = value.replace(/\s+/g, " ").replace(/[.!?,;:]+$/g, "").trim()
  return tidy || null
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
  const read = readSummaryText(text)
  const species = read.species ? matchSpeciesName(read.species, catalog.species) : null
  if (!species) return null

  const ability =
    (read.ability ? matchNamed(read.ability, catalog.abilities) : null) ?? species.abilities[0] ?? null
  const nature = (read.nature ? matchNamed(read.nature, catalog.natures) : null) ?? null
  const moves: MoveChoice[] = []
  for (const raw of read.moves) {
    const move = matchNamed(raw, catalog.moves)
    if (move && !moves.some((entry) => entry.id === move.id)) moves.push({ id: move.id })
    if (moves.length >= 4) break
  }

  return {
    speciesId: species.id,
    abilityId: ability?.id ?? "",
    natureId: nature?.id ?? "hardy",
    moves,
    types: null,
    stats: null,
    ...(read.level ? { level: read.level } : {}),
  }
}

function matchNamed<T extends { id: string; name: string }>(raw: string, entries: T[]): T | null {
  const folded = fold(raw)
  if (!folded) return null
  const exact = entries.find((entry) => fold(entry.name) === folded)
  if (exact) return exact
  const close = entries.filter((entry) => {
    const name = fold(entry.name)
    return name.startsWith(folded) || folded.startsWith(name)
  })
  return close.length === 1 ? close[0] : null
}
