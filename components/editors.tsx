"use client"

import { searchAbilities, searchMoves, searchSpecies } from "@/lib/catalog"
import { natureLabel } from "@/lib/stats"
import { HIDDEN_POWER_TYPES, TYPES, type Slot, type StatBlock } from "@/lib/types"
import { useCatalog } from "@/components/catalog-context"
import { Suggest } from "@/components/suggest"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const STATS: { key: keyof StatBlock; label: string }[] = [
  { key: "hp", label: "HP" },
  { key: "atk", label: "Attack" },
  { key: "def", label: "Defense" },
  { key: "spa", label: "Sp. Atk" },
  { key: "spd", label: "Sp. Def" },
  { key: "spe", label: "Speed" },
]

export function SpeciesField({
  slot,
  label,
  onChange,
}: {
  slot: Slot
  label: string
  onChange: (patch: Partial<Slot>) => void
}) {
  const catalog = useCatalog()
  const species = catalog.speciesById.get(slot.speciesId)
  return (
    <Suggest
      label={label}
      selectedLabel={species?.name ?? ""}
      placeholder="Search a name, like Magnemite"
      options={(query) =>
        searchSpecies(catalog, query).map((entry) => ({
          id: entry.id,
          label: entry.name,
          hint: `${entry.types.join(" / ")}${entry.mega ? " · Mega" : ""}`,
        }))
      }
      onSelect={(id) => {
        const next = catalog.speciesById.get(id)
        onChange({
          speciesId: id,
          abilityId: next?.abilities[0]?.id ?? "",
          moves: [],
          types: null,
          stats: null,
        })
      }}
    />
  )
}

export function AbilityField({ slot, onChange }: { slot: Slot; onChange: (patch: Partial<Slot>) => void }) {
  const catalog = useCatalog()
  const species = catalog.speciesById.get(slot.speciesId)
  const preferred = species?.abilities.map((ability) => ability.id) ?? []
  const current = slot.abilityId ? catalog.abilityById.get(slot.abilityId) : undefined
  return (
    <div>
      <Suggest
        label="Ability"
        selectedLabel={current?.name ?? (slot.abilityId ? slot.abilityId : "Not sure")}
        placeholder="Search an ability"
        options={(query) => {
          const found = searchAbilities(catalog, query, preferred, query ? 8 : Math.max(3, preferred.length))
          const rows = found.map((ability) => ({
            id: ability.id,
            label: ability.name,
            hint: preferred.includes(ability.id) ? "On this Pokémon" : undefined,
          }))
          return query ? rows : [{ id: "", label: "Not sure", hint: "Ignore the ability" }, ...rows]
        }}
        onSelect={(id) => onChange({ abilityId: id })}
      />
      {current?.desc ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{current.desc}</p> : null}
    </div>
  )
}

export function LevelNatureFields({ slot, onChange }: { slot: Slot; onChange: (patch: Partial<Slot>) => void }) {
  const catalog = useCatalog()
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-xs font-medium tracking-wide text-muted-foreground">
        Level
        <Input
          className="mt-1 h-10 bg-background/70"
          type="number"
          min={1}
          max={100}
          value={slot.level}
          onChange={(event) => onChange({ level: Number(event.target.value) })}
        />
      </label>
      <label className="block text-xs font-medium tracking-wide text-muted-foreground">
        Nature
        <select
          className="mt-1 h-10 w-full rounded-lg border border-input bg-background/70 px-2 text-sm"
          value={slot.natureId}
          onChange={(event) => onChange({ natureId: event.target.value })}
        >
          {catalog.natures.map((nature) => (
            <option key={nature.id} value={nature.id}>
              {nature.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block font-normal normal-case tracking-normal">{natureLabel(catalog.natureById.get(slot.natureId) ?? { name: "Hardy", plus: null, minus: null })}</span>
      </label>
    </div>
  )
}

export function MoveEditor({ slot, onChange }: { slot: Slot; onChange: (patch: Partial<Slot>) => void }) {
  const catalog = useCatalog()
  const learnset = slot.speciesId ? (catalog.learnsets[slot.speciesId] ?? []) : null
  const rows = [0, 1, 2, 3].map((index) => slot.moves[index] ?? { id: "" })

  function write(index: number, next: { id: string; hiddenPower?: string } | null) {
    const moves = rows.map((row, rowIndex) => (rowIndex === index ? next : row.id ? row : null)).filter((row) => row && row.id) as Slot["moves"]
    onChange({ moves })
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const move = row.id ? catalog.moveById.get(row.id) : undefined
        return (
          <div key={index}>
            <Suggest
              label={`Move ${index + 1}`}
              selectedLabel={move?.name ?? ""}
              placeholder="Search a move"
              options={(query) => {
                const result = searchMoves(catalog, query, learnset)
                return [
                  ...result.known.map((entry) => ({
                    id: entry.id,
                    label: entry.name,
                    hint: `${entry.type} · ${entry.category}`,
                    group: learnset ? "Can learn" : undefined,
                  })),
                  ...result.extra.map((entry) => ({
                    id: entry.id,
                    label: entry.name,
                    hint: `${entry.type} · ${entry.category}`,
                    group: "Every move",
                  })),
                ]
              }}
              onSelect={(id) => write(index, { id, hiddenPower: id === "hiddenpower" ? row.hiddenPower : undefined })}
            />
            {move?.id === "hiddenpower" ? (
              <label className="mt-1 block text-xs font-medium tracking-wide text-muted-foreground">
                Hidden Power type from the summary
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background/70 px-2 text-sm"
                  value={row.hiddenPower ?? ""}
                  onChange={(event) => write(index, { id: "hiddenpower", hiddenPower: event.target.value || undefined })}
                >
                  <option value="">Not set</option>
                  {HIDDEN_POWER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        )
      })}
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ moves: [] })}>
        Clear moves
      </Button>
    </div>
  )
}

export function TypeOverride({ slot, onChange }: { slot: Slot; onChange: (patch: Partial<Slot>) => void }) {
  const types = slot.types ?? ["", ""]
  return (
    <details className="rounded-xl border border-border/80 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">Types look different in the game</summary>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Use this for a Shadow Pokémon, or if Revolution Online shows different types than the list. Leave it alone for a normal Pokémon.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[0, 1].map((index) => (
          <label key={index} className="text-xs font-medium tracking-wide text-muted-foreground">
            {index === 0 ? "First type" : "Second type"}
            <select
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background/70 px-2 text-sm"
              value={types[index] ?? ""}
              onChange={(event) => {
                const next = [...(slot.types ?? ["", ""])]
                next[index] = event.target.value
                const cleaned = next.filter(Boolean)
                onChange({ types: cleaned.length ? cleaned : null })
              }}
            >
              <option value="">{index === 0 ? "Use the list" : "None"}</option>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </details>
  )
}

export function StatEditor({ slot, onChange }: { slot: Slot; onChange: (patch: Partial<Slot>) => void }) {
  return (
    <details className="rounded-xl border border-border/80 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">Summary stats</summary>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Type the six numbers from the summary window. Empty boxes stay a guess from base stats, level, and nature.
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {STATS.map((stat) => (
          <label key={stat.key} className="text-xs font-medium tracking-wide text-muted-foreground">
            {stat.label}
            <Input
              className="mt-1 h-10 bg-background/70"
              inputMode="numeric"
              value={slot.stats?.[stat.key] ?? ""}
              placeholder="Guess"
              onChange={(event) => {
                const raw = event.target.value.trim()
                const stats = { ...(slot.stats ?? {}) }
                if (!raw) delete stats[stat.key]
                else stats[stat.key] = Number(raw)
                onChange({ stats: Object.keys(stats).length ? stats : null })
              }}
            />
          </label>
        ))}
      </div>
    </details>
  )
}
