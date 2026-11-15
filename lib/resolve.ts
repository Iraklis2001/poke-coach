import { estimateStats } from "@/lib/stats"
import { TYPES, type CatalogMove, type Fighter, type Slot, type TypeName } from "@/lib/types"
import type { IndexedCatalog } from "@/lib/catalog"

const TYPE_SET = new Set<string>(TYPES)

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function resolveFighter(slot: Slot, catalog: IndexedCatalog, hpPercent: number): Fighter | null {
  const species = slot.speciesId ? catalog.speciesById.get(slot.speciesId) : undefined
  const chosenTypes = (slot.types ?? []).filter((type): type is TypeName => TYPE_SET.has(type))
  const types = (chosenTypes.length > 0 ? chosenTypes : (species?.types ?? [])).filter((type): type is TypeName =>
    TYPE_SET.has(type),
  )
  if (!species && types.length === 0) return null
  const base = species?.stats ?? { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }
  const nature = catalog.natureById.get(slot.natureId) ?? {
    id: "hardy",
    name: "Hardy",
    plus: null,
    minus: null,
  }
  const level = clamp(slot.level || 1, 1, 100)
  const estimated = estimateStats(base, level, nature, slot.stats)
  const ability = slot.abilityId ? catalog.abilityById.get(slot.abilityId) : undefined
  const moves: CatalogMove[] = []
  const hiddenPower: Fighter["hiddenPower"] = {}
  for (const choice of slot.moves) {
    const move = catalog.moveById.get(choice.id)
    if (!move) continue
    moves.push(move)
    if (choice.id === "hiddenpower" && choice.hiddenPower && TYPE_SET.has(choice.hiddenPower)) {
      hiddenPower.hiddenpower = choice.hiddenPower as TypeName
    }
  }
  const hp = clamp(hpPercent, 1, 100)
  return {
    name: species?.name ?? "This Pokémon",
    types,
    abilityId: slot.abilityId ? slot.abilityId : null,
    abilityName: ability?.name ?? null,
    level,
    natureName: nature.name,
    base,
    stats: estimated.stats,
    statsAreReal: estimated.real,
    weight: species?.weight || 40,
    hpPercent: hp,
    currentHp: Math.max(1, Math.round((estimated.stats.hp * hp) / 100)),
    moves,
    hiddenPower,
  }
}
