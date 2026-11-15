import assert from "node:assert/strict"
import test from "node:test"
import { explainMatchup, explainParts, typeHit } from "@/lib/typechart"

test("ground hits electric and steel four times", () => {
  const match = explainMatchup({ moveType: "Ground", defenderTypes: ["Electric", "Steel"] })
  assert.equal(match.factor, 4)
  assert.match(match.sentence, /four times/i)
})

test("fire is only twice as hard into magnemite", () => {
  const match = explainMatchup({ moveType: "Fire", defenderTypes: ["Electric", "Steel"] })
  assert.equal(match.factor, 2)
  assert.match(match.sentence, /Steel/i)
  assert.match(match.sentence, /twice/i)
})

test("flying is quarter damage into magnemite", () => {
  const match = explainMatchup({ moveType: "Flying", defenderTypes: ["Electric", "Steel"] })
  assert.equal(match.factor, 0.25)
  assert.match(match.sentence, /quarter/i)
})

test("electric does nothing to ground", () => {
  const match = explainMatchup({ moveType: "Electric", defenderTypes: ["Ground"] })
  assert.equal(match.factor, 0)
  assert.match(match.sentence, /nothing/i)
})

test("electric versus water and grass cancels", () => {
  const match = explainMatchup({ moveType: "Electric", defenderTypes: ["Water", "Grass"] })
  assert.equal(match.factor, 1)
  assert.match(match.sentence, /cancel/i)
})

test("a ghost immunity beats the other type", () => {
  const match = explainMatchup({ moveType: "Fighting", defenderTypes: ["Ghost", "Steel"] })
  assert.equal(match.factor, 0)
  assert.match(match.sentence, /nothing/i)
})

test("shadow hits ordinary types twice and resists itself", () => {
  assert.equal(typeHit("Shadow", "Fire"), 2)
  assert.equal(typeHit("Fire", "Shadow"), 1)
  assert.equal(typeHit("Shadow", "Shadow"), 0.5)
  assert.match(explainParts("Shadow", [{ type: "Fire", factor: 2 }]), /twice/i)
})

test("levitate removes the ground weakness", () => {
  const match = explainMatchup({
    moveType: "Ground",
    moveId: "earthquake",
    defenderTypes: ["Electric", "Steel"],
    defenderAbility: "levitate",
  })
  assert.equal(match.factor, 0)
  assert.match(match.notes.join(" "), /Levitate/)
})

test("freeze-dry is super effective on water", () => {
  const match = explainMatchup({
    moveType: "Ice",
    moveId: "freezedry",
    defenderTypes: ["Water"],
  })
  assert.equal(match.factor, 2)
  assert.match(match.notes.join(" "), /Freeze-Dry/)
})

test("scrappy lets normal hit a ghost", () => {
  const match = explainMatchup({
    moveType: "Normal",
    moveId: "tackle",
    defenderTypes: ["Ghost", "Poison"],
    attackerAbility: "scrappy",
  })
  assert.equal(match.factor, 1)
  assert.match(match.notes.join(" "), /Scrappy/)
})

test("thousand arrows hits flying", () => {
  const match = explainMatchup({
    moveType: "Ground",
    moveId: "thousandarrows",
    defenderTypes: ["Flying"],
  })
  assert.equal(match.factor, 1)
})
