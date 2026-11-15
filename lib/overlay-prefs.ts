export type OverlayPrefs = {
  compact: boolean
  opacity: number
}

export const OVERLAY_PREFS_KEY = "slate-overlay-prefs"

export const DEFAULT_OVERLAY_PREFS: OverlayPrefs = {
  compact: true,
  opacity: 0.95,
}

export function loadOverlayPrefs(): OverlayPrefs {
  try {
    const raw = window.localStorage.getItem(OVERLAY_PREFS_KEY)
    if (!raw) return DEFAULT_OVERLAY_PREFS
    const parsed = JSON.parse(raw) as Partial<OverlayPrefs>
    return {
      compact: parsed.compact ?? DEFAULT_OVERLAY_PREFS.compact,
      opacity: Math.min(1, Math.max(0.5, parsed.opacity ?? DEFAULT_OVERLAY_PREFS.opacity)),
    }
  } catch {
    return DEFAULT_OVERLAY_PREFS
  }
}

export function saveOverlayPrefs(prefs: OverlayPrefs) {
  window.localStorage.setItem(OVERLAY_PREFS_KEY, JSON.stringify(prefs))
}
