"use client"

import { useSyncExternalStore } from "react"
import { normalizeFight, practiceFight, type SavedFight } from "@/lib/sample"
import type { Slot, Weather } from "@/lib/types"

const KEY = "slate-coach-v1"
const PRACTICE = practiceFight()

let state: SavedFight = PRACTICE
let hydrated = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function commit(next: SavedFight) {
  state = next
  if (hydrated) window.localStorage.setItem(KEY, JSON.stringify(state))
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function hydrateFight() {
  if (hydrated) return
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) state = normalizeFight(JSON.parse(raw))
  } catch {
    state = PRACTICE
  }
  hydrated = true
  emit()
}

export function useFight() {
  const ready = useSyncExternalStore(subscribe, () => hydrated, () => false)
  const fight = useSyncExternalStore(subscribe, () => (hydrated ? state : PRACTICE), () => PRACTICE)
  return { ready, fight }
}

export function patchSlot(index: number, patch: Partial<Slot>) {
  const party = state.party.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot))
  commit({ ...state, party, showBanner: false })
}

export function setActive(index: number) {
  commit({ ...state, active: index, showBanner: state.showBanner })
}

export function patchFoe(patch: Partial<Slot>, keepBanner = false) {
  commit({
    ...state,
    foe: { ...state.foe, ...patch },
    showBanner: keepBanner ? state.showBanner : false,
  })
}

export function setYouHp(youHp: number) {
  commit({ ...state, youHp, showBanner: state.showBanner })
}

export function setFoeHp(foeHp: number) {
  commit({ ...state, foeHp, showBanner: state.showBanner })
}

export function setWeather(weather: Weather) {
  commit({ ...state, weather, showBanner: state.showBanner })
}

export function dismissBanner() {
  commit({ ...state, showBanner: false })
}

export function resetPractice() {
  commit(practiceFight())
}

export function markLesson(id: string) {
  if (state.lessons.includes(id)) return
  commit({ ...state, lessons: [...state.lessons, id] })
}
