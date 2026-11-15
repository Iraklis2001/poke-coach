"use client"

import type { IndexedCatalog } from "@/lib/catalog"
import { cn } from "cn"

export function PartyStrip({
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
              suggested
                ? "border-blue-600 bg-blue-100"
                : selected
                  ? "border-[#e3350d] bg-white"
                  : "border-black bg-[#f8f8f8]",
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
