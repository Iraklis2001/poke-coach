import assert from "node:assert/strict"
import test from "node:test"
import { fillSlotFromSummary } from "./summary-text"

const catalog = {
  species: [
    {
      id: "ampharos",
      name: "Ampharos",
      num: 181,
      types: ["Electric"],
      stats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
      weight: 1,
      abilities: [{ id: "static", name: "Static", hidden: false }],
    },
  ],
  moves: [
    { id: "thunderbolt", name: "Thunderbolt", type: "Electric", category: "Special" as const, bp: 90, acc: 100, pp: 15, priority: 0, desc: "", flags: [] },
    { id: "thunderwave", name: "Thunder Wave", type: "Electric", category: "Status" as const, bp: 0, acc: 90, pp: 20, priority: 0, desc: "", flags: [] },
    { id: "thunder", name: "Thunder", type: "Electric", category: "Special" as const, bp: 110, acc: 70, pp: 10, priority: 0, desc: "", flags: [] },
    { id: "dragonpulse", name: "Dragon Pulse", type: "Dragon", category: "Special" as const, bp: 85, acc: 100, pp: 10, priority: 0, desc: "", flags: [] },
    { id: "tackle", name: "Tackle", type: "Normal", category: "Physical" as const, bp: 40, acc: 100, pp: 35, priority: 0, desc: "", flags: [] },
  ],
  abilities: [{ id: "static", name: "Static", desc: "" }],
  natures: [{ id: "calm", name: "Calm", plus: "spd" as const, minus: "atk" as const }],
  learnsets: {
    ampharos: ["thunderbolt", "thunderwave", "thunder", "dragonpulse", "cottonspore"],
  },
}

test("messy OCR from the Ampharos summary still fills four moves", () => {
  const slot = fillSlotFromSummary(
    `Ampharos Liss so 1 Sss1s47s x
Ex Nature, - r.
Current T1750 Calm .
Til Net 256407
Moves Magicstichey AT 16203102
Thunderbolt 15015 Bag jis po oo
Thunder Wave am || TO 1591610
Thunder 1010 SPOEF 248 26056
Dragon Pulse wo He 03.051`,
    catalog,
  )
  assert.equal(slot?.speciesId, "ampharos")
  assert.equal(slot?.natureId, "calm")
  assert.ok(slot?.moves)
  assert.deepEqual(new Set(slot.moves.map((move) => move.id)), new Set(["thunderbolt", "thunderwave", "thunder", "dragonpulse"]))
  assert.equal(slot.moves.length, 4)
})

test("OCR typos still recover learnset moves", () => {
  const slot = fillSlotFromSummary(
    `Gengar Lv. 100
Moves
Thunderb0lt 15/15
Psychlc 10/10
Shadow Ball 15/15
Sludge Bomb 10/10`,
    {
      ...catalog,
      species: [
        {
          id: "gengar",
          name: "Gengar",
          num: 94,
          types: ["Ghost", "Poison"],
          stats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
          weight: 1,
          abilities: [{ id: "cursedbody", name: "Cursed Body", hidden: false }],
        },
      ],
      moves: [
        ...catalog.moves,
        { id: "psychic", name: "Psychic", type: "Psychic", category: "Special" as const, bp: 90, acc: 100, pp: 10, priority: 0, desc: "", flags: [] },
        { id: "shadowball", name: "Shadow Ball", type: "Ghost", category: "Special" as const, bp: 80, acc: 100, pp: 15, priority: 0, desc: "", flags: [] },
        { id: "sludgebomb", name: "Sludge Bomb", type: "Poison", category: "Special" as const, bp: 90, acc: 100, pp: 10, priority: 0, desc: "", flags: [] },
      ],
      learnsets: {
        gengar: ["thunderbolt", "psychic", "shadowball", "sludgebomb"],
      },
    },
  )
  assert.equal(slot?.speciesId, "gengar")
  assert.ok(slot?.moves)
  assert.equal(slot.moves.length, 4)
  assert.ok(slot.moves.some((move) => move.id === "thunderbolt"))
  assert.ok(slot.moves.some((move) => move.id === "psychic"))
})

test("clean Ampharos summary still fills the slot", () => {
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
