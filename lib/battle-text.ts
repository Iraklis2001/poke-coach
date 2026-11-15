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
