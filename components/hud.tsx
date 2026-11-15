"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { fetchCatalog, searchMoves, searchSpecies, type IndexedCatalog } from "@/lib/catalog"
import { advise } from "@/lib/advise"
import { resolveFighter } from "@/lib/resolve"
import { hydrateFight, patchFoe, patchSlot, setActive, useFight } from "@/lib/store"
import { matchSpeciesName, readNameplate } from "@/lib/battle-text"
import { fillSlotFromSummary } from "@/lib/summary-text"
import { CatalogProvider, useCatalog } from "@/components/catalog-context"
import type { Slot } from "@/lib/types"
import { cn } from "cn"

/** Screen region over the foe nameplate (name + Lv), top-left of the battle. */
const FOE_BOX_KEY = "slate-foe-box"
const PREFS_KEY = "slate-overlay-prefs"

type Prefs = {
  compact: boolean
  opacity: number
}

const DEFAULT_PREFS: Prefs = { compact: true, opacity: 0.95 }

export function HudApp() {
  const { ready } = useFight()
  const [catalog, setCatalog] = useState<IndexedCatalog | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add("hud-root")
    hydrateFight()
    let cancelled = false
    fetchCatalog()
      .then((loaded) => {
        if (!cancelled) setCatalog(loaded)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
      document.documentElement.classList.remove("hud-root")
    }
  }, [])

  if (!ready || !catalog) {
    return (
      <div className="p-2">
        <Window>
          <header className="hud-drag border-b-2 border-black bg-[#e3350d] px-3 py-1.5">
            <p className="text-[13px] font-bold text-white">Slate</p>
          </header>
          <p className="px-3 py-4 text-[13px] text-black">{error ? "The type chart did not load." : "Opening…"}</p>
        </Window>
      </div>
    )
  }

  return (
    <CatalogProvider catalog={catalog}>
      <Hud />
    </CatalogProvider>
  )
}

function Hud() {
  const catalog = useCatalog()
  const { fight } = useFight()
  const youSlot = fight.party[fight.active]
  const you = resolveFighter(youSlot, catalog, fight.youHp)
  const foe = resolveFighter(fight.foe, catalog, fight.foeHp)
  const bench = fight.party.flatMap((slot, index) => {
    if (index === fight.active) return []
    const fighter = resolveFighter(slot, catalog, fight.youHp)
    return fighter ? [fighter] : []
  })
  const advice = you && foe ? advise(you, foe, bench, fight.weather) : null
  const pick = advice?.moves.find((move) => move.recommended) ?? null
  const switchPick = advice?.switches.find((option) => option.recommended) ?? null
  const [desktop, setDesktop] = useState(false)
  const [query, setQuery] = useState("")
  const [watching, setWatching] = useState(false)
  const [boxTick, setBoxTick] = useState(0)
  const [seen, setSeen] = useState("")
  const [fillBusy, setFillBusy] = useState(false)
  const [editMoves, setEditMoves] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const fightRef = useRef(fight)
  const catalogRef = useRef(catalog)
  fightRef.current = fight
  catalogRef.current = catalog
  const matches = query.trim() ? searchSpecies(catalog, query, 6) : []

  useEffect(() => {
    if (window.slate?.readRegion) setDesktop(true)
    setPrefs(loadPrefs())
    window.slate?.setClickThrough(false)
  }, [])

  useEffect(() => {
    if (!desktop || !window.slate) return
    window.slate.setOpacity(prefs.opacity)
    window.slate.setCompact?.(prefs.compact)
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }, [desktop, prefs])

  useEffect(() => {
    if (!watching || !window.slate?.readRegion) return
    const raw = window.localStorage.getItem(FOE_BOX_KEY)
    if (!raw) return
    let box: { x: number; y: number; width: number; height: number }
    try {
      box = JSON.parse(raw)
    } catch {
      return
    }
    let stopped = false
    let lastFoeId: string | null = fightRef.current.foe.speciesId || null
    let emptyTicks = 0

    async function look() {
      try {
        const result = await window.slate?.readRegion?.(box)
        if (stopped || !result) return
        if (result.error) {
          setSeen(result.error)
          return
        }
        const read = readNameplate(result.text)
        const names = catalogRef.current.species
        const foundFoe = read.foe ? matchSpeciesName(read.foe, names) : null

        if (!foundFoe) {
          emptyTicks += 1
          if (lastFoeId && emptyTicks >= 2) {
            const prev = catalogRef.current.speciesById.get(lastFoeId)?.name ?? "Foe"
            setSeen(`${prev} fainted — waiting for the next Pokémon…`)
          } else if (result.text.trim()) {
            setSeen("Cover only the foe name + Lv box (top left).")
          }
          return
        }

        emptyTicks = 0
        const levelPatch = read.level ? { level: read.level } : {}
        if (foundFoe.id !== fightRef.current.foe.speciesId) {
          const prevName = lastFoeId ? catalogRef.current.speciesById.get(lastFoeId)?.name : null
          patchFoe({
            speciesId: foundFoe.id,
            abilityId: foundFoe.abilities[0]?.id ?? "",
            moves: [],
            types: null,
            stats: null,
            ...levelPatch,
          })
          lastFoeId = foundFoe.id
          setSeen(
            prevName && prevName !== foundFoe.name
              ? `${prevName} fainted · next: ${foundFoe.name}${read.level ? ` Lv ${read.level}` : ""}`
              : `Foe: ${foundFoe.name}${read.level ? ` Lv ${read.level}` : ""}`,
          )
        } else {
          lastFoeId = foundFoe.id
          if (read.level && read.level !== fightRef.current.foe.level) patchFoe({ level: read.level })
          setSeen(`Foe: ${foundFoe.name}${read.level ? ` Lv ${read.level}` : ""}`)
        }
      } catch {
        if (!stopped) setSeen("The foe name box could not be read.")
      }
    }

    const timer = window.setInterval(() => void look(), 1200)
    void look()
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [watching, boxTick])

  function chooseFoe(id: string) {
    const next = catalog.speciesById.get(id)
    patchFoe({
      speciesId: id,
      abilityId: next?.abilities[0]?.id ?? "",
      moves: [],
      types: null,
      stats: null,
    })
    setQuery("")
  }

  function patchPrefs(next: Partial<Prefs>) {
    setPrefs((current) => ({ ...current, ...next }))
  }

  async function fillActiveFromSummary() {
    if (!window.slate?.pickRegion || !window.slate.readRegion || fillBusy) return
    setFillBusy(true)
    setSeen("Draw a box over the open summary window.")
    try {
      const box = await window.slate.pickRegion()
      if (!box) {
        setSeen("Cancelled.")
        return
      }
      const result = await window.slate.readRegion(box)
      if (result.error) {
        setSeen(result.error)
        return
      }
      if (!result.text.trim()) {
        setSeen("Nothing was read. Move Slate aside and try again.")
        return
      }
      const filled = fillSlotFromSummary(result.text, {
        species: catalog.species,
        moves: catalog.moves,
        abilities: catalog.abilities,
        natures: catalog.natures,
        learnsets: catalog.learnsets,
      })
      if (!filled) {
        setSeen("No Pokémon name found. Cover the whole summary, including the name.")
        return
      }
      patchSlot(fight.active, filled)
      const name = catalog.speciesById.get(filled.speciesId ?? "")?.name ?? "Pokémon"
      const moveCount = filled.moves?.length ?? 0
      setSeen(`${name} saved in slot ${fight.active + 1}${moveCount ? ` · ${moveCount} moves` : ""}.`)
    } catch {
      setSeen("The summary could not be read.")
    } finally {
      setFillBusy(false)
    }
  }

  return (
    <div className="p-2" data-catch>
      <div className="flex items-stretch gap-2">
        <PartyStrip
          party={fight.party}
          active={fight.active}
          switchName={switchPick?.name ?? null}
          catalog={catalog}
          onSelect={setActive}
        />
        <Window>
          <TitleBar
            title={foe?.name ?? "Wild Pokémon"}
            level={foe ? `Lv ${foe.level}` : ""}
            compact={prefs.compact}
            onClose={desktop ? () => window.slate?.close() : undefined}
            onToggleCompact={() => patchPrefs({ compact: !prefs.compact })}
          />

          <div className="hud-nodrag px-3 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-[12px] font-bold text-black">
                {you?.name ?? "Your Pokémon"}
                {youSlot.moves.length > 0 && youSlot.moves.length < 4 ? ` · only ${youSlot.moves.length}/4 moves` : ""}
              </p>
              <button
                type="button"
                className="shrink-0 text-[11px] font-bold text-[#3b4cca] hover:text-[#e3350d]"
                onClick={() => setEditMoves((open) => !open)}
              >
                {editMoves ? "Done" : "Edit moves"}
              </button>
            </div>

            {editMoves ? (
              <MoveEditPanel
                key={fight.active}
                slot={youSlot}
                catalog={catalog}
                onChange={(patch) => patchSlot(fight.active, patch)}
              />
            ) : null}

            {switchPick && advice?.verdict === "switch" ? (
              <div className="mt-1.5">
                <p className="text-[20px] font-bold leading-none text-black">Send {switchPick.name}</p>
                <p className="mt-1.5 text-[12px] text-black">{pick ? `Then click ${pick.name}.` : switchPick.reason}</p>
              </div>
            ) : pick ? (
              <div className="mt-1.5">
                <p className="text-[20px] font-bold leading-none text-black">{pick.name}</p>
                <p className="mt-1.5 text-[12px] text-black">
                  {pick.type}. {pick.label}.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[13px] leading-5 text-black">
                {advice?.headline ?? "Type the Pokémon in front of you."}
              </p>
            )}

            {!prefs.compact && advice && advice.moves.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {advice.moves.map((move) => (
                  <li key={`${move.id}-${move.type}`}>
                    <div
                      className={cn(
                        "flex items-baseline gap-2 rounded-none bg-white px-2.5 py-2 text-left text-black",
                        move.recommended ? "border-2 border-blue-600 bg-blue-100" : "border-2 border-black",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{move.name}</span>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-black">{move.label}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {!prefs.compact ? (
              <>
                <label className="mt-3 block">
                  <span className="sr-only">Pokémon in front of you</span>
                  <input
                    value={query}
                    placeholder={foe ? foe.name : "Type the foe if needed"}
                    className="h-8 w-full rounded-none border-2 border-black bg-white px-2 text-[13px] text-black outline-none placeholder:text-[#707070]"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                {matches.length > 0 ? (
                  <ul className="mt-1 overflow-hidden rounded-none border-2 border-black bg-white">
                    {matches.map((species) => (
                      <li key={species.id} className="border-b-2 border-black last:border-b-0">
                        <button
                          type="button"
                          className="flex w-full items-baseline justify-between px-2.5 py-1.5 text-left text-[13px] font-bold text-black hover:text-[#3b4cca]"
                          onClick={() => chooseFoe(species.id)}
                        >
                          <span>{species.name}</span>
                          <span className="text-[11px] text-black">{species.types.join(" / ")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}

            {desktop ? (
              <div className="mt-3">
                <div className="flex items-stretch overflow-hidden rounded-none border-2 border-black bg-[#3b4cca]">
                  <button
                    type="button"
                    className="flex-1 px-2 py-2 text-[12px] font-bold text-white hover:text-yellow-200 disabled:opacity-60"
                    disabled={fillBusy}
                    onClick={() => void fillActiveFromSummary()}
                  >
                    {fillBusy ? "Reading…" : "1. My Pokémon"}
                  </button>
                  <span className="w-0.5 self-stretch bg-black" aria-hidden />
                  <button
                    type="button"
                    className="flex-1 px-2 py-2 text-[12px] font-bold text-white hover:text-yellow-200"
                    onClick={() => void startFightWatch(watching, setWatching, setSeen, setBoxTick)}
                  >
                    {watching ? "Stop fight" : "2. The fight"}
                  </button>
                </div>
                <p className="mt-1 text-[11px] font-bold text-black">
                  {seen ||
                    (watching
                      ? "Watching the foe name box."
                      : "1 reads your summary. 2 draws a box on the foe name + Lv (top left).")}
                </p>
              </div>
            ) : null}
          </div>
        </Window>
      </div>
    </div>
  )
}

function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      compact: parsed.compact ?? DEFAULT_PREFS.compact,
      opacity: Math.min(1, Math.max(0.5, parsed.opacity ?? DEFAULT_PREFS.opacity)),
    }
  } catch {
    return DEFAULT_PREFS
  }
}

async function startFightWatch(
  watching: boolean,
  setWatching: (next: boolean) => void,
  setSeen: (next: string) => void,
  setBoxTick: (update: (tick: number) => number) => void,
) {
  if (watching) {
    setWatching(false)
    setSeen("Stopped reading the fight.")
    return
  }
  const api = window.slate
  if (!api?.pickRegion || !api.readRegion) return
  setSeen("Draw a tight box around the foe’s name and Lv (top left of the battle).")
  const box = await api.pickRegion()
  if (!box) {
    setSeen("Cancelled.")
    return
  }
  window.localStorage.setItem(FOE_BOX_KEY, JSON.stringify(box))
  setBoxTick((tick) => tick + 1)
  setSeen("Watching the foe name box — it updates when the next Pokémon comes out.")
  setWatching(true)
}

function MoveEditPanel({
  slot,
  catalog,
  onChange,
}: {
  slot: Slot
  catalog: IndexedCatalog
  onChange: (patch: Partial<Slot>) => void
}) {
  const rows = [0, 1, 2, 3].map((index) => slot.moves[index] ?? { id: "" })
  const learnset = slot.speciesId ? (catalog.learnsets[slot.speciesId] ?? null) : null

  function write(index: number, nextId: string) {
    const next = rows.map((row, rowIndex) => {
      if (rowIndex === index) return nextId ? { id: nextId } : null
      return row.id ? row : null
    }).filter((row): row is { id: string } => Boolean(row && row.id))
    onChange({ moves: next })
  }

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[11px] font-bold text-black">Type a move name, then pick it.</p>
      {rows.map((row, index) => (
        <MoveSlotField
          key={index}
          index={index}
          moveId={row.id}
          catalog={catalog}
          learnset={learnset}
          onPick={(id) => write(index, id)}
        />
      ))}
      {slot.moves.length > 0 ? (
        <button
          type="button"
          className="text-[11px] font-bold text-[#e3350d] hover:underline"
          onClick={() => onChange({ moves: [] })}
        >
          Clear all moves
        </button>
      ) : null}
    </div>
  )
}

function MoveSlotField({
  index,
  moveId,
  catalog,
  learnset,
  onPick,
}: {
  index: number
  moveId: string
  catalog: IndexedCatalog
  learnset: string[] | null
  onPick: (id: string) => void
}) {
  const current = moveId ? catalog.moveById.get(moveId) : undefined
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const text = draft ?? current?.name ?? ""
  const results = open && draft !== null && draft.trim()
    ? (() => {
        const found = searchMoves(catalog, draft, learnset, 8)
        return [...found.known, ...found.extra].slice(0, 8)
      })()
    : []

  return (
    <div className="relative">
      <label className="flex items-center gap-1.5">
        <span className="w-3 shrink-0 text-[10px] font-bold text-black">{index + 1}</span>
        <input
          value={text}
          placeholder={`Move ${index + 1}`}
          className="h-7 min-w-0 flex-1 rounded-none border-2 border-black bg-white px-1.5 text-[12px] font-bold text-black outline-none placeholder:font-normal placeholder:text-[#707070]"
          onFocus={(event) => {
            setOpen(true)
            setDraft(current?.name ?? "")
            event.currentTarget.select()
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false)
              setDraft(null)
            }, 120)
          }}
          onChange={(event) => {
            setDraft(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              event.preventDefault()
              onPick(results[0].id)
              setDraft(null)
              setOpen(false)
            } else if (event.key === "Escape") {
              setDraft(null)
              setOpen(false)
              event.currentTarget.blur()
            } else if (event.key === "Backspace" && !draft && current) {
              onPick("")
            }
          }}
        />
        {current ? (
          <button
            type="button"
            className="shrink-0 px-1 text-[11px] font-bold text-black hover:text-[#e3350d]"
            title="Clear this move"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick("")}
          >
            ×
          </button>
        ) : null}
      </label>
      {open && results.length > 0 ? (
        <ul className="absolute z-40 mt-0.5 max-h-40 w-full overflow-auto border-2 border-black bg-white">
          {results.map((move) => (
            <li key={move.id} className="border-b border-black last:border-b-0">
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-2 px-2 py-1 text-left text-[12px] font-bold text-black hover:bg-blue-100"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPick(move.id)
                  setDraft(null)
                  setOpen(false)
                }}
              >
                <span className="truncate">{move.name}</span>
                <span className="shrink-0 text-[10px] font-bold text-black">{move.type}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function PartyStrip({
  party,
  active,
  switchName,
  catalog,
  onSelect,
}: {
  party: { speciesId: string; level: number; moves: { id: string }[] }[]
  active: number
  switchName: string | null
  catalog: IndexedCatalog
  onSelect: (index: number) => void
}) {
  return (
    <aside className="hud-nodrag flex w-[118px] shrink-0 flex-col gap-1">
      {party.map((slot, index) => {
        const species = slot.speciesId ? catalog.speciesById.get(slot.speciesId) : null
        const name = species?.name ?? `Slot ${index + 1}`
        const selected = index === active
        const suggested = switchName != null && species?.name === switchName
        return (
          <button
            key={`${slot.speciesId || "empty"}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              "rounded-none border-2 px-1.5 py-1.5 text-left",
              suggested ? "border-blue-600 bg-blue-100" : selected ? "border-[#e3350d] bg-white" : "border-black bg-[#f8f8f8]",
            )}
          >
            <p className="truncate text-[11px] font-bold text-black">{name}</p>
            <p className="text-[10px] font-bold text-black">
              Lv {slot.level}
              {slot.moves.length ? ` · ${slot.moves.length}mv` : ""}
            </p>
          </button>
        )
      })}
    </aside>
  )
}

function Window({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-none border-2 border-black bg-[#f8f8f8] font-sans text-black antialiased-none [-webkit-font-smoothing:none]">
      {children}
    </div>
  )
}

function TitleBar({
  title,
  level,
  compact,
  onClose,
  onToggleCompact,
}: {
  title: string
  level?: string
  compact: boolean
  onClose?: () => void
  onToggleCompact: () => void
}) {
  return (
    <header className="hud-drag flex items-center gap-2 border-b-2 border-black bg-[#e3350d] px-3 py-1.5" title="Drag to move">
      <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{title}</p>
      {level ? <p className="text-[12px] font-bold text-white">{level}</p> : null}
      <div className="hud-nodrag flex items-center gap-2">
        <button type="button" className="text-[11px] font-bold text-white hover:text-yellow-200" onClick={onToggleCompact}>
          {compact ? "More" : "Less"}
        </button>
        {onClose ? (
          <button type="button" className="text-[12px] font-bold text-white hover:text-yellow-200" onClick={onClose}>
            ✕
          </button>
        ) : null}
      </div>
    </header>
  )
}

declare global {
  interface Window {
    slate?: {
      setClickThrough: (on: boolean) => void
      setOpacity: (value: number) => void
      close: () => void
      onClickThrough: (callback: (on: boolean) => void) => () => void
      pickRegion?: () => Promise<{ x: number; y: number; width: number; height: number } | null>
      readRegion?: (region: { x: number; y: number; width: number; height: number }) => Promise<{ text: string; error?: string }>
      setCompact?: (compact: boolean) => void
      snap?: (corner: "tl" | "tr" | "bl" | "br") => void
    }
  }
}
