"use client"

import { useEffect } from "react"
import { advise } from "@/lib/advise"
import { LESSONS } from "@/lib/typechart"
import { resolveFighter } from "@/lib/resolve"
import {
  dismissBanner,
  markLesson,
  patchFoe,
  patchSlot,
  setActive,
  setFoeHp,
  setWeather,
  setYouHp,
  useFight,
} from "@/lib/store"
import type { Weather } from "@/lib/types"
import { useCatalog } from "@/components/catalog-context"
import { AbilityField, LevelNatureFields, MoveEditor, SpeciesField, StatEditor, TypeOverride } from "@/components/editors"
import { TypeChip } from "@/components/type-chip"
import { Button } from "@/components/ui/button"
import { cn } from "cn"

const WEATHER: { id: Weather; label: string }[] = [
  { id: "none", label: "Clear" },
  { id: "sun", label: "Sun" },
  { id: "rain", label: "Rain" },
  { id: "sand", label: "Sand" },
]

export function FightView({ mode }: { mode: "page" | "overlay" }) {
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
  const lessonId = advice?.lessonId

  useEffect(() => {
    if (lessonId) markLesson(lessonId)
  }, [lessonId])

  const overlay = mode === "overlay"

  return (
    <div className={cn("slate-sky", overlay ? "min-h-screen p-3" : "")}>
      {overlay ? (
        <p className="mb-3 text-xs tracking-wide text-muted-foreground uppercase">Slate · drag this over the game</p>
      ) : null}

      {!overlay && fight.showBanner ? (
        <section className="mb-4 rounded-2xl border border-[#e25b2a]/40 bg-[#2a2118] px-4 py-3">
          <p className="text-sm leading-6 text-foreground">
            Practice fight. You are Charizard, level 50, against a Magnemite. The cream card is the call: which move to click, and why.
            Float it over Pokémon Revolution Online, then replace this team with yours.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => patchFoe({ level: 29 }, true)}>
              Try Magnemite at level 29
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={dismissBanner}>
              Dismiss
            </Button>
          </div>
        </section>
      ) : null}

      <div className={cn("grid gap-4", overlay ? "" : "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        <div className="space-y-4">
          {advice ? <CallCard advice={advice} /> : <NeedNames you={Boolean(you)} foe={Boolean(foe)} />}
          {advice ? <MoveBoard advice={advice} /> : null}
        </div>
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card/80 p-3">
            <SpeciesField slot={fight.foe} label="In front of you" onChange={(patch) => patchFoe(patch)} />
            {foe ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {foe.types.map((type) => (
                    <TypeChip key={type} type={type} />
                  ))}
                </div>
                <LevelNatureFields slot={fight.foe} onChange={(patch) => patchFoe(patch)} />
                <AbilityField slot={fight.foe} onChange={(patch) => patchFoe(patch)} />
                <HealthSlider label="Their health" value={fight.foeHp} onChange={setFoeHp} />
                <TypeOverride slot={fight.foe} onChange={(patch) => patchFoe(patch)} />
                <StatEditor slot={fight.foe} onChange={(patch) => patchFoe(patch)} />
                <details className="rounded-xl border border-border/80 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">Moves you have seen</summary>
                  <div className="mt-2">
                    <MoveEditor slot={fight.foe} onChange={(patch) => patchFoe(patch)} />
                  </div>
                </details>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Search the Pokémon you are fighting. Slate reads its types and tells you the click.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card/80 p-3">
            <label className="mb-1 block text-xs font-medium tracking-wide text-muted-foreground">You sent out</label>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background/70 px-2 text-sm"
              value={fight.active}
              onChange={(event) => setActive(Number(event.target.value))}
            >
              {fight.party.map((slot, index) => {
                const species = catalog.speciesById.get(slot.speciesId)
                return (
                  <option key={index} value={index}>
                    {species?.name ?? `Empty slot ${index + 1}`}
                  </option>
                )
              })}
            </select>
            {you ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {you.types.map((type) => (
                    <TypeChip key={type} type={type} />
                  ))}
                </div>
                <LevelNatureFields slot={youSlot} onChange={(patch) => patchSlot(fight.active, patch)} />
                <AbilityField slot={youSlot} onChange={(patch) => patchSlot(fight.active, patch)} />
                <HealthSlider label="Your health" value={fight.youHp} onChange={setYouHp} />
                {!overlay ? (
                  <>
                    <TypeOverride slot={youSlot} onChange={(patch) => patchSlot(fight.active, patch)} />
                    <StatEditor slot={youSlot} onChange={(patch) => patchSlot(fight.active, patch)} />
                  </>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Pick who you sent out. Empty slots can be filled on the Team page.</p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card/80 p-3">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">Weather</p>
            <div className="grid grid-cols-4 gap-1">
              {WEATHER.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={fight.weather === option.id ? "default" : "secondary"}
                  onClick={() => setWeather(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {advice && advice.switches.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-border bg-card/80 p-4">
          <h3 className="font-heading text-2xl text-foreground">In the back</h3>
          <ul className="mt-3 space-y-3">
            {advice.switches.map((option) => (
              <li key={option.name} className="text-sm leading-6">
                <span className="font-semibold text-foreground">{option.recommended ? `Bring in ${option.name}.` : option.name}</span>{" "}
                <span className="text-muted-foreground">{option.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!overlay ? (
        <section className="mt-4">
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Your six</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {fight.party.map((slot, index) => {
              const species = catalog.speciesById.get(slot.speciesId)
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActive(index)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left",
                    index === fight.active ? "border-[#e25b2a] bg-[#e25b2a]/10" : "border-border bg-card/70",
                  )}
                >
                  <span className="block text-sm font-semibold">{species?.name ?? "Empty"}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {species ? species.types.join(" / ") : "Add on the Team page"}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {you && !overlay ? (
        <details className="mt-4 rounded-2xl border border-border bg-card/80 p-4">
          <summary className="cursor-pointer text-sm font-medium">Change the moves on {you.name}</summary>
          <div className="mt-3">
            <MoveEditor slot={youSlot} onChange={(patch) => patchSlot(fight.active, patch)} />
          </div>
        </details>
      ) : null}
    </div>
  )
}

function CallCard({ advice }: { advice: ReturnType<typeof advise> }) {
  const lesson = LESSONS[advice.lessonId]
  return (
    <article className="rounded-[22px] bg-[#f6f1e6] px-5 py-5 text-[#221c16] shadow-[0_24px_60px_rgba(0,0,0,0.28)]" aria-live="polite">
      <p className="text-xs font-bold tracking-[0.18em] text-[#e25b2a] uppercase">{advice.kicker}</p>
      <h2 className="font-heading mt-2 text-4xl leading-none tracking-tight">{advice.headline}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-6">
        {advice.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {advice.theyWeak.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold tracking-wide text-[#5c5348] uppercase">They are weak to</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {advice.theyWeak.map((row) => (
              <TypeChip key={row.type} type={row.type} factor={row.factor} />
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 rounded-2xl bg-[#efe8da] px-3 py-3">
        <p className="text-xs font-bold tracking-wide text-[#5c5348] uppercase">Learn this</p>
        <p className="mt-1 font-semibold">{lesson.title}</p>
        <p className="mt-1 text-sm leading-6 text-[#3d362e]">{lesson.body}</p>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#3d362e]">{advice.speedLine}</p>
      <p className="mt-2 text-sm leading-6 text-[#3d362e]">{advice.threatLine}</p>
      <p className="mt-3 text-xs leading-5 text-[#5c5348]">{advice.estimateNote}</p>
    </article>
  )
}

function MoveBoard({ advice }: { advice: ReturnType<typeof advise> }) {
  if (advice.moves.length === 0) return null
  return (
    <section className="rounded-2xl border border-border bg-card/80 p-3">
      <h3 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Your moves</h3>
      <ul className="mt-2 space-y-2">
        {advice.moves.map((move) => (
          <li
            key={`${move.id}-${move.type}`}
            className={cn(
              "rounded-xl border px-3 py-3",
              move.recommended ? "border-[#e25b2a] bg-[#e25b2a]/10" : "border-border bg-background/40",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              {move.recommended ? (
                <span className="text-[11px] font-bold tracking-wide text-[#e25b2a] uppercase">Click this</span>
              ) : null}
              <span className="font-semibold">{move.name}</span>
              <TypeChip type={move.type} />
              <span className="text-xs text-muted-foreground">{move.category}</span>
              <span className="ml-auto text-sm font-semibold">{move.label}</span>
            </div>
            {move.damageText ? <p className="mt-1 text-sm leading-6 text-foreground">{move.damageText}</p> : null}
            {move.detail && move.detail !== move.damageText ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{move.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function NeedNames({ you, foe }: { you: boolean; foe: boolean }) {
  return (
    <article className="rounded-[22px] bg-[#f6f1e6] px-5 py-6 text-[#221c16]">
      <p className="text-xs font-bold tracking-[0.18em] text-[#e25b2a] uppercase">Waiting</p>
      <h2 className="font-heading mt-2 text-4xl leading-none">
        {foe ? "Choose who you sent out." : "Who is in front of you?"}
      </h2>
      <p className="mt-3 text-sm leading-6">
        {foe
          ? "Pick one of your six. The call shows up as soon as both sides have a name."
          : you
            ? "Search the Pokémon you are fighting. You do not need its moves yet. Types are enough to start."
            : "Search their Pokémon, and pick yours. Slate will tell you the move in plain language."}
      </p>
    </article>
  )
}

function HealthSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs font-medium tracking-wide text-muted-foreground">
      <span className="flex items-center justify-between">
        {label}
        <span className="text-foreground">{value}%</span>
      </span>
      <input
        className="mt-2 w-full accent-[#e25b2a]"
        type="range"
        min={1}
        max={100}
        value={value}
        aria-valuetext={`${value} percent`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
