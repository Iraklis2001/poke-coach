import { fold } from "@/lib/catalog"

export type BattleNames = {
  foe: string | null
  you: string | null
  level: number | null
}

const FOE_PATTERNS = [
  /a wild\s+([a-z][a-z.'’\- ]{1,24}?)\s+attacks/i,
  /a wild\s+([a-z][a-z.'’\- ]{1,24}?)(?=\s+attacks|\s+appeared|[!.]|$)/i,
  /sent out\s+([a-z][a-z.'’\- ]{1,24}?)(?:!|$)/i,
]

const YOU_PATTERNS = [/go[,!]?\s+([a-z][a-z.'’\- ]{1,24}?)(?:!|$)/i]

export function readBattleText(text: string): BattleNames {
  const clean = text.replace(/\s+/g, " ").trim()
  const foe = lastMatch(clean, FOE_PATTERNS)
  const you = lastMatch(clean, YOU_PATTERNS)
  return { foe, you, level: readLevel(clean, foe) }
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
