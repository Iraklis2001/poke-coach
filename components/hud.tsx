"use client"

import { useEffect, useState, type ReactNode } from "react"
import { fetchCatalog, type IndexedCatalog } from "@/lib/catalog"
import { advise } from "@/lib/advise"
import { resolveFighter } from "@/lib/resolve"
import { patchFoe, patchSlot, setActive, setFoeHp, setWeather, setYouHp, useFight, hydrateFight } from "@/lib/store"
import type { Weather } from "@/lib/types"
import { CatalogProvider, useCatalog } from "@/components/catalog-context"
import { AbilityField, LevelNatureFields, SpeciesField } from "@/components/editors"
import { TypeChip } from "@/components/type-chip"
import { cn } from "cn"

const WEATHER: { id: Weather; label: string }[] = [
  { id: "none", label: "Clear" },
  { id: "sun", label: "Sun" },
  { id: "rain", label: "Rain" },
  { id: "sand", label: "Sand" },
]

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
      <div className="p-3">
        <Panel>
          <p className="font-heading text-3xl">Slate</p>
          <p className="mt-2 text-sm text-muted-foreground">{error ? "The type chart did not load." : "Opening the overlay…"}</p>
        </Panel>
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
  const [desktop, setDesktop] = useState(false)
  const [passThrough, setPassThrough] = useState(false)
  const [setup, setSetup] = useState(false)

  useEffect(() => {
    const api = window.slate
    if (!api) return
    setDesktop(true)
    return api.onClickThrough(setPassThrough)
  }, [])

  return (
    <div className="p-2">
      <Panel>
        <header className="hud-drag flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <div>
            <p className="text-[11px] font-bold tracking-[0.22em] text-[#e25b2a]">SLATE</p>
            <p className="text-[11px] text-muted-foreground">{passThrough ? "Clicks go to the game" : "Sits above the game"}</p>
          </div>
          <div className="hud-nodrag ml-auto flex items-center gap-1">
            {desktop ? (
              <>
                <button type="button" className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/10" onClick={() => window.slate?.setOpacity(0.72)}>
                  Dim
                </button>
                <button
                  type="button"
                  className={cn("rounded-md px-2 py-1 text-[11px]", passThrough ? "bg-[#e25b2a] text-[#1a100c]" : "text-muted-foreground hover:bg-white/10")}
                  onClick={() => window.slate?.setClickThrough(!passThrough)}
                >
                  {passThrough ? "Unlock" : "Click through"}
                </button>
                <button type="button" className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/10" onClick={() => window.slate?.close()}>
                  Close
                </button>
              </>
            ) : (
              <a className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/10" href="/">
                Full coach
              </a>
            )}
          </div>
        </header>

        <div className="hud-nodrag max-h-[calc(100vh-1.5rem)] space-y-3 overflow-y-auto px-3 py-3">
          {advice ? (
            <article className="rounded-2xl bg-[#f6f1e6] px-4 py-4 text-[#221c16]" aria-live="polite">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#e25b2a] uppercase">{advice.kicker}</p>
              <h1 className="font-heading mt-1 text-[2.1rem] leading-none">{advice.headline}</h1>
              <p className="mt-3 text-sm leading-6">{advice.paragraphs[0]}</p>
            </article>
          ) : (
            <article className="rounded-2xl bg-[#f6f1e6] px-4 py-4 text-[#221c16]">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#e25b2a] uppercase">Waiting</p>
              <h1 className="font-heading mt-1 text-3xl leading-none">{foe ? "Choose who you sent out." : "Who is in front of you?"}</h1>
            </article>
          )}

          {advice ? (
            <ul className="space-y-1.5">
              {advice.moves.map((move) => (
                <li
                  key={`${move.id}-${move.type}`}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-2.5 py-2",
                    move.recommended ? "border-[#e25b2a] bg-[#e25b2a]/15" : "border-white/10 bg-black/20",
                  )}
                >
                  <TypeChip type={move.type} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{move.name}</span>
                  <span className={cn("text-xs font-semibold", move.recommended ? "text-[#ffb089]" : "text-muted-foreground")}>{move.label}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {advice && advice.switches.some((option) => option.recommended) ? (
            <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6">
              {advice.switches
                .filter((option) => option.recommended)
                .map((option) => `Bring in ${option.name}. ${option.reason}`)
                .join(" ")}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {fight.party.map((slot, index) => {
              const species = catalog.speciesById.get(slot.speciesId)
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActive(index)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs",
                    index === fight.active ? "border-[#e25b2a] bg-[#e25b2a] text-[#1a100c]" : "border-white/15 text-foreground",
                  )}
                >
                  {species?.name ?? "Empty"}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-4 gap-1">
            {WEATHER.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setWeather(option.id)}
                className={cn(
                  "rounded-lg py-1.5 text-xs",
                  fight.weather === option.id ? "bg-[#e25b2a] text-[#1a100c]" : "bg-white/5 text-muted-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button type="button" className="text-xs font-medium text-muted-foreground" onClick={() => setSetup((open) => !open)}>
            {setup ? "Hide setup" : "Change the Pokémon"}
          </button>
          {setup ? (
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-3">
              <SpeciesField slot={fight.foe} label="In front of you" onChange={(patch) => patchFoe(patch)} />
              {foe ? <LevelNatureFields slot={fight.foe} onChange={(patch) => patchFoe(patch)} /> : null}
              {foe ? <AbilityField slot={fight.foe} onChange={(patch) => patchFoe(patch)} /> : null}
              <Range label="Their health" value={fight.foeHp} onChange={setFoeHp} />
              <SpeciesField slot={youSlot} label="You sent out" onChange={(patch) => patchSlot(fight.active, patch)} />
              {you ? <Range label="Your health" value={fight.youHp} onChange={setYouHp} /> : null}
            </div>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              {you && foe ? `${you.name} vs ${foe.name}. ` : ""}
              {desktop ? "Drag the top bar. Alt+Shift+S lets the mouse pass through to the game." : "This is the panel. The desktop app keeps it above the game window."}
            </p>
          )}
        </div>
      </Panel>
    </div>
  )
}

declare global {
  interface Window {
    slate?: {
      setClickThrough: (on: boolean) => void
      setOpacity: (value: number) => void
      close: () => void
      onClickThrough: (callback: (on: boolean) => void) => () => void
    }
  }
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#121610]/95 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">{children}</div>
}

function Range({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs text-muted-foreground">
      <span className="flex justify-between">
        {label}
        <span className="text-foreground">{value}%</span>
      </span>
      <input className="mt-1 w-full accent-[#e25b2a]" type="range" min={1} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}
