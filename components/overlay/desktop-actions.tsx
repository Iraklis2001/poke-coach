"use client"

import { saveFoeBox } from "@/lib/overlay-storage"
import { getSlateApi } from "@/lib/slate-api"

export function DesktopActions({
  fillBusy,
  watching,
  status,
  onFill,
  onToggleWatch,
}: {
  fillBusy: boolean
  watching: boolean
  status: string
  onFill: () => void
  onToggleWatch: () => void
}) {
  return (
    <div className="mt-3">
      <div className="flex items-stretch overflow-hidden rounded-none border-2 border-black bg-[#3b4cca]">
        <button
          type="button"
          className="flex-1 px-2 py-2 text-[12px] font-bold text-white hover:text-yellow-200 disabled:opacity-60"
          disabled={fillBusy}
          onClick={onFill}
        >
          {fillBusy ? "Reading…" : "1. My Pokémon"}
        </button>
        <span className="w-0.5 self-stretch bg-black" aria-hidden />
        <button
          type="button"
          className="flex-1 px-2 py-2 text-[12px] font-bold text-white hover:text-yellow-200"
          onClick={onToggleWatch}
        >
          {watching ? "Stop fight" : "2. The fight"}
        </button>
      </div>
      <p className="mt-1 text-[11px] font-bold text-black">
        {status ||
          (watching
            ? "Watching the foe name box."
            : "1 reads your summary. 2 draws a box on the foe name + Lv (top left).")}
      </p>
    </div>
  )
}

export async function beginFoeWatch(options: {
  watching: boolean
  setWatching: (next: boolean) => void
  setStatus: (next: string) => void
  bumpBox: () => void
}) {
  const { watching, setWatching, setStatus, bumpBox } = options
  if (watching) {
    setWatching(false)
    setStatus("Stopped reading the fight.")
    return
  }

  const api = getSlateApi()
  if (!api?.pickRegion || !api.readRegion) return

  setStatus("Draw a tight box around the foe’s name and Lv (top left of the battle).")
  const box = await api.pickRegion()
  if (!box) {
    setStatus("Cancelled.")
    return
  }

  saveFoeBox(box)
  bumpBox()
  setStatus("Watching the foe name box — it updates when the next Pokémon comes out.")
  setWatching(true)
}
