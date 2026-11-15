"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { fetchCatalog, searchSpecies, type IndexedCatalog } from "@/lib/catalog"
import { advise } from "@/lib/advise"
import { resolveFighter } from "@/lib/resolve"
import { hydrateFight, patchFoe, patchSlot, setActive, useFight } from "@/lib/store"
import { matchSpeciesName, readBattleText } from "@/lib/battle-text"
import { fillSlotFromSummary } from "@/lib/summary-text"
import { CatalogProvider, useCatalog } from "@/components/catalog-context"
import { cn } from "cn"

const BOX_KEY = "slate-battle-box"
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
  const [through, setThrough] = useState(false)
  const throughRef = useRef(false)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const fightRef = useRef(fight)
  const catalogRef = useRef(catalog)
  fightRef.current = fight
  catalogRef.current = catalog
  throughRef.current = through
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
    if (!desktop || !window.slate) return
    if (!through) {
      window.slate.setClickThrough(false)
      return
    }
    window.slate.setClickThrough(true)
    const onMove = (event: MouseEvent) => {
      if (!throughRef.current) return
      const hit = document.elementFromPoint(event.clientX, event.clientY)
      const overPanel = Boolean(hit?.closest("[data-catch]"))
      window.slate?.setClickThrough(!overPanel)
    }
    window.addEventListener("mousemove", onMove)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.slate?.setClickThrough(false)
    }
  }, [desktop, through])

  useEffect(() => {
    if (!watching || !window.slate?.readRegion) return
    const raw = window.localStorage.getItem(BOX_KEY)
    if (!raw) return
    let box: { x: number; y: number; width: number; height: number }
    try {
      box = JSON.parse(raw)
    } catch {
      return
    }
    let stopped = false

    async function look() {
      try {
        const result = await window.slate?.readRegion?.(box)
        if (stopped || !result) return
        if (result.error) {
          setSeen(result.error)
          return
        }
        const read = readBattleText(result.text)
        const names = catalogRef.current.species
        const foundFoe = read.foe ? matchSpeciesName(read.foe, names) : null
        const mine = read.you ? matchSpeciesName(read.you, names) : null
        if (foundFoe && foundFoe.id !== fightRef.current.foe.speciesId) {
          patchFoe({
            speciesId: foundFoe.id,
            abilityId: foundFoe.abilities[0]?.id ?? "",
            moves: [],
            types: null,
            stats: null,
            ...(read.level ? { level: read.level } : {}),
          })
        } else if (foundFoe && read.level && read.level !== fightRef.current.foe.level) {
          patchFoe({ level: read.level })
        }
        let youLine = ""
        if (mine) {
          const index = fightRef.current.party.findIndex((slot) => slot.speciesId === mine.id)
          if (index >= 0) {
            setActive(index)
            youLine = `You: ${mine.name}`
          } else youLine = `${mine.name} is out, not on your team`
        }
        if (foundFoe || youLine) setSeen([youLine, foundFoe ? `Foe: ${foundFoe.name}` : ""].filter(Boolean).join(" · "))
        else if (result.text.trim()) setSeen("Draw the box around the two battle lines.")
      } catch {
        if (!stopped) setSeen("The battle text could not be read.")
      }
    }

    const timer = window.setInterval(() => void look(), 1500)
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
    setSeen("Open the summary, then drag a box over it.")
    try {
      const box = await window.slate.pickRegion()
      if (!box) {
        setSeen("Summary box cancelled.")
        return
      }
      const result = await window.slate.readRegion(box)
      if (result.error) {
        setSeen(result.error)
        return
      }
      const filled = fillSlotFromSummary(result.text, catalog)
      if (!filled) {
        setSeen("Could not read that summary. Draw the whole Ampharos window.")
        return
      }
      patchSlot(fight.active, filled)
      const name = catalog.speciesById.get(filled.speciesId ?? "")?.name ?? "Pokémon"
      setSeen(`Filled slot ${fight.active + 1}: ${name}.`)
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

          {through ? (
            <div className="hud-nodrag flex items-center gap-2 border-b-2 border-black bg-[#e0e0e0] px-3 py-2">
              <p className="min-w-0 flex-1 text-[12px] font-bold text-black">Hover here to use the window.</p>
              <button type="button" className="border-2 border-black bg-white px-2 py-0.5 text-[12px] font-bold text-black hover:text-[#3b4cca]" onClick={() => setThrough(false)}>
                Unlock
              </button>
            </div>
          ) : null}

          <div className="hud-nodrag px-3 py-3">
            <p className="text-[12px] font-bold text-black">{you?.name ?? "Your Pokémon"}</p>

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
                    placeholder={foe ? foe.name : "Pokémon in front of you"}
                    className="h-8 w-full rounded-none border-2 border-black bg-white px-2 text-[13px] text-black outline-none placeholder:text-[#707070]"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                {desktop ? (
                  <div className="mt-2 flex items-stretch overflow-hidden rounded-none border-2 border-black bg-[#3b4cca]">
                    <button
                      type="button"
                      className="px-2.5 py-2 text-[12px] font-bold text-white hover:text-yellow-200"
                      onClick={() => void watchBattle(setWatching, setSeen)}
                    >
                      {watching ? "Stop" : "Watch"}
                    </button>
                    <span className="w-0.5 self-stretch bg-black" aria-hidden />
                    <button
                      type="button"
                      className="px-2.5 py-2 text-[12px] font-bold text-white hover:text-yellow-200"
                      onClick={() => void chooseBox(setWatching, setSeen, setBoxTick)}
                    >
                      Foe box
                    </button>
                    <span className="w-0.5 self-stretch bg-black" aria-hidden />
                    <button
                      type="button"
                      className="px-2.5 py-2 text-[12px] font-bold text-white hover:text-yellow-200 disabled:opacity-60"
                      disabled={fillBusy}
                      onClick={() => void fillActiveFromSummary()}
                    >
                      {fillBusy ? "…" : "Fill"}
                    </button>
                    <span className="w-0.5 self-stretch bg-black" aria-hidden />
                    <button
                      type="button"
                      className={cn("px-2.5 py-2 text-[12px] font-bold text-white hover:text-yellow-200", through && "text-yellow-200")}
                      onClick={() => setThrough((current) => !current)}
                    >
                      {through ? "Unlock" : "Through"}
                    </button>
                    {seen ? (
                      <>
                        <span className="w-0.5 self-stretch bg-black" aria-hidden />
                        <p className="min-w-0 flex-1 truncate px-2 py-2 text-[11px] font-bold text-white">{seen}</p>
                      </>
                    ) : null}
                  </div>
                ) : null}
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
            ) : (
              <div className="mt-2 flex items-stretch overflow-hidden rounded-none border-2 border-black bg-[#3b4cca] text-[11px]">
                {desktop ? (
                  <>
                    <button
                      type="button"
                      className="px-2.5 py-2 font-bold text-white hover:text-yellow-200"
                      onClick={() => void watchBattle(setWatching, setSeen)}
                    >
                      {watching ? "Stop" : "Watch"}
                    </button>
                    <span className="w-0.5 self-stretch bg-black" aria-hidden />
                    <button
                      type="button"
                      className="px-2.5 py-2 font-bold text-white hover:text-yellow-200 disabled:opacity-60"
                      disabled={fillBusy}
                      onClick={() => void fillActiveFromSummary()}
                    >
                      Fill
                    </button>
                    <span className="w-0.5 self-stretch bg-black" aria-hidden />
                  </>
                ) : null}
                {seen ? (
                  <p className="min-w-0 flex-1 truncate px-2 py-2 font-bold text-white">{seen}</p>
                ) : (
                  <p className="min-w-0 flex-1 truncate px-2 py-2 font-bold text-white">Click a slot, then Fill.</p>
                )}
              </div>
            )}
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

async function chooseBox(
  setWatching: (next: boolean) => void,
  setSeen: (next: string) => void,
  setBoxTick: (update: (tick: number) => number) => void,
) {
  const box = await window.slate?.pickRegion?.()
  if (!box) return
  window.localStorage.setItem(BOX_KEY, JSON.stringify(box))
  setSeen("Watching the box.")
  setBoxTick((tick) => tick + 1)
  setWatching(true)
}

async function watchBattle(setWatching: (next: boolean | ((current: boolean) => boolean)) => void, setSeen: (next: string) => void) {
  const api = window.slate
  if (!api?.pickRegion || !api.readRegion) return
  const existing = window.localStorage.getItem(BOX_KEY)
  if (!existing) {
    const box = await api.pickRegion()
    if (!box) return
    window.localStorage.setItem(BOX_KEY, JSON.stringify(box))
    setSeen("Watching the box.")
    setWatching(true)
    return
  }
  setWatching((current) => !current)
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
