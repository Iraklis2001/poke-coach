import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { indexCatalog } from "@/lib/catalog"
import { advise } from "@/lib/advise"
import { resolveFighter } from "@/lib/resolve"
import { practiceFight, type SavedFight } from "@/lib/sample"
import type { Slot } from "@/lib/types"

const catalog = indexCatalog(
  JSON.parse(readFileSync(new URL("../public/data/catalog.json", import.meta.url), "utf8")),
  JSON.parse(readFileSync(new URL("../public/data/learnsets.json", import.meta.url), "utf8")),
)

function run(fight: SavedFight, active = fight.active) {
  const you = resolveFighter(fight.party[active], catalog, fight.youHp)
  const foe = resolveFighter(fight.foe, catalog, fight.foeHp)
  assert.ok(you && foe)
  const bench = fight.party
    .filter((_, index) => index !== active)
    .map((slot) => resolveFighter(slot, catalog, fight.youHp))
    .filter((mon) => mon !== null)
  return advise(you, foe, bench, fight.weather)
}

function replaceActive(moves: string[], species?: Partial<Slot>): SavedFight {
  const fight = practiceFight()
  fight.party[0] = {
    ...fight.party[0],
    ...species,
    moves: moves.map((id) => ({ id })),
  }
  return fight
}

test("practice fight tells Charizard to click Flamethrower", () => {
  const advice = run(practiceFight())
  assert.equal(advice.verdict, "stay")
  assert.match(advice.headline, /Flamethrower/)
  assert.equal(advice.moves.find((move) => move.name === "Flamethrower")?.factor, 2)
  assert.equal(advice.moves.find((move) => move.name === "Air Slash")?.factor, 0.25)
  assert.match(advice.paragraphs.join(" "), /super effective/i)
})

test("a water type without a ground move is told to switch into Excadrill", () => {
  const fight = replaceActive(["surf", "icebeam"], {
    speciesId: "blastoise",
    abilityId: "torrent",
    natureId: "modest",
  })
  const advice = run(fight)
  assert.equal(advice.verdict, "switch")
  assert.match(advice.headline, /Excadrill/)
})

test("earthquake is the click when Gyarados has it", () => {
  const fight = replaceActive(["waterfall", "earthquake", "icefang"], {
    speciesId: "gyarados",
    abilityId: "intimidate",
    natureId: "adamant",
  })
  const advice = run(fight)
  assert.equal(advice.verdict, "stay")
  assert.match(advice.headline, /Earthquake/)
  assert.equal(advice.moves.find((move) => move.name === "Earthquake")?.factor, 4)
})

test("electric moves into a ground type do nothing", () => {
  const fight = replaceActive(["thunderbolt", "quickattack"], {
    speciesId: "pikachu",
    abilityId: "static",
    natureId: "timid",
  })
  fight.foe = {
    ...fight.foe,
    speciesId: "sandshrew",
    abilityId: "sandveil",
    natureId: "adamant",
  }
  const advice = run(fight)
  const bolt = advice.moves.find((move) => move.name === "Thunderbolt")
  assert.equal(bolt?.factor, 0)
  assert.match(advice.paragraphs.join(" ") + advice.headline, /nothing|Switch|Bring in|least bad|Quick Attack/i)
})

test("unset hidden power is called out", () => {
  const fight = replaceActive(["hiddenpower"])
  const advice = run(fight)
  assert.match(advice.headline + advice.paragraphs.join(" "), /Hidden Power/)
  assert.equal(advice.lessonId, "hiddenpower")
})

test("levitate stops earthquake", () => {
  const fight = replaceActive(["earthquake"], {
    speciesId: "excadrill",
    abilityId: "sandrush",
    natureId: "adamant",
  })
  fight.foe = {
    ...fight.foe,
    speciesId: "rotomheat",
    abilityId: "levitate",
    natureId: "modest",
  }
  const advice = run(fight)
  assert.equal(advice.moves.find((move) => move.name === "Earthquake")?.factor, 0)
  assert.match(advice.paragraphs.join(" "), /Levitate/)
})
