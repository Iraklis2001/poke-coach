/** Bridge types for the Electron preload API (`window.slate`). */

export type ScreenRegion = {
  x: number
  y: number
  width: number
  height: number
}

export type RegionRead = {
  text: string
  error?: string
}

export type SlateApi = {
  setClickThrough: (on: boolean) => void
  setOpacity: (value: number) => void
  close: () => void
  onClickThrough: (callback: (on: boolean) => void) => () => void
  pickRegion?: () => Promise<ScreenRegion | null>
  readRegion?: (region: ScreenRegion) => Promise<RegionRead>
  setCompact?: (compact: boolean) => void
  snap?: (corner: "tl" | "tr" | "bl" | "br") => void
}

declare global {
  interface Window {
    slate?: SlateApi
  }
}

export function getSlateApi(): SlateApi | undefined {
  if (typeof window === "undefined") return undefined
  return window.slate
}

export function isDesktopOverlay(): boolean {
  return Boolean(getSlateApi()?.readRegion)
}
