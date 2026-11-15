import assert from "node:assert/strict"
import test from "node:test"
import { calcStat } from "@/lib/stats"

test("adamant attack at level 100 matches the standard formula", () => {
  assert.equal(calcStat("atk", 100, 100, { plus: "atk", minus: "spa" }, 31, 252), 328)
})

test("shedinja stays at 1 hp", () => {
  assert.equal(calcStat("hp", 1, 50, null), 1)
})
