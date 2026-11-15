import type { Slot } from "@/lib/types"
import type { Weather } from "@/lib/types"

export type SavedFight = {
  party: Slot[]
  active: number
  foe: Slot
  youHp: number
  foeHp: number
  weather: Weather
  showBanner: boolean
  lessons: string[]
}

export function emptySlot(): Slot {
  return {
    speciesId: "",
    level: 50,
    natureId: "hardy",
    abilityId: "",
    moves: [],
    types: null,
    stats: null,
  }
}

function mon(
  speciesId: string,
  natureId: string,
  abilityId: string,
  moves: string[],
  level = 50,
): Slot {
  return {
    speciesId,
    level,
    natureId,
    abilityId,
    moves: moves.map((id) => ({ id })),
    types: null,
    stats: null,
  }
}

export function practiceFight(): SavedFight {
  return {
    party: [
      mon("charizard", "modest", "blaze", ["flamethrower", "airslash", "dragonclaw", "roost"]),
      mon("excadrill", "adamant", "sandrush", ["earthquake", "ironhead", "rockslide", "swordsdance"]),
      mon("gyarados", "adamant", "intimidate", ["waterfall", "earthquake", "icefang", "dragondance"]),
      mon("gardevoir", "modest", "trace", ["moonblast", "psychic", "thunderbolt", "calmmind"]),
      mon("garchomp", "jolly", "roughskin", ["earthquake", "dragonclaw", "stoneedge", "firefang"]),
      mon("corviknight", "impish", "pressure", ["bravebird", "bodypress", "roost", "uturn"]),
    ],
    active: 0,
    foe: mon("magnemite", "bold", "magnetpull", [], 50),
    youHp: 100,
    foeHp: 100,
    weather: "none",
    showBanner: true,
    lessons: [],
  }
}

export function normalizeFight(value: unknown): SavedFight {
  const fallback = practiceFight()
  if (!value || typeof value !== "object") return fallback
  const raw = value as Partial<SavedFight>
  const party = Array.isArray(raw.party) ? raw.party.slice(0, 6) : []
  while (party.length < 6) party.push(emptySlot())
  return {
    party: party.map((slot) => normalizeSlot(slot)),
    active: typeof raw.active === "number" ? Math.min(5, Math.max(0, raw.active)) : 0,
    foe: normalizeSlot(raw.foe),
    youHp: clampPercent(raw.youHp),
    foeHp: clampPercent(raw.foeHp),
    weather: raw.weather === "sun" || raw.weather === "rain" || raw.weather === "sand" ? raw.weather : "none",
    showBanner: raw.showBanner !== false,
    lessons: Array.isArray(raw.lessons) ? raw.lessons.filter((lesson) => typeof lesson === "string") : [],
  }
}

function clampPercent(value: unknown) {
  const number = typeof value === "number" ? value : 100
  return Math.min(100, Math.max(1, Math.round(number)))
}

function normalizeSlot(value: unknown): Slot {
  const slot = emptySlot()
  if (!value || typeof value !== "object") return slot
  const raw = value as Partial<Slot>
  slot.speciesId = typeof raw.speciesId === "string" ? raw.speciesId : ""
  slot.level = typeof raw.level === "number" ? Math.min(100, Math.max(1, Math.round(raw.level))) : 50
  slot.natureId = typeof raw.natureId === "string" ? raw.natureId : "hardy"
  slot.abilityId = typeof raw.abilityId === "string" ? raw.abilityId : ""
  slot.types = Array.isArray(raw.types) ? raw.types.filter((type) => typeof type === "string") : null
  slot.moves = Array.isArray(raw.moves)
    ? raw.moves
        .filter((move) => move && typeof move.id === "string" && move.id)
        .slice(0, 4)
        .map((move) => ({
          id: move.id,
          hiddenPower: typeof move.hiddenPower === "string" ? move.hiddenPower : undefined,
        }))
    : []
  if (raw.stats && typeof raw.stats === "object") {
    const stats: Slot["stats"] = {}
    for (const key of ["hp", "atk", "def", "spa", "spd", "spe"] as const) {
      const stat = raw.stats[key]
      if (typeof stat === "number" && stat > 0) stats[key] = Math.round(stat)
    }
    slot.stats = Object.keys(stats).length ? stats : null
  }
  return slot
}
