import type { ScreenRegion } from "@/lib/slate-api"

/** Saved capture box over the foe nameplate (name + Lv). */
export const FOE_BOX_KEY = "slate-foe-box"

export function loadFoeBox(): ScreenRegion | null {
  try {
    const raw = window.localStorage.getItem(FOE_BOX_KEY)
    if (!raw) return null
    const box = JSON.parse(raw) as ScreenRegion
    if (!box || typeof box.x !== "number" || typeof box.width !== "number") return null
    return box
  } catch {
    return null
  }
}

export function saveFoeBox(box: ScreenRegion) {
  window.localStorage.setItem(FOE_BOX_KEY, JSON.stringify(box))
}
