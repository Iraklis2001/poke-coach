import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Dex } from "@pkmn/dex"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outDir = path.join(root, "public", "data")

const SKIP_FORMES = new Set([
  "Gmax",
  "Totem",
  "Alola-Totem",
  "Cosplay",
  "Rock-Star",
  "Belle",
  "Pop-Star",
  "PhD",
  "Libre",
  "Spiky-eared",
  "Starter",
  "World",
  "Original",
  "Hoenn",
  "Sinnoh",
  "Unova",
  "Kalos",
  "Alola",
  "Partner",
])

const FLAG_KEYS = ["contact", "sound", "punch", "bite", "pulse", "slicing", "bullet", "powder"]

function includeSpecies(species) {
  if (!species.exists || species.num <= 0) return false
  if (species.isNonstandard && species.isNonstandard !== "Past") return false
  if (species.isCosmeticForme) return false
  if (SKIP_FORMES.has(species.forme)) return false
  if (/-Gmax$|-Totem$|-Cap$/.test(species.name)) return false
  return true
}

function includeMove(move) {
  if (!move.exists) return false
  if (move.isZ || move.isMax) return false
  if (move.isNonstandard && move.isNonstandard !== "Past") return false
  if (move.id.startsWith("hiddenpower") && move.id !== "hiddenpower") return false
  if (move.id === "struggle") return false
  return true
}

function pair(value) {
  if (!Array.isArray(value) || value.length < 2) return undefined
  return [value[0], value[1]]
}

function compact(entry) {
  const out = {}
  for (const [key, value] of Object.entries(entry)) {
    if (value == null) continue
    if (Array.isArray(value) && value.length === 0) continue
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) continue
    out[key] = value
  }
  return out
}

const species = Dex.species
  .all()
  .filter(includeSpecies)
  .map((species) => {
    const abilities = Object.entries(species.abilities).map(([slot, name]) => ({
      id: Dex.abilities.get(name).id,
      name,
      hidden: slot === "H",
    }))
    return {
      id: species.id,
      name: species.name,
      num: species.num,
      types: species.types,
      stats: species.baseStats,
      weight: species.weightkg,
      abilities,
      mega: Boolean(species.isMega),
    }
  })
  .sort((a, b) => a.num - b.num || a.name.localeCompare(b.name))

const speciesIds = new Set(species.map((entry) => entry.id))

const moves = Dex.moves
  .all()
  .filter(includeMove)
  .map((move) => {
    const flags = FLAG_KEYS.filter((key) => move.flags?.[key])
    const selfBoosts = move.boosts || move.self?.boosts
    const rider = move.secondary
    const entry = compact({
      id: move.id,
      name: move.name,
      type: move.type,
      category: move.category,
      bp: move.basePower || 0,
      acc: move.accuracy === true ? null : move.accuracy,
      pp: move.pp,
      priority: move.priority || 0,
      desc:
        move.id === "hiddenpower"
          ? "On Revolution Online this is always 60 power and special. The type comes from IVs and is never Normal or Fairy. Read it in the summary."
          : move.shortDesc || "",
      status: move.status || undefined,
      volatile: move.volatileStatus || undefined,
      chance: rider?.chance || undefined,
      riderStatus: rider?.status || undefined,
      riderVolatile: rider?.volatileStatus || undefined,
      heal: pair(move.heal),
      selfBoosts: selfBoosts || undefined,
      sideCondition: move.sideCondition || undefined,
      weather: move.weather || undefined,
      damage: move.damage === undefined || move.damage === null || move.damage === 0 ? undefined : move.damage,
      ohko: move.ohko ? true : undefined,
      multihit: move.multihit || undefined,
      drain: pair(move.drain),
      recoil: pair(move.recoil),
      selfSwitch: move.selfSwitch ? true : undefined,
      forceSwitch: move.forceSwitch ? true : undefined,
      willCrit: move.willCrit ? true : undefined,
      offStat: move.overrideOffensiveStat || undefined,
      defStat: move.overrideDefensiveStat || undefined,
      ignoreImmunity:
        move.ignoreImmunity && move.ignoreImmunity !== false ? move.ignoreImmunity : undefined,
      target: move.target,
    })
    entry.flags = flags
    return entry
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const moveIds = new Set(moves.map((move) => move.id))

const abilities = Dex.abilities
  .all()
  .filter((ability) => ability.exists && !ability.isNonstandard)
  .map((ability) => ({
    id: ability.id,
    name: ability.name,
    desc: ability.shortDesc || ability.desc || "",
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const natures = Dex.natures.all().map((nature) => ({
  id: nature.id,
  name: nature.name,
  plus: nature.plus || null,
  minus: nature.minus || null,
}))

const learnsets = {}
for (const entry of species) {
  const learned = await Dex.learnsets.get(entry.id)
  const ids = learned?.learnset ? Object.keys(learned.learnset) : []
  learnsets[entry.id] = ids.filter((id) => moveIds.has(id)).sort()
}

const catalog = { species, moves, abilities, natures }

await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, "catalog.json"), JSON.stringify(catalog))
await writeFile(path.join(outDir, "learnsets.json"), JSON.stringify(learnsets))

const catalogBytes = Buffer.byteLength(JSON.stringify(catalog))
const learnBytes = Buffer.byteLength(JSON.stringify(learnsets))
console.log(
  `catalog ${species.length} species (${speciesIds.size}), ${moves.length} moves, ${abilities.length} abilities, ${natures.length} natures`,
)
console.log(`bytes catalog=${catalogBytes} learnsets=${learnBytes}`)
