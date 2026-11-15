export const TYPES = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
  "Shadow",
] as const

export type TypeName = (typeof TYPES)[number]

export const HIDDEN_POWER_TYPES: TypeName[] = [
  "Fighting",
  "Flying",
  "Poison",
  "Ground",
  "Rock",
  "Bug",
  "Ghost",
  "Steel",
  "Fire",
  "Water",
  "Grass",
  "Electric",
  "Psychic",
  "Ice",
  "Dragon",
  "Dark",
]

export type Weather = "none" | "sun" | "rain" | "sand"

export type StatBlock = {
  hp: number
  atk: number
  def: number
  spa: number
  spd: number
  spe: number
}

export type MoveCategory = "Physical" | "Special" | "Status"

export type CatalogMove = {
  id: string
  name: string
  type: string
  category: MoveCategory
  bp: number
  acc: number | null
  pp: number
  priority: number
  desc: string
  flags: string[]
  status?: string
  volatile?: string
  chance?: number
  riderStatus?: string
  riderVolatile?: string
  heal?: [number, number]
  selfBoosts?: Record<string, number>
  sideCondition?: string
  weather?: string
  damage?: number | "level"
  ohko?: boolean
  multihit?: number | [number, number]
  drain?: [number, number]
  recoil?: [number, number]
  selfSwitch?: boolean
  forceSwitch?: boolean
  willCrit?: boolean
  offStat?: string
  defStat?: string
  ignoreImmunity?: true | Record<string, boolean>
  target?: string
}

export type CatalogSpecies = {
  id: string
  name: string
  num: number
  types: string[]
  stats: StatBlock
  weight: number
  abilities: { id: string; name: string; hidden: boolean }[]
  mega?: boolean
}

export type CatalogAbility = { id: string; name: string; desc: string }

export type CatalogNature = {
  id: string
  name: string
  plus: keyof Omit<StatBlock, "hp"> | null
  minus: keyof Omit<StatBlock, "hp"> | null
}

export type Catalog = {
  species: CatalogSpecies[]
  moves: CatalogMove[]
  abilities: CatalogAbility[]
  natures: CatalogNature[]
}

export type MoveChoice = {
  id: string
  hiddenPower?: string
}

export type Slot = {
  speciesId: string
  level: number
  natureId: string
  abilityId: string
  moves: MoveChoice[]
  types: string[] | null
  stats: Partial<StatBlock> | null
}

export type Fighter = {
  name: string
  types: TypeName[]
  abilityId: string | null
  abilityName: string | null
  level: number
  natureName: string
  base: StatBlock
  stats: StatBlock
  statsAreReal: boolean
  weight: number
  hpPercent: number
  currentHp: number
  moves: CatalogMove[]
  hiddenPower: Record<string, TypeName | undefined>
}

export const TYPE_STYLE: Record<string, { bg: string; fg: string }> = {
  Normal: { bg: "#A8A77A", fg: "#1c1914" },
  Fire: { bg: "#EE8130", fg: "#1c1008" },
  Water: { bg: "#6390F0", fg: "#081225" },
  Electric: { bg: "#F7D02C", fg: "#1c1604" },
  Grass: { bg: "#7AC74C", fg: "#102008" },
  Ice: { bg: "#96D9D6", fg: "#0c1c1c" },
  Fighting: { bg: "#C22E28", fg: "#fff6f4" },
  Poison: { bg: "#A33EA1", fg: "#fff5ff" },
  Ground: { bg: "#E2BF65", fg: "#1c1608" },
  Flying: { bg: "#A98FF3", fg: "#160e28" },
  Psychic: { bg: "#F95587", fg: "#2a0612" },
  Bug: { bg: "#A6B91A", fg: "#161a04" },
  Rock: { bg: "#B6A136", fg: "#1c1808" },
  Ghost: { bg: "#735797", fg: "#f7f2ff" },
  Dragon: { bg: "#6F35FC", fg: "#f4f0ff" },
  Dark: { bg: "#705746", fg: "#f8f3ee" },
  Steel: { bg: "#B7B7CE", fg: "#16161f" },
  Fairy: { bg: "#D685AD", fg: "#241018" },
  Shadow: { bg: "#3B2354", fg: "#f3e9ff" },
}
