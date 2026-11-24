import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { search, norm, score } from "../web/app/search.js"
const data = JSON.parse(readFileSync(new URL("../web/data/leonida.json", import.meta.url)))

test("normalises accents, case and apostrophes", () => {
  assert.equal(norm("Sara's Unisex SALON"), "saras unisex salon")
  assert.equal(norm("PTT Youngin$"), "ptt youngin$")
})
test("exact beats prefix beats word beats substring", () => {
  assert.ok(score("Hamlet", "hamlet") > score("Hamlet Road", "hamlet"))
  assert.ok(score("Hamlet Road", "hamlet") > score("Old Hamlet", "hamlet"))
  assert.ok(score("Old Hamlet", "hamlet") > score("Shamlet", "hamlet"))
})
test("finds places by name, category and region", () => {
  assert.equal(search(data, "ocean beach")[0].item.id, "ocean-beach")
  assert.ok(search(data, "safehouse").filter(r => r.item.cat === "safehouse").length >= 4)
  assert.ok(search(data, "keys").some(r => r.kind === "region" && r.item.id === "leonida-keys"))
})
test("mission names only match with spoilers on", () => {
  assert.equal(search(data, "sinfrontera").filter(r => r.kind === "mission").length, 0)
  assert.equal(search(data, "sinfrontera", { spoilers: true })[0].item.name, "Sinfrontera National Bank")
  assert.ok(search(data, "chapter 3").some(r => r.kind === "mission"))
})
test("data holds together", () => {
  assert.equal(data.missions.length, 91)
  assert.equal(data.regions.length, 6)
  const ids = new Set(data.places.map(p => p.id))
  assert.equal(ids.size, data.places.length, "place ids are unique")
  for (const p of data.places) {
    assert.ok(data.categories.some(c => c.id === p.cat), `${p.id} has a known category`)
    if (p.at) assert.ok(ids.has(p.at), `${p.id} points at a real place`)
    if (p.x != null) assert.ok(p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 1200, `${p.id} is on the map`)
  }
  for (const m of data.missions) if (m.at) assert.ok(ids.has(m.at))
})

import { missionsDone, estimate } from "../web/app/story.js"
test("save percent maps onto the story", () => {
  assert.equal(missionsDone(0, 91), 0)
  assert.equal(missionsDone(30, 91), 46)      // half the story share
  assert.equal(missionsDone(60, 91), 91)
  assert.equal(missionsDone(100, 91), 91)
  assert.equal(missionsDone(-5, 91), 0)
  assert.equal(missionsDone("abc", 91), 0)
  const e = estimate(30, data.missions)
  assert.equal(e.next.id, data.missions[46].id)
  assert.equal(estimate(75, data.missions).finished, true)
})
