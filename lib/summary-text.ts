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
    learnsets?: Record<string, string[]>
  },
): Partial<Slot> | null {
  const folded = fold(text)
  if (!folded) return null

  const species = findNamedInText(folded, catalog.species)
  if (!species) return null

  const nature = findNamedInText(folded, catalog.natures)
  const ability = findNamedInText(folded, catalog.abilities) ?? species.abilities[0] ?? null
  const learnset = catalog.learnsets?.[species.id] ?? null
  const moves = pickMoves(text, catalog.moves, learnset)

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

function pickMoves(text: string, moves: CatalogMove[], learnset: string[] | null): MoveChoice[] {
  const allowed = learnset ? new Set(learnset) : null
  const pool = allowed ? moves.filter((move) => allowed.has(move.id)) : moves

  // Prefer the section after the word "Moves", where the four attacks usually sit.
  const movesAt = text.search(/\bmoves?\b/i)
  const focus = movesAt >= 0 ? text.slice(movesAt) : text

  const fromLines = movesFromPpLines(focus, pool)
  const fromScan = findAllNamedInOrder(focus, pool)
  const fromFuzzy = fuzzyMovesFromText(focus, pool)
  const merged: MoveChoice[] = []
  for (const move of [...fromLines, ...fromScan.map((entry) => ({ id: entry.id })), ...fromFuzzy.map((entry) => ({ id: entry.id }))]) {
    if (!merged.some((entry) => entry.id === move.id)) merged.push(move)
    if (merged.length >= 4) break
  }
  if (merged.length >= 4) return merged.slice(0, 4)

  // Last resort: scan the whole summary with the learnset pool.
  for (const move of [...findAllNamedInOrder(text, pool), ...fuzzyMovesFromText(text, pool)]) {
    if (!merged.some((entry) => entry.id === move.id)) merged.push({ id: move.id })
    if (merged.length >= 4) break
  }
  return merged
}

function movesFromPpLines(text: string, pool: CatalogMove[]): MoveChoice[] {
  const found: MoveChoice[] = []
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean)
  for (const line of lines) {
    // "Thunderbolt 15/15", "Thunderbolt 15015", "Thunder Wave 20 20"
    const match =
      line.match(/^([A-Za-z][A-Za-z.'’\- ]{1,24}?)\s+(\d{1,2}\s*\/\s*\d{1,2}|\d{3,4})\b/) ||
      line.match(/^([A-Za-z][A-Za-z.'’\- ]{1,24}?)\s+\d/)
    const raw = (match?.[1] ?? "").replace(/\s+/g, " ").trim()
    if (!raw || raw.split(" ").length > 4) continue
    if (/^(moves?|ability|nature|ot|exp|current|till|atk|def|spd|spatk|spdef|hp|lv)\b/i.test(raw)) continue
    const move = matchNamedLoose(raw, pool)
    if (!move) continue
    if (found.some((entry) => entry.id === move.id)) continue
    found.push({ id: move.id })
    if (found.length >= 4) break
  }
  return found
}

function matchNamedLoose(raw: string, entries: CatalogMove[]): CatalogMove | null {
  const folded = fold(raw)
  if (!folded || folded.length < 3) return null
  const exact = entries.find((entry) => fold(entry.name) === folded)
  if (exact) return exact
  // OCR often drops spaces or trailing letters: "ThunderWve", "DragonPulse"
  const close = entries.filter((entry) => {
    const name = fold(entry.name)
    return name.startsWith(folded) || folded.startsWith(name) || (folded.length >= 5 && name.includes(folded))
  })
  if (close.length === 1) return close[0]
  if (close.length > 1) {
    close.sort((a, b) => Math.abs(fold(a.name).length - folded.length) - Math.abs(fold(b.name).length - folded.length))
    return close[0]
  }
  const maxDist = folded.length >= 8 ? 2 : folded.length >= 5 ? 1 : 0
  if (maxDist === 0) return null
  let best: CatalogMove | null = null
  let bestDist = maxDist + 1
  for (const entry of entries) {
    const name = fold(entry.name)
    if (Math.abs(name.length - folded.length) > maxDist) continue
    const dist = editDistance(name, folded)
    if (dist < bestDist) {
      best = entry
      bestDist = dist
    } else if (dist === bestDist) {
      best = null
    }
  }
  return bestDist <= maxDist ? best : null
}

function fuzzyMovesFromText(text: string, pool: CatalogMove[]): CatalogMove[] {
  const tokens = text
    .replace(/[|/\\]+/g, " ")
    .split(/\r?\n| {2,}/)
    .flatMap((line) => {
      const cleaned = line.replace(/\d+\s*\/\s*\d+/g, " ").replace(/\d{2,}/g, " ").replace(/\s+/g, " ").trim()
      if (!cleaned) return []
      const parts = cleaned.split(/\s+/)
      const out: string[] = []
      for (let i = 0; i < parts.length; i += 1) {
        out.push(parts[i])
        if (i + 1 < parts.length) out.push(`${parts[i]} ${parts[i + 1]}`)
        if (i + 2 < parts.length) out.push(`${parts[i]} ${parts[i + 1]} ${parts[i + 2]}`)
      }
      return out
    })
  const found: CatalogMove[] = []
  for (const token of tokens) {
    if (!/^[A-Za-z]/.test(token)) continue
    const move = matchNamedLoose(token, pool)
    if (!move) continue
    if (found.some((entry) => entry.id === move.id)) continue
    found.push(move)
    if (found.length >= 4) break
  }
  return found
}

function editDistance(a: string, b: string) {
  const rows = a.length + 1
  const cols = b.length + 1
  const grid = Array.from({ length: rows }, () => Array<number>(cols).fill(0))
  for (let i = 0; i < rows; i += 1) grid[i][0] = i
  for (let j = 0; j < cols; j += 1) grid[0][j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      grid[i][j] = Math.min(grid[i - 1][j] + 1, grid[i][j - 1] + 1, grid[i - 1][j - 1] + cost)
    }
  }
  return grid[a.length][b.length]
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
