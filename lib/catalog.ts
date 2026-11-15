import type { Catalog, CatalogAbility, CatalogMove, CatalogNature, CatalogSpecies } from "@/lib/types"

export type IndexedCatalog = {
  species: CatalogSpecies[]
  moves: CatalogMove[]
  abilities: CatalogAbility[]
  natures: CatalogNature[]
  speciesById: Map<string, CatalogSpecies>
  moveById: Map<string, CatalogMove>
  abilityById: Map<string, CatalogAbility>
  natureById: Map<string, CatalogNature>
  learnsets: Record<string, string[]>
}

export function indexCatalog(catalog: Catalog, learnsets: Record<string, string[]>): IndexedCatalog {
  return {
    species: catalog.species,
    moves: catalog.moves,
    abilities: catalog.abilities,
    natures: catalog.natures,
    speciesById: new Map(catalog.species.map((species) => [species.id, species])),
    moveById: new Map(catalog.moves.map((move) => [move.id, move])),
    abilityById: new Map(catalog.abilities.map((ability) => [ability.id, ability])),
    natureById: new Map(catalog.natures.map((nature) => [nature.id, nature])),
    learnsets,
  }
}

export async function fetchCatalog(): Promise<IndexedCatalog> {
  const [catalog, learnsets] = await Promise.all([
    fetch("/data/catalog.json").then((response) => {
      if (!response.ok) throw new Error("catalog")
      return response.json() as Promise<Catalog>
    }),
    fetch("/data/learnsets.json").then((response) => {
      if (!response.ok) throw new Error("learnsets")
      return response.json() as Promise<Record<string, string[]>>
    }),
  ])
  return indexCatalog(catalog, learnsets)
}

export function fold(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "")
}

export function searchSpecies(catalog: IndexedCatalog, query: string, limit = 12) {
  const folded = fold(query)
  if (!folded) return []
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => fold(token))
    .filter(Boolean)
  const ranked: { species: CatalogSpecies; score: number }[] = []
  for (const species of catalog.species) {
    const name = fold(species.name)
    let score = 0
    if (name === folded || species.id === folded) score = 100
    else if (name.startsWith(folded) || species.id.startsWith(folded)) score = 80
    else if (name.includes(folded)) score = 60
    else if (tokens.length > 1 && tokens.every((token) => name.includes(token) || species.types.some((type) => fold(type).includes(token)))) {
      score = 40
    }
    if (score > 0) ranked.push({ species, score: score - (species.mega ? 5 : 0) })
  }
  ranked.sort((a, b) => b.score - a.score || a.species.num - b.species.num || a.species.name.localeCompare(b.species.name))
  return ranked.slice(0, limit).map((entry) => entry.species)
}

export function searchMoves(catalog: IndexedCatalog, query: string, learnset: string[] | null, limit = 14) {
  const folded = fold(query)
  const allowed = learnset ? new Set(learnset) : null
  const pool = folded
    ? catalog.moves.filter((move) => fold(move.name).includes(folded) || fold(move.type) === folded)
    : []
  const known = allowed ? pool.filter((move) => allowed.has(move.id)) : pool
  const extra = allowed && folded.length >= 2 ? pool.filter((move) => !allowed.has(move.id)) : []
  return {
    known: known.slice(0, limit),
    extra: extra.slice(0, 6),
  }
}

export function searchAbilities(catalog: IndexedCatalog, query: string, preferred: string[], limit = 10) {
  const folded = fold(query)
  const preferredSet = new Set(preferred)
  const list = catalog.abilities.filter((ability) => !folded || fold(ability.name).includes(folded) || ability.id.includes(folded))
  list.sort((a, b) => Number(preferredSet.has(b.id)) - Number(preferredSet.has(a.id)) || a.name.localeCompare(b.name))
  return list.slice(0, limit)
}
