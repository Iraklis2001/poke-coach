import type { TypeName } from "@/lib/types"

const CHART: Record<string, Record<string, number>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: {
    Fire: 0.5,
    Water: 2,
    Grass: 0.5,
    Poison: 0.5,
    Ground: 2,
    Flying: 0.5,
    Bug: 0.5,
    Rock: 2,
    Dragon: 0.5,
    Steel: 0.5,
  },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: {
    Normal: 2,
    Ice: 2,
    Poison: 0.5,
    Flying: 0.5,
    Psychic: 0.5,
    Bug: 0.5,
    Rock: 2,
    Ghost: 0,
    Dark: 2,
    Steel: 2,
    Fairy: 0.5,
  },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: {
    Fire: 0.5,
    Grass: 2,
    Fighting: 0.5,
    Poison: 0.5,
    Flying: 0.5,
    Psychic: 2,
    Ghost: 0.5,
    Dark: 2,
    Steel: 0.5,
    Fairy: 0.5,
  },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Fairy: 2, Steel: 0.5 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
  Shadow: {
    Normal: 2,
    Fire: 2,
    Water: 2,
    Electric: 2,
    Grass: 2,
    Ice: 2,
    Fighting: 2,
    Poison: 2,
    Ground: 2,
    Flying: 2,
    Psychic: 2,
    Bug: 2,
    Rock: 2,
    Ghost: 2,
    Dragon: 2,
    Dark: 2,
    Steel: 2,
    Fairy: 2,
    Shadow: 0.5,
  },
}

const IMMUNE: Record<string, { types: string[]; note: string }> = {
  levitate: { types: ["Ground"], note: "Levitate makes it immune to Ground moves." },
  flashfire: { types: ["Fire"], note: "Flash Fire swallows Fire moves and powers up its own Fire." },
  wellbakedbody: { types: ["Fire"], note: "Well-Baked Body swallows Fire moves." },
  waterabsorb: { types: ["Water"], note: "Water Absorb heals it when it is hit by Water. The move does no damage." },
  dryskin: { types: ["Water"], note: "Dry Skin heals it when it is hit by Water. The move does no damage." },
  stormdrain: { types: ["Water"], note: "Storm Drain pulls Water moves in, and they do no damage." },
  voltabsorb: { types: ["Electric"], note: "Volt Absorb heals it when it is hit by Electric. The move does no damage." },
  lightningrod: { types: ["Electric"], note: "Lightning Rod pulls Electric moves in, and they do no damage." },
  motordrive: { types: ["Electric"], note: "Motor Drive shrugs off Electric moves and raises Speed." },
  sapsipper: { types: ["Grass"], note: "Sap Sipper eats Grass moves and raises Attack. The move does no damage." },
  eartheater: { types: ["Ground"], note: "Earth Eater heals it when it is hit by Ground. The move does no damage." },
}

const MOLD_BREAKERS = new Set(["moldbreaker", "teravolt", "turboblaze"])

export function typeHit(attack: string, defend: string): number {
  if (defend === "Shadow") return attack === "Shadow" ? 0.5 : 1
  return CHART[attack]?.[defend] ?? 1
}

export function formatFactor(factor: number): string {
  if (factor === 0) return "No effect"
  if (factor === 0.25) return "Quarter damage"
  if (factor === 0.5) return "Resisted"
  if (factor === 1) return "Normal"
  if (factor === 2) return "Super effective"
  if (factor === 4) return "Four times"
  if (factor > 4) return `${factor}×`
  const rounded = Math.round(factor * 100) / 100
  return `${rounded}×`
}

function relation(attack: string, defend: string, factor: number): string {
  if (factor === 0) return `${defend} is immune to ${attack}`
  if (factor < 1) return `${defend} resists ${attack}`
  if (factor > 1) return `${attack} is super effective on ${defend}`
  return `${defend} takes a normal hit from ${attack}`
}

export function explainParts(attack: string, parts: { type: string; factor: number }[]): string {
  const factor = parts.reduce((product, part) => product * part.factor, 1)
  if (parts.length === 0) return "There is no defending type to compare."
  if (parts.length === 1) {
    const part = parts[0]
    if (part.factor === 0) return `${part.type} types are immune to ${attack}. This does nothing.`
    if (part.factor === 0.5) return `${part.type} resists ${attack}, so this hits half as hard.`
    if (part.factor === 2) return `${attack} is super effective on ${part.type}. Twice as hard.`
    if (part.factor === 4) return `${attack} hits ${part.type} four times as hard.`
    return `${part.type} neither resists nor is weak to ${attack}. A normal hit.`
  }

  const immune = parts.find((part) => part.factor === 0)
  if (immune) {
    return `${immune.type} is immune to ${attack}. This does nothing. The other type does not change that.`
  }

  const [first, second] = parts
  if (first.factor === 2 && second.factor === 2) {
    return `${attack} is super effective on both ${first.type} and ${second.type}. Those stack, so this hits four times as hard.`
  }
  if (first.factor === 0.5 && second.factor === 0.5) {
    return `Both ${first.type} and ${second.type} resist ${attack}. A quarter of a normal hit.`
  }
  if ((first.factor === 2 && second.factor === 0.5) || (first.factor === 0.5 && second.factor === 2)) {
    const weak = parts.find((part) => part.factor === 2)!
    const resist = parts.find((part) => part.factor === 0.5)!
    return `${weak.type} is weak to ${attack}, but ${resist.type} resists it. They cancel to a normal hit.`
  }
  if (factor === 2) {
    const weak = parts.find((part) => part.factor > 1)!
    const other = parts.find((part) => part !== weak)!
    return `${attack} is super effective on ${weak.type}, and ${other.type} does not resist it. Twice as hard.`
  }
  if (factor === 0.5) {
    const resist = parts.find((part) => part.factor < 1)!
    const other = parts.find((part) => part !== resist)!
    return `${resist.type} resists ${attack}, and ${other.type} does not add a weakness. Half as hard.`
  }
  if (factor === 1 && parts.every((part) => part.factor === 1)) {
    return `Neither ${first.type} nor ${second.type} is weak or resistant to ${attack}. A normal hit.`
  }
  return parts.map((part) => relation(attack, part.type, part.factor)).join(". ") + "."
}

export type Matchup = {
  factor: number
  typeFactor: number
  sentence: string
  notes: string[]
  parts: { type: string; factor: number }[]
}

function product(parts: { factor: number }[]) {
  return parts.reduce((total, part) => total * part.factor, 1)
}

export function explainMatchup(args: {
  moveType: string
  moveId?: string
  defenderTypes: string[]
  defenderAbility?: string | null
  attackerAbility?: string | null
  flags?: string[]
}): Matchup {
  const attack = args.moveType
  const types = args.defenderTypes.length > 0 ? args.defenderTypes : ["Normal"]
  const moveId = args.moveId || ""
  const flags = args.flags || []
  const attackerAbility = args.attackerAbility || ""
  const defenderAbility = args.defenderAbility || ""
  const notes: string[] = []
  const ignoreAbility = MOLD_BREAKERS.has(attackerAbility)

  let parts = types.map((type) => ({ type, factor: typeHit(attack, type) }))

  if (moveId === "freezedry") {
    parts = parts.map((part) => (part.type === "Water" ? { ...part, factor: 2 } : part))
    notes.push("Freeze-Dry is Ice, but it is super effective on Water.")
  }

  if (moveId === "thousandarrows") {
    parts = parts.map((part) => (part.type === "Flying" ? { ...part, factor: Math.max(part.factor, 1) } : part))
    notes.push("Thousand Arrows hits Flying types. It does not miss them the way Earthquake does.")
  }

  if ((attack === "Normal" || attack === "Fighting") && attackerAbility === "scrappy") {
    const ghost = parts.find((part) => part.type === "Ghost" && part.factor === 0)
    if (ghost) {
      parts = parts.map((part) => (part.type === "Ghost" ? { ...part, factor: 1 } : part))
      notes.push(`Ghost is normally immune to ${attack}, but Scrappy lets the move hit.`)
    }
  }

  let sentence = explainParts(attack, parts)

  if (moveId === "flyingpress") {
    const flyingParts = types.map((type) => ({ type, factor: typeHit("Flying", type) }))
    const fightingFactor = product(parts)
    const flyingFactor = product(flyingParts)
    parts = [{ type: "combined", factor: fightingFactor * flyingFactor }]
    sentence = `Flying Press counts as Fighting and as Flying. ${explainParts("Fighting", types.map((type) => ({ type, factor: typeHit("Fighting", type) })))} ${explainParts("Flying", flyingParts)} Together, multiply those.`
  }

  const chartFactor = product(parts)
  let factor = chartFactor

  if (!ignoreAbility && defenderAbility && IMMUNE[defenderAbility]?.types.includes(attack)) {
    const blocked =
      moveId === "thousandarrows" && attack === "Ground" && defenderAbility === "levitate"
    if (!blocked) {
      factor = 0
      notes.push(IMMUNE[defenderAbility].note)
    }
  }

  if (moveId === "thousandarrows" && defenderAbility === "levitate") {
    notes.push("Thousand Arrows also hits a Pokémon with Levitate.")
  }

  if (ignoreAbility && defenderAbility && (IMMUNE[defenderAbility] || defenderAbility === "wonderguard")) {
    notes.push("Your ability ignores abilities that would block this move.")
  }

  if (!ignoreAbility && defenderAbility === "wonderguard" && factor < 2) {
    factor = 0
    notes.push("Wonder Guard ignores anything that is not super effective.")
  }

  if (!ignoreAbility && defenderAbility === "bulletproof" && flags.includes("bullet")) {
    factor = 0
    notes.push("Bulletproof blocks ball and bomb moves.")
  }
  if (!ignoreAbility && defenderAbility === "soundproof" && flags.includes("sound")) {
    factor = 0
    notes.push("Soundproof blocks sound moves.")
  }
  if (!ignoreAbility && defenderAbility === "overcoat" && flags.includes("powder")) {
    factor = 0
    notes.push("Overcoat blocks powder moves.")
  }
  if (!ignoreAbility && defenderAbility === "goodasgold" && args.moveType && flags.includes("status")) {
    factor = 0
    notes.push("Good as Gold ignores status moves.")
  }

  const typeFactor = factor

  if (attackerAbility === "tintedlens" && factor > 0 && factor < 1) {
    factor *= 2
    notes.push("Tinted Lens doubles a resisted hit, so the resistance is less painful.")
  }

  if (factor === 0 && chartFactor > 0) {
    const reason = notes.find((note) => /immune|swallows|heals|pulls|eats|shrugs|ignores|blocks|Wonder Guard/i.test(note))
    if (reason) {
      const lowered = sentence.charAt(0).toLowerCase() + sentence.slice(1)
      sentence = `${reason} Without that, ${lowered}`
    }
  }

  return { factor, typeFactor, sentence, notes, parts }
}

export function defensiveList(types: string[], abilityId?: string | null) {
  return (Object.keys(CHART) as TypeName[])
    .map((attack) => {
      const match = explainMatchup({
        moveType: attack,
        defenderTypes: types,
        defenderAbility: abilityId,
      })
      return { type: attack, factor: match.factor, sentence: match.sentence }
    })
    .sort((a, b) => b.factor - a.factor || a.type.localeCompare(b.type))
}

export function offensiveList(attack: string) {
  return (Object.keys(CHART) as TypeName[]).map((defend) => ({
    type: defend,
    factor: typeHit(attack, defend),
  }))
}

export const LESSONS: Record<string, { title: string; body: string }> = {
  stack: {
    title: "Weaknesses stack",
    body: "If both types are weak to the move, it is not two times and it is not three. Each weakness doubles the hit, so two of them make four times. The battle text still only says super effective.",
  },
  super: {
    title: "Super effective is double",
    body: "A super effective move hits twice as hard. The battle text uses the same words for a double hit and a four-times hit, so the words hide how big the difference is.",
  },
  stab: {
    title: "Same-type bonus",
    body: "A move that matches one of your own types hits half again as hard. Flamethrower from a Fire type is stronger than the same Flamethrower from a Water type. People shorten this to STAB.",
  },
  immune: {
    title: "Immune means zero",
    body: "Some types do not take the move at all. It is not a weak hit. The health bar does not move. Ground into Flying, Electric into Ground, Ghost into Normal, and Dragon into Fairy all work this way.",
  },
  resist: {
    title: "Resisted is half",
    body: "A resistance cuts the hit in half. Two resistances cut it to a quarter. That is why a dual type can feel impossible to hurt even when your move looks strong.",
  },
  cancel: {
    title: "A weakness and a resistance can cancel",
    body: "One type weak to the move (double) and the other resisting it (half) multiply to a normal hit. A dual type is not weak just because one of its types is.",
  },
  split: {
    title: "Physical and special hit different stats",
    body: "Physical moves use your Attack against their Defense. Special moves use Special Attack against Special Defense. A huge Attack stat does nothing for Thunderbolt.",
  },
  speed: {
    title: "Faster goes first",
    body: "If their Speed is higher, they hit you before your move. A super effective move still loses if you faint first. The summary window shows the real Speed number.",
  },
  priority: {
    title: "Priority jumps the line",
    body: "Moves like Quick Attack, Aqua Jet, and Extreme Speed go before normal moves, even when you are slower. They are usually weaker, so use them when you would otherwise faint before your real attack.",
  },
  switch: {
    title: "Switching is a turn",
    body: "On the turn you switch, you do not attack, and they hit whoever you send in. It is worth it when that Pokémon resists them and can hit back next turn.",
  },
  hiddenpower: {
    title: "Hidden Power keeps a secret type",
    body: "On Revolution Online, Hidden Power is always a 60-power special move, but the type comes from IVs. It is never Normal or Fairy. The summary shows the type. Set that type here, or the advice is guessing.",
  },
  ability: {
    title: "Abilities can erase a type",
    body: "Levitate makes Ground miss. Flash Fire swallows Fire. Water Absorb, Volt Absorb, and Sap Sipper heal off that type. Read the ability in the summary before you trust the chart alone.",
  },
  shadow: {
    title: "Shadow is a Revolution Online type",
    body: "Shadow moves hit every ordinary type for double damage. Ordinary moves do not hit Shadow any harder than usual. Shadow versus Shadow is a resist.",
  },
}
