"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { fetchCatalog, searchSpecies, type IndexedCatalog } from "@/lib/catalog"
import { advise } from "@/lib/advise"
import { resolveFighter } from "@/lib/resolve"
import { hydrateFight, patchFoe, setActive, useFight } from "@/lib/store"
import { matchSpeciesName, readBattleText } from "@/lib/battle-text"
import { CatalogProvider, useCatalog } from "@/components/catalog-context"
import { cn } from "cn"

const BOX_KEY = "slate-battle-box"

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
          <TitleBar title="Slate" />
          <p className="px-3 py-4 text-[13px] text-[#d7dde4]">{error ? "The type chart did not load." : "Opening…"}</p>
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
  const [desktop, setDesktop] = useState(false)
  const [query, setQuery] = useState("")
  const [watching, setWatching] = useState(false)
  const [boxTick, setBoxTick] = useState(0)
  const [seen, setSeen] = useState("")
  const fightRef = useRef(fight)
  const catalogRef = useRef(catalog)
  fightRef.current = fight
  catalogRef.current = catalog
  const matches = query.trim() ? searchSpecies(catalog, query, 6) : []

  useEffect(() => {
    if (window.slate?.readRegion) setDesktop(true)
  }, [])

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

  return (
    <div className="p-2">
      <Window>
        <TitleBar
          title={foe?.name ?? "Wild Pokémon"}
          level={foe ? `Lv ${foe.level}` : ""}
          onClose={desktop ? () => window.slate?.close() : undefined}
        />
        <div className="hud-nodrag px-3 py-2.5">
          <button
            type="button"
            className="text-[12px] text-[#b7c0c8]"
            onClick={() => setActive((fight.active + 1) % fight.party.length)}
          >
            {you?.name ?? "Your Pokémon"}
          </button>

          {pick ? (
            <div className="mt-1">
              <p className="text-[18px] leading-none text-white">{pick.name}</p>
              <p className="mt-1 text-[12px] text-[#d5dde4]">
                {pick.type}. {pick.label}.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-[13px] leading-5 text-[#d5dde4]">
              {advice?.headline ?? "Type the Pokémon in front of you."}
            </p>
          )}

          {advice && advice.moves.length > 0 ? (
            <ul className="mt-3 border-t border-[#12161a]">
              {advice.moves.map((move) => (
                <li
                  key={`${move.id}-${move.type}`}
                  className={cn(
                    "flex items-baseline gap-2 border-b border-[#12161a] px-1 py-1 text-[13px]",
                    move.recommended ? "bg-[#3c4652] text-white" : "text-[#c5ced6]",
                  )}
                >
                  <span className="w-3 text-[#f0d36a]">{move.recommended ? "►" : ""}</span>
                  <span className="min-w-0 flex-1 truncate">{move.name}</span>
                  <span className="text-[11px] text-[#9aa6b1]">{move.label}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {advice && !pick && advice.switches.some((option) => option.recommended) ? (
            <p className="mt-2 text-[12px] leading-5 text-[#d5dde4]">
              {advice.switches
                .filter((option) => option.recommended)
                .map((option) => `Send ${option.name}.`)
                .join(" ")}
            </p>
          ) : null}

          <label className="mt-3 block">
            <span className="sr-only">Pokémon in front of you</span>
            <input
              value={query}
              placeholder={foe ? foe.name : "Pokémon in front of you"}
              className="h-7 w-full border border-[#12161a] bg-[#1a1e22] px-2 text-[13px] text-white outline-none placeholder:text-[#8b97a3]"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {desktop ? (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="border border-[#12161a] bg-[#3a424c] px-2 py-1 text-[12px] text-white"
                onClick={() => void watchBattle(setWatching, setSeen)}
              >
                {watching ? "Stop" : "Watch battle"}
              </button>
              <button type="button" className="px-1 text-[12px] text-[#9aa6b1]" onClick={() => void chooseBox(setWatching, setSeen, setBoxTick)}>
                Box
              </button>
              {seen ? <p className="min-w-0 flex-1 truncate text-[11px] text-[#9aa6b1]">{seen}</p> : null}
            </div>
          ) : null}
          {matches.length > 0 ? (
            <ul className="mt-1 border border-[#12161a] bg-[#1a1e22]">
              {matches.map((species) => (
                <li key={species.id}>
                  <button
                    type="button"
                    className="flex w-full items-baseline justify-between px-2 py-1 text-left text-[13px] text-[#d5dde4] hover:bg-[#3c4652]"
                    onClick={() => chooseFoe(species.id)}
                  >
                    <span>{species.name}</span>
                    <span className="text-[11px] text-[#8b97a3]">{species.types.join(" / ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Window>
    </div>
  )
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

function Window({ children }: { children: ReactNode }) {
  return (
    <div
      className="overflow-hidden border border-[#9aa4ae] bg-[#2c3136] text-[#e7edf2] shadow-[inset_1px_1px_0_#c5ced6,inset_-1px_-1px_0_#15181b]"
      style={{ fontFamily: "Tahoma, Verdana, sans-serif" }}
    >
      {children}
    </div>
  )
}

function TitleBar({ title, level, onClose }: { title: string; level?: string; onClose?: () => void }) {
  return (
    <header className="hud-drag flex items-center gap-2 border-b border-[#12161a] bg-[#3a424c] px-2 py-1">
      <p className="min-w-0 flex-1 truncate text-[13px] text-white">{title}</p>
      {level ? <p className="text-[12px] text-[#f0d36a]">{level}</p> : null}
      {onClose ? (
        <button type="button" className="hud-nodrag px-1 text-[12px] text-[#d5dde4] hover:text-white" onClick={onClose}>
          ✕
        </button>
      ) : null}
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
    }
  }
}
