"use client"

import { useState } from "react"
import { searchMoves, type IndexedCatalog } from "@/lib/catalog"
import type { Slot } from "@/lib/types"

export function SlotEditor({
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

  function writeMove(index: number, nextId: string) {
    const next = rows
      .map((row, rowIndex) => {
        if (rowIndex === index) return nextId ? { id: nextId } : null
        return row.id ? row : null
      })
      .filter((row): row is { id: string } => Boolean(row && row.id))
    onChange({ moves: next })
  }

  return (
    <div className="mt-2 space-y-1.5">
      <label className="flex items-center gap-1.5">
        <span className="w-10 shrink-0 text-[10px] font-bold text-black">Lv</span>
        <input
          type="number"
          min={1}
          max={100}
          value={slot.level}
          className="h-7 w-16 rounded-none border-2 border-black bg-white px-1.5 text-[12px] font-bold text-black outline-none"
          onChange={(event) => {
            const next = Number(event.target.value)
            if (!Number.isFinite(next)) return
            onChange({ level: Math.min(100, Math.max(1, Math.round(next))) })
          }}
        />
      </label>
      <p className="text-[11px] font-bold text-black">Type a move name, then pick it.</p>
      {rows.map((row, index) => (
        <MoveSlotField
          key={index}
          index={index}
          moveId={row.id}
          catalog={catalog}
          learnset={learnset}
          onPick={(id) => writeMove(index, id)}
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
  const results =
    open && draft !== null && draft.trim()
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
