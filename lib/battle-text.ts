import { fold } from "@/lib/catalog"

export type BattleNames = {
  foe: string | null
  you: string | null
  level: number | null
  fainted: boolean
}

/** Foe nameplate in the top-left (name + Lv), not the battle log. */
export type NameplateRead = {
  foe: string | null
  level: number | null
}

const FOE_PATTERNS = [
  /a wild\s+([a-z][a-z.'’\- ]{1,24}?)\s+attacks/i,
  /a wild\s+([a-z][a-z.'’\- ]{1,24}?)(?=\s+attacks|\s+appeared|[!.]|$)/i,
  /sent out\s+([a-z][a-z.'’\- ]{1,24}?)(?:!|$)/i,
]

const YOU_PATTERNS = [/go[,!]?\s+([a-z][a-z.'’\- ]{1,24}?)(?:!|$)/i]

const FAINT_PATTERNS = [
  /\bfainted\b/i,
  /\bwas defeated\b/i,
  /\bdefeated\b/i,
]

export function readBattleText(text: string): BattleNames {
  const clean = text.replace(/\s+/g, " ").trim()
  const foe = lastMatch(clean, FOE_PATTERNS)
  const you = lastMatch(clean, YOU_PATTERNS)
  return { foe, you, level: readLevel(clean, foe), fainted: FAINT_PATTERNS.some((pattern) => pattern.test(clean)) }
}

/**
 * Read the foe HUD strip: "Tentacool ♂ Lv. 34".
 * Trainer battles swap this strip when the next Pokémon comes out.
 */
export function readNameplate(text: string): NameplateRead {
  const clean = text
    .replace(/[♂♀]/g, " ")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!clean) return { foe: null, level: null }

  const levelMatch = clean.match(/\blv\.?\s*(\d{1,3})\b/i)
  const levelRaw = levelMatch ? Number(levelMatch[1]) : null
  const level = levelRaw != null && levelRaw > 0 && levelRaw <= 100 ? levelRaw : null

  let before = clean
  if (levelMatch && levelMatch.index != null) before = clean.slice(0, levelMatch.index)
  before = before
    .replace(/^(a\s+)?wild\b/i, "")
    .replace(/^(foe|enemy|opposing)\b/i, "")
    .replace(/[^a-zA-Z.'’\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const foe = before ? tidy(before) : null
  return { foe, level }
}

/**
 * Find which species the nameplate OCR is talking about.
 * Prefer an exact/prefix match on the token before Lv, then scan the whole blob,
 * then allow small OCR typos (Tentacoo1 → Tentacool).
 */
export function matchNameplateSpecies<T extends { id: string; name: string }>(
  text: string,
  species: T[],
): { species: T; level: number | null } | null {
  const plate = readNameplate(text)
  if (plate.foe) {
    const direct = matchSpeciesName(plate.foe, species) ?? fuzzySpecies(plate.foe, species)
    if (direct) return { species: direct, level: plate.level }
  }

  const folded = fold(text)
  if (!folded) return null

  let best: T | null = null
  let bestLen = 0
  for (const entry of species) {
    const name = fold(entry.name)
    if (name.length < 3) continue
    if (!folded.includes(name)) continue
    if (name.length > bestLen) {
      best = entry
      bestLen = name.length
    }
  }
  if (best) return { species: best, level: plate.level }

  // Last resort: fuzzy the longest letter token in the OCR.
  const tokens = folded.split(/[^a-z0-9]+/).filter((token) => token.length >= 4)
  tokens.sort((a, b) => b.length - a.length)
  for (const token of tokens.slice(0, 4)) {
    const hit = fuzzySpecies(token, species)
    if (hit) return { species: hit, level: plate.level }
  }
  return null
}

function fuzzySpecies<T extends { id: string; name: string }>(raw: string, species: T[]): T | null {
  const folded = fold(raw)
  if (!folded || folded.length < 4) return null
  const maxDist = folded.length >= 8 ? 2 : 1
  let best: T | null = null
  let bestDist = maxDist + 1
  for (const entry of species) {
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

function lastMatch(text: string, patterns: RegExp[]) {
  let found: string | null = null
  let index = -1
  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
    for (const match of text.matchAll(new RegExp(pattern.source, flags))) {
      if (match[1] && match.index != null && match.index >= index) {
        index = match.index
        found = tidy(match[1])
      }
    }
  }
  return found
}

function readLevel(text: string, foe: string | null) {
  const levels = [...text.matchAll(/lv\.?\s*(\d{1,3})/gi)]
    .map((match) => Number(match[1]))
    .filter((level) => level > 0 && level <= 100)
  if (levels.length === 1) return levels[0]
  if (!foe || levels.length === 0) return null
  const escaped = foe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const near = text.match(new RegExp(`${escaped}\\s+lv\\.?\\s*(\\d{1,3})`, "i"))
  const level = near ? Number(near[1]) : null
  return level != null && level > 0 && level <= 100 ? level : null
}

function tidy(name: string) {
  return name.replace(/\s+/g, " ").replace(/[.!?,]+$/g, "").trim()
}

export function matchSpeciesName<T extends { id: string; name: string }>(raw: string, species: T[]): T | null {
  const folded = fold(raw)
  if (!folded) return null
  const exact = species.find((entry) => fold(entry.name) === folded)
  if (exact) return exact
  const close = species.filter((entry) => {
    const name = fold(entry.name)
    return name.startsWith(folded) || folded.startsWith(name)
  })
  return close.length === 1 ? close[0] : null
}
