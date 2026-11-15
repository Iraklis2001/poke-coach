import { explainMatchup, formatFactor, LESSONS, defensiveList } from "@/lib/typechart"
import type { CatalogMove, Fighter, MoveCategory, TypeName, Weather } from "@/lib/types"

export type MoveRead = {
  id: string
  name: string
  type: string
  category: MoveCategory
  factor: number | null
  label: string
  detail: string
  damageText: string | null
  recommended: boolean
  score: number
  priority: number
}

export type SwitchRead = {
  name: string
  reason: string
  recommended: boolean
  score: number
}

export type Advice = {
  verdict: "stay" | "switch" | "rough"
  kicker: string
  headline: string
  paragraphs: string[]
  lessonId: keyof typeof LESSONS
  moves: MoveRead[]
  switches: SwitchRead[]
  speedLine: string
  threatLine: string
  estimateNote: string
  theyWeak: { type: string; factor: number }[]
  youWeak: { type: string; factor: number }[]
}

type Rated = {
  move: CatalogMove
  type: string
  factor: number | null
  low: number
  high: number
  acc: number
  priority: number
  sentence: string
  notes: string[]
  stabNote: string | null
  label: string
  score: number
  kos: boolean
  diesFirst: boolean
  text: string
  kind: "attack" | "status" | "hidden-power" | "fail"
  statusLine?: string
}

const CONVERTERS: Record<string, { type: TypeName; note: string }> = {
  pixilate: { type: "Fairy", note: "Pixilate turns Normal moves into Fairy moves and boosts them." },
  aerilate: { type: "Flying", note: "Aerilate turns Normal moves into Flying moves and boosts them." },
  refrigerate: { type: "Ice", note: "Refrigerate turns Normal moves into Ice moves and boosts them." },
  galvanize: { type: "Electric", note: "Galvanize turns Normal moves into Electric moves and boosts them." },
}

const TYPE_BOOSTS: Record<string, { type: string; mod: number; note: string }> = {
  steelworker: { type: "Steel", mod: 1.5, note: "Steelworker boosts Steel moves." },
  steelyspirit: { type: "Steel", mod: 1.5, note: "Steely Spirit boosts Steel moves." },
  dragonsmaw: { type: "Dragon", mod: 1.5, note: "Dragon's Maw boosts Dragon moves." },
  transistor: { type: "Electric", mod: 1.3, note: "Transistor boosts Electric moves." },
  rockypayload: { type: "Rock", mod: 1.5, note: "Rocky Payload boosts Rock moves." },
  waterbubble: { type: "Water", mod: 2, note: "Water Bubble doubles Water moves." },
}

function lowerFirst(text: string) {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text
}

function joinTypes(types: string[]) {
  if (types.length === 0) return "an unknown type"
  if (types.length === 1) return types[0]
  if (types.length === 2) return `${types[0]} and ${types[1]}`
  return `${types.slice(0, -1).join(", ")} and ${types[types.length - 1]}`
}

function percent(damage: number, maxHp: number) {
  if (maxHp <= 0) return 0
  return Math.round((damage / maxHp) * 100)
}

function damageText(low: number, high: number, maxHp: number, current: number, name: string) {
  const a = percent(low, maxHp)
  const b = percent(high, maxHp)
  if (b <= 0) return "It does no damage."
  const span = a === b ? `About ${a}%` : `About ${a}–${b}%`
  if (low >= current) return `${span} of a full health bar, so it knocks ${name} out.`
  if (high >= current) return `${span} of a full health bar. It can knock ${name} out if the hit rolls high.`
  return `${span} of a full health bar.`
}

function effectiveSpeed(fighter: Fighter, weather: Weather) {
  let speed = fighter.stats.spe
  let note: string | null = null
  const ability = fighter.abilityId || ""
  if (weather === "sand" && ability === "sandrush") {
    speed *= 2
    note = "Sand Rush doubles your Speed while a sandstorm is up."
  }
  if (weather === "rain" && ability === "swiftswim") {
    speed *= 2
    note = "Swift Swim doubles your Speed in the rain."
  }
  if (weather === "sun" && ability === "chlorophyll") {
    speed *= 2
    note = "Chlorophyll doubles your Speed in the sun."
  }
  return { speed, note }
}

function powerFor(move: CatalogMove, you: Fighter, foe: Fighter, weather: Weather) {
  const id = move.id
  if (id === "return") return { power: 102, note: "Assumes full friendship." }
  if (id === "frustration") return { power: 102, note: "Assumes no friendship." }
  if (id === "acrobatics") return { power: 110, note: "Assumes you are not holding an item. With an item this is 55." }
  if (id === "eruption" || id === "waterspout") {
    return {
      power: Math.max(1, Math.floor((150 * you.hpPercent) / 100)),
      note: "Power falls as your health falls.",
    }
  }
  if (id === "flail" || id === "reversal") {
    const ratio = (you.hpPercent / 100) * 48
    const power = ratio < 2 ? 200 : ratio < 5 ? 150 : ratio < 10 ? 100 : ratio < 17 ? 80 : ratio < 33 ? 40 : 20
    return { power, note: "Power rises when you are hurt." }
  }
  if (id === "gyroball") {
    return {
      power: Math.min(150, Math.floor((25 * foe.stats.spe) / Math.max(1, you.stats.spe))),
      note: "Stronger when you are slower than them.",
    }
  }
  if (id === "electroball") {
    const ratio = you.stats.spe / Math.max(1, foe.stats.spe)
    const power = ratio >= 4 ? 150 : ratio >= 3 ? 120 : ratio >= 2 ? 80 : ratio >= 1 ? 60 : 40
    return { power, note: "Stronger when you are faster than them." }
  }
  if (id === "lowkick" || id === "grassknot") {
    const weight = foe.weight
    const power = weight >= 200 ? 120 : weight >= 100 ? 100 : weight >= 50 ? 80 : weight >= 25 ? 60 : weight >= 10 ? 40 : 20
    return { power, note: "Stronger against a heavier Pokémon." }
  }
  if (id === "heavyslam" || id === "heatcrash") {
    const ratio = you.weight / Math.max(0.1, foe.weight)
    const power = ratio >= 5 ? 120 : ratio >= 4 ? 100 : ratio >= 3 ? 80 : ratio >= 2 ? 60 : 40
    return { power, note: "Stronger when you are heavier than them." }
  }
  if (id === "magnitude") return { power: 70, note: "Magnitude's strength is random. This uses a middle roll." }
  if (id === "facade") return { power: 70, note: "Doubles if you are burned, poisoned, or paralyzed. This assumes you are healthy." }
  if (id === "hex" || id === "venoshock" || id === "infernalparade") {
    return { power: move.bp || 65, note: "Doubles if they are statused. This assumes they are not." }
  }
  if (id === "storedpower" || id === "powertrip") return { power: 20, note: "Rises with your stat boosts. This assumes none." }
  if (id === "ragefist" || id === "lastrespects") return { power: 50, note: "This is the starting power. It grows as the fight goes on." }
  if (id === "knockoff") return { power: 65, note: "Half again as strong if they hold an item." }
  if (id === "weatherball") {
    if (weather === "sun") return { power: 100, type: "Fire" as TypeName, note: "Weather Ball becomes Fire in the sun." }
    if (weather === "rain") return { power: 100, type: "Water" as TypeName, note: "Weather Ball becomes Water in the rain." }
    if (weather === "sand") return { power: 100, type: "Rock" as TypeName, note: "Weather Ball becomes Rock in a sandstorm." }
    return { power: 50, note: "Weather Ball stays a weak Normal move until the weather changes." }
  }
  if (move.bp > 0) return { power: move.bp }
  return { power: 0 }
}

function hitCount(move: CatalogMove, ability: string | null) {
  if (!move.multihit) return { hits: 1, note: null as string | null }
  if (typeof move.multihit === "number") {
    return {
      hits: move.multihit,
      note: move.multihit > 1 ? `Hits ${move.multihit} times.` : null,
    }
  }
  const [min, max] = move.multihit
  if (ability === "skilllink") return { hits: max, note: `Skill Link makes all ${max} hits connect.` }
  if (min === 2 && max === 5) return { hits: 3, note: "Hits 2 to 5 times. The size assumes 3, the usual average." }
  return { hits: (min + max) / 2, note: `Hits ${min} to ${max} times.` }
}

function fixedDamage(move: CatalogMove, you: Fighter, foe: Fighter) {
  if (move.damage === "level") return you.level
  if (typeof move.damage === "number" && move.damage > 0) return move.damage
  if (move.id === "superfang" || move.id === "naturesmadness" || move.id === "ruination") {
    return Math.max(1, Math.floor(foe.currentHp / 2))
  }
  if (move.id === "endeavor") return Math.max(0, foe.currentHp - you.currentHp)
  if (move.id === "finalgambit") return you.currentHp
  return null
}

type Prepared = {
  type: string
  notes: string[]
  mod: number
  blocked?: "hidden-power"
}

function prepareMove(move: CatalogMove, attacker: Fighter, weatherType?: TypeName): Prepared {
  const notes: string[] = []
  let type = weatherType || move.type
  let mod = 1
  const ability = attacker.abilityId || ""
  if (move.id === "hiddenpower") {
    const chosen = attacker.hiddenPower[move.id]
    if (!chosen) return { type: move.type, notes, mod, blocked: "hidden-power" }
    type = chosen
    notes.push(`Hidden Power is ${chosen} here. On Revolution Online it is 60 power and special, and it is never Normal or Fairy.`)
  }
  if (move.category !== "Status" && move.id !== "hiddenpower" && ability === "normalize") {
    type = "Normal"
    mod *= 1.2
    notes.push("Normalize makes this a Normal move and boosts it.")
  } else if (move.category !== "Status" && type === "Normal" && CONVERTERS[ability] && move.id !== "hiddenpower") {
    const converted = CONVERTERS[ability]
    type = converted.type
    mod *= 1.2
    notes.push(converted.note)
  }
  return { type, notes, mod }
}

function attackerMods(move: CatalogMove, attacker: Fighter, type: string, power: number) {
  const notes: string[] = []
  const mods: number[] = []
  const ability = attacker.abilityId || ""
  const boost = TYPE_BOOSTS[ability]
  if (boost && boost.type === type) {
    mods.push(boost.mod)
    notes.push(boost.note)
  }
  if (ability === "technician" && power > 0 && power <= 60) {
    mods.push(1.5)
    notes.push("Technician boosts this because its power is 60 or less.")
  }
  if (ability === "toughclaws" && move.flags.includes("contact")) {
    mods.push(1.3)
    notes.push("Tough Claws boosts contact moves.")
  }
  if (ability === "ironfist" && move.flags.includes("punch")) {
    mods.push(1.2)
    notes.push("Iron Fist boosts punch moves.")
  }
  if (ability === "strongjaw" && move.flags.includes("bite")) {
    mods.push(1.5)
    notes.push("Strong Jaw boosts bite moves.")
  }
  if (ability === "megalauncher" && move.flags.includes("pulse")) {
    mods.push(1.5)
    notes.push("Mega Launcher boosts pulse moves.")
  }
  if (ability === "sharpness" && move.flags.includes("slicing")) {
    mods.push(1.5)
    notes.push("Sharpness boosts slicing moves.")
  }
  if (ability === "reckless" && move.recoil) {
    mods.push(1.2)
    notes.push("Reckless boosts recoil moves.")
  }
  if (ability === "sheerforce" && move.chance) {
    mods.push(1.3)
    notes.push("Sheer Force makes this hit harder and drops the extra effect.")
  }
  if (
    (ability === "hugepower" || ability === "purepower") &&
    move.category === "Physical" &&
    move.offStat !== "def" &&
    move.id !== "foulplay"
  ) {
    notes.push(ability === "hugepower" ? "Huge Power doubles Attack, and that is included." : "Pure Power doubles Attack, and that is included.")
  }
  return { mods, notes }
}

function defenderMods(type: string, move: CatalogMove, defender: Fighter, typeFactor: number, ignoreAbility: boolean) {
  const notes: string[] = []
  const mods: number[] = []
  if (ignoreAbility) return { mods, notes }
  const ability = defender.abilityId || ""
  if (ability === "thickfat" && (type === "Fire" || type === "Ice")) {
    mods.push(0.5)
    notes.push("Thick Fat cuts Fire and Ice damage in half.")
  }
  if (ability === "heatproof" && type === "Fire") {
    mods.push(0.5)
    notes.push("Heatproof cuts Fire damage in half.")
  }
  if (ability === "waterbubble" && type === "Fire") {
    mods.push(0.5)
    notes.push("Water Bubble cuts Fire damage in half.")
  }
  if (ability === "dryskin" && type === "Fire") {
    mods.push(1.25)
    notes.push("Dry Skin makes Fire hit a bit harder.")
  }
  if (ability === "fluffy" && type === "Fire") {
    mods.push(2)
    notes.push("Fluffy doubles Fire damage.")
  }
  if (ability === "fluffy" && move.flags.includes("contact")) {
    mods.push(0.5)
    notes.push("Fluffy halves moves that make contact.")
  }
  if ((ability === "filter" || ability === "solidrock" || ability === "prismarmor") && typeFactor > 1) {
    mods.push(0.75)
    notes.push("This ability softens super-effective hits.")
  }
  if (ability === "furcoat" && move.category === "Physical") {
    mods.push(0.5)
    notes.push("Fur Coat halves physical hits.")
  }
  if (ability === "icescales" && move.category === "Special") {
    mods.push(0.5)
    notes.push("Ice Scales halves special hits.")
  }
  if ((ability === "multiscale" || ability === "shadowshield") && defender.hpPercent >= 100) {
    mods.push(0.5)
    notes.push("At full health, the first hit is halved.")
  }
  if (ability === "purifyingsalt" && type === "Ghost") {
    mods.push(0.5)
    notes.push("Purifying Salt halves Ghost damage.")
  }
  return { mods, notes }
}

const MOLD_BREAK = new Set(["moldbreaker", "teravolt", "turboblaze"])

function roll(level: number, power: number, atk: number, def: number, mods: number[], hits: number) {
  if (power <= 0 || atk <= 0 || def <= 0) return { low: 0, high: 0 }
  const levelFactor = Math.floor((2 * level) / 5) + 2
  let base = Math.floor(Math.floor((levelFactor * Math.floor(power) * atk) / def) / 50) + 2
  for (const mod of mods) {
    if (mod !== 1) base = Math.floor(base * mod)
  }
  const low = Math.max(1, Math.floor(base * 0.85))
  return { low: Math.floor(low * hits), high: Math.floor(base * hits) }
}

function targetsFoe(move: CatalogMove) {
  const target = move.target || "normal"
  return target !== "self" && target !== "allySide" && target !== "ally" && target !== "allies"
}

function statusBlocked(move: CatalogMove, you: Fighter, foe: Fighter) {
  if (!targetsFoe(move)) return null
  if (foe.abilityId === "goodasgold") return "Good as Gold ignores status moves."
  if (move.flags.includes("powder") && (foe.types.includes("Grass") || foe.abilityId === "overcoat")) {
    return foe.types.includes("Grass") ? "Grass types are immune to powder moves." : "Overcoat blocks powder moves."
  }
  const prepared = prepareMove(move, you)
  const match = explainMatchup({
    moveType: prepared.type,
    moveId: move.id,
    defenderTypes: foe.types,
    defenderAbility: foe.abilityId,
    attackerAbility: you.abilityId,
    flags: move.flags,
  })
  if (match.factor === 0) return match.notes[0] || match.sentence
  if (move.status === "brn" && foe.types.includes("Fire")) return "Fire types cannot be burned."
  if ((move.status === "psn" || move.status === "tox") && (foe.types.includes("Poison") || foe.types.includes("Steel"))) {
    return "Poison and Steel types cannot be poisoned."
  }
  if (move.status === "par" && foe.abilityId === "limber") return "Limber prevents paralysis."
  if (move.status === "slp" && (foe.abilityId === "insomnia" || foe.abilityId === "vitalspirit")) {
    return "This ability prevents sleep."
  }
  return null
}

function statusPlan(move: CatalogMove, you: Fighter, foe: Fighter, threatPercent: number, youFaster: boolean) {
  const blocked = statusBlocked(move, you, foe)
  if (blocked) return { score: 0, line: blocked, fails: true }
  const boosts = move.selfBoosts || {}
  const raisesOffense = (boosts.atk || 0) > 0 || (boosts.spa || 0) > 0 || (boosts.spe || 0) > 0
  if (move.heal) {
    const score = you.hpPercent <= 70 ? 55 + (70 - you.hpPercent) * 0.4 : 28
    return {
      score: threatPercent >= 100 ? 12 : score,
      line: you.hpPercent <= 70 ? "Heals a big share of your health. Do it if you live the next hit." : "Heals you, but you are not hurt enough for it to be the best click.",
      fails: false,
    }
  }
  if (move.status === "slp") {
    const accuracy = move.acc ?? 100
    return {
      score: accuracy >= 90 ? 74 : 58,
      line: `Puts ${foe.name} to sleep so you can set up or switch. It hits about ${accuracy} times out of 100.`,
      fails: false,
    }
  }
  if (move.status === "brn") {
    const physical = foe.stats.atk >= foe.stats.spa
    return {
      score: physical ? 72 : 48,
      line: physical
        ? "A burn cuts their physical attacks in half and ticks their health."
        : "A burn still ticks them, but their attacks are mostly special, so the cut is smaller.",
      fails: false,
    }
  }
  if (move.status === "par") {
    return {
      score: youFaster ? 46 : 70,
      line: youFaster
        ? "Paralysis makes them slower and they sometimes cannot move. You are already faster, so this is optional."
        : "Paralysis can make them slower than you, and they sometimes cannot move.",
      fails: false,
    }
  }
  if (move.status === "tox" || move.status === "psn") {
    return {
      score: 44,
      line: move.status === "tox" ? "Badly poisons them. The damage grows each turn, which is a stall plan, not a burst." : "Poisons them for a little damage each turn.",
      fails: false,
    }
  }
  if (raisesOffense) {
    const threatened = threatPercent >= 70
    return {
      score: threatened ? 18 : 64,
      line: threatened
        ? "Raising a stat is wasted if you faint before you use it."
        : "You can take a hit, so raising your offense pays off on the next turn.",
      fails: false,
    }
  }
  if (move.volatile === "protect" || ["protect", "detect", "banefulbunker", "spikyshield", "kingsshield", "obstruct", "silktrap"].includes(move.id)) {
    return { score: 22, line: "Buys one turn. It fails if you use it every turn, so it is not a plan by itself.", fails: false }
  }
  if (move.sideCondition && /screen|veil/i.test(move.sideCondition)) {
    return { score: 36, line: "Puts up a screen that cuts the next hits. Best right before you switch.", fails: false }
  }
  if (["stealthrock", "spikes", "toxicspikes", "stickyweb", "ceaselessedge"].includes(move.id)) {
    return { score: 34, line: "Hurts the next Pokémon they send in. It does not win this turn.", fails: false }
  }
  if (move.forceSwitch) return { score: 30, line: "Forces them to switch. You give up your attack to change who is in.", fails: false }
  if (move.weather) return { score: 40, line: `${move.name} changes the weather, which changes which types hit harder.`, fails: false }
  return { score: 16, line: move.desc || "A status move. It does not deal direct damage.", fails: false }
}

function rateAttack(
  move: CatalogMove,
  attacker: Fighter,
  defender: Fighter,
  weather: Weather,
  threatLow: number,
  threatPriority: number,
  attackerFirstOnTie: boolean,
): Rated {
  const powered = powerFor(move, attacker, defender, weather)
  const prepared = prepareMove(move, attacker, powered.type)
  const type = prepared.type
  const match = explainMatchup({
    moveType: type,
    moveId: move.id,
    defenderTypes: defender.types,
    defenderAbility: defender.abilityId,
    attackerAbility: attacker.abilityId,
    flags: move.flags,
  })
  const notes = [...prepared.notes, ...match.notes]
  if (powered.note) notes.push(powered.note)

  if (prepared.blocked === "hidden-power") {
    return {
      move,
      type,
      factor: null,
      low: 0,
      high: 0,
      acc: 1,
      priority: move.priority || 0,
      sentence: "Set the Hidden Power type from the summary. Until you do, this click is a guess.",
      notes,
      stabNote: null,
      label: "Set the type",
      score: 1,
      kos: false,
      diesFirst: false,
      text: "Hidden Power's type is not set.",
      kind: "hidden-power",
    }
  }

  const stab = attacker.types.includes(type as TypeName)
    ? attacker.abilityId === "adaptability"
      ? { mod: 2, note: `${attacker.name} has Adaptability, so the same-type bonus is a full double.` }
      : { mod: 1.5, note: `${attacker.name} is ${type} type, so this move hits half again as hard.` }
    : { mod: 1, note: null }
  if (stab.note) notes.push(stab.note)

  const abilityMods = attackerMods(move, attacker, type, powered.power)
  notes.push(...abilityMods.notes)
  const defense = defenderMods(type, move, defender, match.typeFactor, MOLD_BREAK.has(attacker.abilityId || ""))
  notes.push(...defense.notes)

  const hits = hitCount(move, attacker.abilityId)
  if (hits.note) notes.push(hits.note)
  if (move.recoil) notes.push("This also hurts you.")
  if (move.drain) notes.push("You heal from some of the damage.")
  if (move.selfSwitch) notes.push("You switch out after this.")
  if (move.willCrit) notes.push("This always crits, and that is included.")
  if ((move.selfBoosts?.def || 0) < 0 || (move.selfBoosts?.spd || 0) < 0) notes.push("Your defenses drop after you use it.")
  if (move.priority > 0) notes.push("This usually goes before a normal move.")
  if (move.priority < 0) notes.push("This goes after normal moves.")
  if (move.id === "suckerpunch") notes.push("It fails if they do not use a damaging move.")

  const weatherMod =
    weather === "sun" && type === "Fire"
      ? 1.5
      : weather === "sun" && type === "Water"
        ? 0.5
        : weather === "rain" && type === "Water"
          ? 1.5
          : weather === "rain" && type === "Fire"
            ? 0.5
            : 1
  if (weatherMod !== 1) {
    notes.push(weather === "sun" ? "Sun boosts Fire and weakens Water." : "Rain boosts Water and weakens Fire.")
  }

  let atk = move.category === "Physical" ? attacker.stats.atk : attacker.stats.spa
  let def = move.category === "Physical" ? defender.stats.def : defender.stats.spd
  if (move.offStat === "def") atk = attacker.stats.def
  if (move.offStat === "atk") atk = attacker.stats.atk
  if (move.offStat === "spa") atk = attacker.stats.spa
  if (move.defStat === "def") def = defender.stats.def
  if (move.defStat === "spd") def = defender.stats.spd
  if (move.id === "foulplay") atk = defender.stats.atk
  if ((attacker.abilityId === "hugepower" || attacker.abilityId === "purepower") && move.category === "Physical" && move.offStat !== "def" && move.id !== "foulplay") {
    atk *= 2
  }
  if (attacker.abilityId === "solarpower" && weather === "sun" && move.category === "Special") {
    atk = Math.floor(atk * 1.5)
    notes.push("Solar Power boosts Special Attack in the sun.")
  }
  if (weather === "sand" && defender.types.includes("Rock") && (move.defStat === "spd" || (move.category === "Special" && move.defStat !== "def"))) {
    def = Math.floor(def * 1.5)
    notes.push("Sand boosts a Rock type's Special Defense.")
  }

  const mods = [weatherMod, stab.mod, match.factor, prepared.mod, ...abilityMods.mods, ...defense.mods]
  if (move.willCrit) mods.push(1.5)

  const fixed = fixedDamage(move, attacker, defender)
  let low = 0
  let high = 0
  if (match.factor === 0) {
    low = 0
    high = 0
  } else if (move.ohko) {
    low = defender.currentHp
    high = defender.currentHp
    notes.push("A one-hit KO move. It misses often, and it fails if you are slower.")
  } else if (fixed != null) {
    low = fixed
    high = fixed
  } else if (powered.power > 0) {
    const rolled = roll(attacker.level, powered.power, atk, def, mods, hits.hits)
    low = rolled.low
    high = rolled.high
  }

  const acc = move.acc == null ? 1 : Math.max(0, move.acc) / 100
  const text =
    match.factor === 0
      ? "It does nothing."
      : move.ohko
        ? `If it hits and you are faster, it knocks ${defender.name} out. Accuracy is ${move.acc ?? 30}%.`
        : damageText(low, high, defender.stats.hp, defender.currentHp, defender.name)

  const youSpeed = effectiveSpeed(attacker, weather).speed
  const foeSpeed = effectiveSpeed(defender, weather).speed
  const youFirst =
    move.priority > threatPriority ||
    (move.priority === threatPriority && youSpeed > foeSpeed) ||
    (move.priority === threatPriority && youSpeed === foeSpeed && attackerFirstOnTie)
  const diesFirst = !youFirst && threatLow >= attacker.currentHp && threatLow > 0
  const kos = match.factor !== 0 && low >= defender.currentHp && !move.ohko
  const ohkoLands = Boolean(move.ohko) && youFirst
  const expected = ((low + high) / 2 / Math.max(1, defender.stats.hp)) * 100 * (move.id === "suckerpunch" ? acc * 0.75 : acc)
  let score = match.factor === 0 ? 0 : Math.min(expected, 130)
  if ((kos || ohkoLands) && youFirst) score += 100
  else if (kos && youSpeed === foeSpeed) score += 35
  if (diesFirst && !ohkoLands) score *= 0.2
  if (move.ohko && !youFirst) score = 8
  if (move.priority > 0 && !youFirst && foeSpeed > youSpeed && low > 0) score += 18

  return {
    move,
    type,
    factor: match.factor,
    low,
    high,
    acc,
    priority: move.priority || 0,
    sentence: match.sentence,
    notes,
    stabNote: stab.note,
    label: formatFactor(match.factor),
    score,
    kos: kos || ohkoLands,
    diesFirst,
    text: acc < 1 && match.factor !== 0 && !move.ohko ? `${text} It hits ${Math.round(acc * 100)} times out of 100.` : text,
    kind: "attack",
  }
}

function hypotheticalThreat(attacker: Fighter, defender: Fighter, weather: Weather) {
  const category: MoveCategory = attacker.stats.atk >= attacker.stats.spa ? "Physical" : "Special"
  const options = attacker.types.map((type) => {
    const move: CatalogMove = {
      id: `typical-${type.toLowerCase()}`,
      name: `a typical ${type} move`,
      type,
      category,
      bp: 80,
      acc: null,
      pp: 10,
      priority: 0,
      desc: "",
      flags: [],
    }
    return rateAttack(move, attacker, defender, weather, 0, -7, false)
  })
  options.sort((a, b) => b.low - a.low)
  const worst = options[0]
  const immune = options.filter((option) => option.factor === 0)
  const immuneLine = immune.map((option) => `${option.type} moves do nothing to ${defender.name}.`).join(" ")
  const line = `${attacker.name} is ${joinTypes(attacker.types)}. A normal same-type ${category.toLowerCase()} move is ${lowerFirst(worst?.text ?? "unknown")} ${immuneLine}`.replace(/\s+/g, " ").trim()
  return { low: worst?.low ?? 0, priority: 0, line, factor: worst?.factor ?? 1 }
}

function knownThreat(attacker: Fighter, defender: Fighter, weather: Weather) {
  const attacks = attacker.moves.filter((move) => move.category !== "Status")
  if (attacks.length === 0) return hypotheticalThreat(attacker, defender, weather)
  const rated = attacks.map((move) => rateAttack(move, attacker, defender, weather, 0, -7, false))
  rated.sort((a, b) => b.low * b.acc - a.low * a.acc)
  const worst = rated[0]
  return {
    low: worst.low,
    priority: worst.priority,
    factor: worst.factor,
    line: `Their ${worst.move.name} is ${lowerFirst(worst.text)} ${worst.sentence}`,
  }
}

function lessonFor(rated: Rated | undefined, verdict: Advice["verdict"], foe: Fighter, you: Fighter): keyof typeof LESSONS {
  if (!rated) {
    if (foe.types.includes("Shadow") || you.types.includes("Shadow")) return "shadow"
    return "super"
  }
  if (rated.kind === "hidden-power" || rated.move.id === "hiddenpower") return "hiddenpower"
  if (rated.notes.some((note) => /Levitate|Flash Fire|Absorb|Sap Sipper|Storm Drain|Lightning Rod|Wonder Guard|Earth Eater|Well-Baked|Motor Drive/.test(note))) {
    return "ability"
  }
  if (rated.type === "Shadow" || foe.types.includes("Shadow") || you.types.includes("Shadow")) return "shadow"
  if ((rated.factor ?? 0) >= 4) return "stack"
  if (/cancel/i.test(rated.sentence)) return "cancel"
  if (rated.factor === 0) return "immune"
  if (verdict === "switch") return "switch"
  if (rated.priority > 0 && rated.diesFirst === false && rated.notes.some((note) => note.includes("before a normal move"))) return "priority"
  if (rated.diesFirst) return "speed"
  if (rated.stabNote) return "stab"
  if ((rated.factor ?? 0) >= 2) return "super"
  if ((rated.factor ?? 0) > 0 && (rated.factor ?? 1) < 1) return "resist"
  if (rated.kind === "status") return rated.move.status === "par" || rated.diesFirst ? "speed" : "split"
  return "split"
}

export function advise(you: Fighter, foe: Fighter, bench: Fighter[], weather: Weather): Advice {
  const youSpeed = effectiveSpeed(you, weather)
  const foeSpeed = effectiveSpeed(foe, weather)
  const edge = youSpeed.speed === foeSpeed.speed ? "tie" : youSpeed.speed > foeSpeed.speed ? "you" : "foe"
  const speedGuess =
    you.statsAreReal && foe.statsAreReal
      ? ""
      : " Speed here is a guess from base stats, level, and nature, with no extra Speed training. The summary window has the real number."
  const abilitySpeed = [youSpeed.note, foeSpeed.note].filter(Boolean).join(" ")
  const speedLine =
    edge === "you"
      ? `You are faster (${youSpeed.speed} vs ${foeSpeed.speed}), so a normal move goes first.${speedGuess} ${abilitySpeed}`.trim()
      : edge === "foe"
        ? `${foe.name} is faster (${foeSpeed.speed} vs ${youSpeed.speed}), so they move first.${speedGuess} ${abilitySpeed}`.trim()
        : `Speed is tied at ${youSpeed.speed}. Whoever invested more Speed goes first.${speedGuess}`.trim()

  const threat = knownThreat(foe, you, weather)
  const threatLine = threat.line

  const reads: Rated[] = you.moves.map((move) => {
    if (move.category === "Status") {
      const plan = statusPlan(move, you, foe, (threat.low / Math.max(1, you.stats.hp)) * 100, edge === "you")
      return {
        move,
        type: move.type,
        factor: plan.fails ? 0 : 1,
        low: 0,
        high: 0,
        acc: move.acc == null ? 1 : move.acc / 100,
        priority: move.priority || 0,
        sentence: plan.line,
        notes: [],
        stabNote: null,
        label: plan.fails ? "Blocked" : "Status",
        score: plan.score,
        kos: false,
        diesFirst: edge === "foe" && threat.low >= you.currentHp,
        text: plan.line,
        kind: plan.fails ? "fail" : "status",
        statusLine: plan.line,
      } satisfies Rated
    }
    return rateAttack(move, you, foe, weather, threat.low, threat.priority, false)
  })

  const attacks = reads.filter((read) => read.kind === "attack")
  const statuses = reads.filter((read) => read.kind === "status")
  const bestAttack = [...attacks].sort((a, b) => b.score - a.score)[0]
  const bestStatus = [...statuses].sort((a, b) => b.score - a.score)[0]

  const switches: SwitchRead[] = bench
    .map((mon) => {
      const incoming = knownThreat(foe, mon, weather)
      const dies = incoming.low >= mon.currentHp && incoming.low > 0
      const best = mon.moves
        .filter((move) => move.category !== "Status")
        .map((move) => rateAttack(move, mon, foe, weather, incoming.low, incoming.priority, false))
        .sort((a, b) => b.score - a.score)[0]
      const incomingFactor = incoming.factor ?? 1
      const resist = incomingFactor > 0 && incomingFactor <= 0.5
      const immune = incomingFactor === 0
      let score = 0
      if (!dies && best) score = Math.min(110, best.score) + (immune ? 28 : resist ? 16 : 0)
      else if (!dies && !best) score = immune ? 24 : 8
      const snippet = lowerFirst((incoming.line.match(/about [^.]+\.|It does nothing\./i)?.[0] ?? "a chunk").replace(/\.$/, ""))
      const hit = dies
        ? `${foe.name} knocks ${mon.name} out on the turn you switch.`
        : incoming.low <= 0
          ? `${foe.name}'s likely attack does nothing to ${mon.name}.`
          : `On the switch, ${foe.name} hits ${mon.name} for ${snippet}.`
      const answer = best
        ? best.factor === 0
          ? `${best.move.name} does nothing to ${foe.name}.`
          : `${best.move.name} is ${best.label.toLowerCase()} and ${best.text.charAt(0).toLowerCase()}${best.text.slice(1)}`
        : `${mon.name} has no damaging moves filled in.`
      return {
        name: mon.name,
        reason: `${hit} ${answer}`.replace(/\s+/g, " ").trim(),
        recommended: false,
        score,
      }
    })
    .sort((a, b) => b.score - a.score)

  const bestSwitch = switches[0]
  const attackScore = bestAttack?.score ?? 0
  const statusScore = bestStatus?.score ?? 0
  const switchScore = bestSwitch?.score ?? 0
  const unsetHiddenPower = reads.find((read) => read.kind === "hidden-power")
  const safeKo = Boolean(bestAttack?.kos && !bestAttack.diesFirst && edge !== "tie")

  let verdict: Advice["verdict"] = "rough"
  let chosen: Rated | undefined = bestAttack
  if (unsetHiddenPower && !safeKo && attackScore < 30) {
    verdict = "rough"
    chosen = unsetHiddenPower
  } else if (safeKo) {
    verdict = "stay"
    chosen = bestAttack
  } else if (bestSwitch && switchScore >= Math.max(attackScore, statusScore) + 12 && switchScore >= 40) {
    verdict = "switch"
    chosen = bestAttack
  } else if (bestStatus && statusScore >= attackScore + 8 && (bestAttack?.diesFirst || attackScore < 45)) {
    verdict = "stay"
    chosen = bestStatus
  } else if (bestAttack && attackScore > 8) {
    const attackFactor = bestAttack.factor ?? 1
    verdict = attackFactor > 0 && attackFactor < 1 && attackScore < 28 && !(bestSwitch && switchScore > attackScore) ? "rough" : "stay"
    chosen = bestAttack
  } else if (bestSwitch && switchScore > 0) {
    verdict = "switch"
  } else if (bestStatus) {
    verdict = "stay"
    chosen = bestStatus
  }

  if (verdict === "switch" && bestSwitch) bestSwitch.recommended = true

  const paragraphs: string[] = []
  let headline = "Wait for a better read."
  let kicker = "Rough spot"

  if (you.moves.length === 0) {
    kicker = "Need moves"
    headline = "Add the moves you are carrying."
    paragraphs.push(
      `${foe.name} is ${joinTypes(foe.types)}. ${defensiveList(foe.types, foe.abilityId)
        .filter((row) => row.factor >= 2)
        .slice(0, 3)
        .map((row) => `${row.type} hits ${row.factor === 4 ? "four times as hard" : "twice as hard"}`)
        .join(", ") || "Nothing is super effective from the type chart alone"}.`,
    )
    paragraphs.push("Fill in the four moves and Slate will tell you which one to click.")
    verdict = "rough"
  } else if (verdict === "switch" && bestSwitch) {
    kicker = "Switch"
    headline = `Bring in ${bestSwitch.name}.`
    paragraphs.push(
      bestAttack
        ? `If you stay, ${bestAttack.move.name} is your best click. ${bestAttack.sentence} ${bestAttack.text}`
        : `${you.name} does not have a damaging move that threatens ${foe.name}.`,
    )
    paragraphs.push(bestSwitch.reason)
    paragraphs.push("On the turn you switch you do not attack. They hit the Pokémon you send in.")
  } else if (chosen?.kind === "status") {
    kicker = "Stay in"
    headline = `Click ${chosen.move.name}.`
    paragraphs.push(`${foe.name} is ${joinTypes(foe.types)}.`)
    paragraphs.push(chosen.statusLine || chosen.sentence)
    if (bestAttack) paragraphs.push(`Your best attack is ${bestAttack.move.name}. ${bestAttack.sentence} ${bestAttack.text}`)
  } else if (chosen && chosen.kind === "attack") {
    kicker = safeKo ? "Stay in" : verdict === "rough" ? "Rough spot" : "Stay in"
    headline = verdict === "rough" ? `${chosen.move.name} is the least bad click.` : `Click ${chosen.move.name}.`
    paragraphs.push(`${foe.name} is ${joinTypes(foe.types)}. ${chosen.sentence}`)
    if (chosen.stabNote) paragraphs.push(chosen.stabNote)
    const extra = chosen.notes.filter((note) => note !== chosen.stabNote).slice(0, 2)
    paragraphs.push(chosen.text)
    if (extra.length) paragraphs.push(extra.join(" "))
    if (safeKo) paragraphs.push("Do not switch. A switch gives them a free hit, and this already knocks them out.")
    else if (chosen.diesFirst) paragraphs.push(`You faint before ${chosen.move.name} lands if they attack.`)
    else if (bestSwitch && bestSwitch.score > attackScore && (chosen.factor ?? 1) < 2) {
      paragraphs.push(`${bestSwitch.name} is the cleaner switch if this hit is not enough.`)
    }
  } else if (chosen?.kind === "hidden-power") {
    kicker = "Set the type"
    headline = "Set Hidden Power's type."
    paragraphs.push(chosen.sentence)
    paragraphs.push("Open the summary in the game. Hidden Power shows its real type there. It is never Normal or Fairy on Revolution Online.")
    if (bestSwitch && bestSwitch.score >= 40) {
      paragraphs.push(`Until that type is set, ${bestSwitch.name} is the safer plan. ${bestSwitch.reason}`)
    }
  } else {
    kicker = "Rough spot"
    headline = `Nothing on ${you.name} threatens ${foe.name}.`
    paragraphs.push(`${foe.name} is ${joinTypes(foe.types)}.`)
    paragraphs.push(threatLine)
  }

  const lessonId = you.moves.length === 0 ? "super" : lessonFor(chosen, verdict, foe, you)
  const recommendedId = verdict === "switch" ? null : chosen?.move.id
  const moves: MoveRead[] = reads.map((read) => ({
    id: read.move.id,
    name: read.move.name,
    type: read.type,
    category: read.move.category,
    factor: read.kind === "hidden-power" ? null : read.factor,
    label: read.label,
    detail: [read.sentence, ...read.notes.filter((note) => note !== read.sentence)].filter(Boolean).slice(0, 3).join(" "),
    damageText: read.kind === "attack" ? read.text : read.statusLine || null,
    recommended: recommendedId != null && read.move.id === recommendedId && read.kind === chosen?.kind,
    score: read.score,
    priority: read.priority,
  }))

  const estimateNote =
    you.statsAreReal && foe.statsAreReal
      ? "Using the summary stats you typed in. Items, critical hits, and screens are still not included."
      : "Sizes use untrained stats: perfect individual values, no stat training, the nature you picked, and the level. Type the six numbers from the summary and this uses their real stats. Items, critical hits, and screens are not included."

  return {
    verdict,
    kicker,
    headline,
    paragraphs: paragraphs.map((paragraph) => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 5),
    lessonId,
    moves,
    switches: switches.slice(0, 3),
    speedLine,
    threatLine,
    estimateNote,
    theyWeak: defensiveList(foe.types, foe.abilityId)
      .filter((row) => row.factor >= 2)
      .map((row) => ({ type: row.type, factor: row.factor })),
    youWeak: defensiveList(you.types, you.abilityId)
      .filter((row) => row.factor >= 2)
      .map((row) => ({ type: row.type, factor: row.factor })),
  }
}
