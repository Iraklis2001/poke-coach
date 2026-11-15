"use client"

import { useEffect, useState } from "react"
import { advise } from "@/lib/advise"
import { searchSpecies } from "@/lib/catalog"
import { fillPartySlotFromSummary } from "@/lib/fill-summary"
import { DEFAULT_OVERLAY_PREFS, loadOverlayPrefs, saveOverlayPrefs, type OverlayPrefs } from "@/lib/overlay-prefs"
import { resolveFighter } from "@/lib/resolve"
import { getSlateApi, isDesktopOverlay } from "@/lib/slate-api"
import { patchFoe, patchSlot, setActive, useFight } from "@/lib/store"
import { useCatalog } from "@/components/catalog-context"
import { useFoeWatch } from "@/hooks/use-foe-watch"
import { AdviceBlock } from "@/components/overlay/advice-block"
import { beginFoeWatch, DesktopActions } from "@/components/overlay/desktop-actions"
import { PanelShell } from "@/components/overlay/panel-shell"
import { PartyStrip } from "@/components/overlay/party-strip"
import { SlotEditor } from "@/components/overlay/slot-editor"
import { TitleBar } from "@/components/overlay/title-bar"

export function CoachPanel() {
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
  const switchPick = advice?.switches.find((option) => option.recommended) ?? null

  const [desktop] = useState(() => isDesktopOverlay())
  const [query, setQuery] = useState("")
  const [watching, setWatching] = useState(false)
  const [boxTick, setBoxTick] = useState(0)
  const [status, setStatus] = useState("")
  const [fillBusy, setFillBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [prefs, setPrefs] = useState<OverlayPrefs>(() =>
    typeof window === "undefined" ? DEFAULT_OVERLAY_PREFS : loadOverlayPrefs(),
  )

  const matches = query.trim() ? searchSpecies(catalog, query, 6) : []

  useFoeWatch({
    watching,
    boxTick,
    fight,
    catalog,
    onStatus: setStatus,
  })

  useEffect(() => {
    getSlateApi()?.setClickThrough(false)
  }, [])

  useEffect(() => {
    const api = getSlateApi()
    if (!desktop || !api) return
    api.setOpacity(prefs.opacity)
    api.setCompact?.(prefs.compact)
    saveOverlayPrefs(prefs)
  }, [desktop, prefs])

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

  async function onFill() {
    if (fillBusy) return
    setFillBusy(true)
    setStatus("Draw a box over the open summary window.")
    try {
      const result = await fillPartySlotFromSummary(catalog, fight.active, youSlot.level)
      setStatus(result.message)
    } catch {
      setStatus("The summary could not be read.")
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
        <PanelShell>
          <TitleBar
            title={foe?.name ?? "Wild Pokémon"}
            level={foe ? `Lv ${foe.level}` : ""}
            compact={prefs.compact}
            onClose={desktop ? () => getSlateApi()?.close() : undefined}
            onToggleCompact={() => setPrefs((current) => ({ ...current, compact: !current.compact }))}
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
                onClick={() => setEditing((open) => !open)}
              >
                {editing ? "Done" : "Edit"}
              </button>
            </div>

            {editing ? (
              <SlotEditor
                key={fight.active}
                slot={youSlot}
                catalog={catalog}
                onChange={(patch) => patchSlot(fight.active, patch)}
              />
            ) : null}

            <AdviceBlock advice={advice} compact={prefs.compact} />

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
              <DesktopActions
                fillBusy={fillBusy}
                watching={watching}
                status={status}
                onFill={() => void onFill()}
                onToggleWatch={() =>
                  void beginFoeWatch({
                    watching,
                    setWatching,
                    setStatus,
                    bumpBox: () => setBoxTick((tick) => tick + 1),
                  })
                }
              />
            ) : null}
          </div>
        </PanelShell>
      </div>
    </div>
  )
}
