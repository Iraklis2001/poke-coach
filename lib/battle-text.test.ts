import assert from "node:assert/strict"
import test from "node:test"
import { matchSpeciesName, readBattleText, readNameplate } from "./battle-text"

const NAMES = [
  { id: "krabby", name: "Krabby" },
  { id: "gengar", name: "Gengar" },
  { id: "mrmime", name: "Mr. Mime" },
  { id: "rattata", name: "Rattata" },
  { id: "tentacool", name: "Tentacool" },
  { id: "seadra", name: "Seadra" },
]

test("wild attack and go lines name both pokemon", () => {
  const read = readBattleText("A wild Krabby attacks! Go Gengar!")
  assert.equal(read.foe, "Krabby")
  assert.equal(read.you, "Gengar")
})

test("a cut-off wild line still keeps the name", () => {
  const read = readBattleText("A wild Tentacool")
  assert.equal(read.foe, "Tentacool")
})

test("a trainer send-out names the foe", () => {
  const read = readBattleText("Youngster Joey sent out Rattata!")
  assert.equal(read.foe, "Rattata")
  assert.equal(read.you, null)
})

test("level is read when the box includes it", () => {
  const read = readBattleText("Krabby Lv. 32")
  assert.equal(read.level, 32)
  assert.equal(read.foe, null)
})

test("the latest send-out is the foe when the box has two lines", () => {
  const read = readBattleText("sent out Rattata! Go Gengar! sent out Pidgey! Go, Haunter!")
  assert.equal(read.foe, "Pidgey")
  assert.equal(read.you, "Haunter")
})

test("two levels are kept only when one sits next to the foe", () => {
  const mixed = readBattleText("A wild Krabby attacks! Lv. 32 Lv. 100")
  assert.equal(mixed.level, null)
  const beside = readBattleText("A wild Krabby attacks! Krabby Lv. 32 Gengar Lv. 100")
  assert.equal(beside.level, 32)
})

test("species names match the pokedex, including punctuation", () => {
  assert.equal(matchSpeciesName("Krabby", NAMES)?.id, "krabby")
  assert.equal(matchSpeciesName("mr mime", NAMES)?.id, "mrmime")
  assert.equal(matchSpeciesName("Magikarp", NAMES), null)
})

test("foe nameplate reads name and level from the red HUD box", () => {
  const read = readNameplate("Tentacool ♂ Lv. 34")
  assert.equal(read.foe, "Tentacool")
  assert.equal(read.level, 34)
  assert.equal(matchSpeciesName(read.foe!, NAMES)?.id, "tentacool")
})

test("messy nameplate OCR still keeps the name before Lv", () => {
  const read = readNameplate("Tentacool\nLv 34")
  assert.equal(read.foe, "Tentacool")
  assert.equal(read.level, 34)
})

test("battle log marks a faint so the next send-out can replace the foe", () => {
  const faint = readBattleText("Wild Tentacool fainted!")
  assert.equal(faint.fainted, true)
  const next = readBattleText("Youngster Joey sent out Seadra!")
  assert.equal(next.foe, "Seadra")
  assert.equal(next.fainted, false)
})
