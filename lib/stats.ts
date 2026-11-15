import type { CatalogNature, StatBlock } from "@/lib/types"

const NATURE_STATS = ["atk", "def", "spa", "spd", "spe"] as const

export function natureMultiplier(nature: Pick<CatalogNature, "plus" | "minus"> | null, stat: keyof StatBlock) {
  if (!nature || stat === "hp") return 1
  if (nature.plus === stat) return 1.1
  if (nature.minus === stat) return 0.9
  return 1
}

export function calcStat(
  stat: keyof StatBlock,
  base: number,
  level: number,
  nature: Pick<CatalogNature, "plus" | "minus"> | null,
  iv = 31,
  ev = 0,
) {
  if (stat === "hp" && base === 1) return 1
  if (stat === "hp") {
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10
  }
  const inner = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5
  return Math.floor(inner * natureMultiplier(nature, stat))
}

export function estimateStats(
  base: StatBlock,
  level: number,
  nature: Pick<CatalogNature, "plus" | "minus"> | null,
  overrides?: Partial<StatBlock> | null,
): { stats: StatBlock; real: boolean } {
  const estimated = {
    hp: calcStat("hp", base.hp, level, nature),
    atk: calcStat("atk", base.atk, level, nature),
    def: calcStat("def", base.def, level, nature),
    spa: calcStat("spa", base.spa, level, nature),
    spd: calcStat("spd", base.spd, level, nature),
    spe: calcStat("spe", base.spe, level, nature),
  }
  if (!overrides) return { stats: estimated, real: false }
  let real = false
  const stats = { ...estimated }
  for (const key of ["hp", "atk", "def", "spa", "spd", "spe"] as const) {
    const value = overrides[key]
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      stats[key] = Math.round(value)
      real = true
    }
  }
  return { stats, real }
}

export function natureLabel(nature: Pick<CatalogNature, "name" | "plus" | "minus">) {
  if (!nature.plus || !nature.minus) return `${nature.name}, no stat change`
  const names: Record<string, string> = {
    atk: "Attack",
    def: "Defense",
    spa: "Sp. Atk",
    spd: "Sp. Def",
    spe: "Speed",
  }
  return `${nature.name}, raises ${names[nature.plus]}, lowers ${names[nature.minus]}`
}

export const STAT_KEYS = NATURE_STATS
