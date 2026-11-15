import assert from "node:assert/strict"
import test from "node:test"
import { fillSlotFromSummary, readSummaryText } from "./summary-text"

test("summary text reads ampharos name, level, ability, nature, and moves", () => {
  const text = `Ampharos
Lv. 99 Johto ID: 93818476
Ability Static
Nature Calm
OT Magicstickcy
Moves
Thunderbolt 15/15
Thunder Wave 20/20
Thunder 10/10
Dragon Pulse 10/10`
  const read = readSummaryText(text)
  assert.equal(read.species, "Ampharos")
  assert.equal(read.level, 99)
  assert.equal(read.ability, "Static")
  assert.equal(read.nature, "Calm")
  assert.deepEqual(read.moves, ["Thunderbolt", "Thunder Wave", "Thunder", "Dragon Pulse"])
})

test("fillSlotFromSummary maps ampharos onto catalog ids", () => {
  const catalog = {
    species: [{ id: "ampharos", name: "Ampharos", num: 181, types: ["Electric"], stats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }, weight: 1, abilities: [{ id: "static", name: "Static", hidden: false }] }],
    moves: [
      { id: "thunderbolt", name: "Thunderbolt", type: "Electric", category: "Special" as const, bp: 90, acc: 100, pp: 15, priority: 0, desc: "", flags: [] },
      { id: "thunderwave", name: "Thunder Wave", type: "Electric", category: "Status" as const, bp: 0, acc: 90, pp: 20, priority: 0, desc: "", flags: [] },
      { id: "thunder", name: "Thunder", type: "Electric", category: "Special" as const, bp: 110, acc: 70, pp: 10, priority: 0, desc: "", flags: [] },
      { id: "dragonpulse", name: "Dragon Pulse", type: "Dragon", category: "Special" as const, bp: 85, acc: 100, pp: 10, priority: 0, desc: "", flags: [] },
    ],
    abilities: [{ id: "static", name: "Static", desc: "" }],
    natures: [{ id: "calm", name: "Calm", plus: "spd" as const, minus: "atk" as const }],
  }
  const slot = fillSlotFromSummary(
    `Ampharos
Lv. 99
Ability: Static
Nature: Calm
Moves
Thunderbolt 15/15
Thunder Wave 20/20
Thunder 10/10
Dragon Pulse 10/10`,
    catalog,
  )
  assert.equal(slot?.speciesId, "ampharos")
  assert.equal(slot?.level, 99)
  assert.equal(slot?.abilityId, "static")
  assert.equal(slot?.natureId, "calm")
  assert.ok(slot?.moves)
  assert.deepEqual(
    slot.moves.map((move) => move.id),
    ["thunderbolt", "thunderwave", "thunder", "dragonpulse"],
  )
})
