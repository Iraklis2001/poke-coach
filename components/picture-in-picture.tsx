"use client"

import { createRoot, type Root } from "react-dom/client"
import type { IndexedCatalog } from "@/lib/catalog"
import { CatalogProvider } from "@/components/catalog-context"
import { FightView } from "@/components/fight-view"

type PictureInPicture = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
}

let current: { window: Window; root: Root } | null = null

export const FLOAT_NEEDS_BROWSER =
  "This window cannot float on top of the game. Open Slate in Chrome or Edge as a normal tab, press Float over the game, and drag that panel over Pokémon Revolution Online. You can keep using this page beside the client."

export function canFloat() {
  return typeof window !== "undefined" && "documentPictureInPicture" in window
}

export async function openCoachWindow(catalog: IndexedCatalog): Promise<boolean> {
  const pip = (window as Window & { documentPictureInPicture?: PictureInPicture }).documentPictureInPicture
  if (!pip) return false
  if (current && !current.window.closed) {
    current.window.focus()
    return true
  }
  let child: Window
  try {
    child = await pip.requestWindow({ width: 400, height: 780 })
  } catch {
    return false
  }
  const base = child.document.createElement("base")
  base.href = document.baseURI
  child.document.head.appendChild(base)
  child.document.title = "Slate"
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    const clone = node.cloneNode(true) as HTMLLinkElement
    if (clone.tagName === "LINK") {
      const href = clone.getAttribute("href")
      if (href) clone.href = new URL(href, document.baseURI).href
    }
    child.document.head.appendChild(clone)
  })
  try {
    if (document.adoptedStyleSheets?.length) child.document.adoptedStyleSheets = [...document.adoptedStyleSheets]
  } catch {
    // Some browsers refuse to share sheets across documents. The cloned links still apply.
  }
  child.document.documentElement.className = document.documentElement.className
  child.document.body.className = document.body.className
  child.document.body.style.margin = "0"
  child.document.body.style.minHeight = "100%"
  const mount = child.document.createElement("div")
  child.document.body.appendChild(mount)
  const root = createRoot(mount)
  root.render(
    <CatalogProvider catalog={catalog}>
      <FightView mode="overlay" />
    </CatalogProvider>,
  )
  current = { window: child, root }
  child.addEventListener("pagehide", () => {
    root.unmount()
    if (current?.window === child) current = null
  })
  return true
}
