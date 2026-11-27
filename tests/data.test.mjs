// Checks on web/data/leonida.json: ids are unique, every pin sits on land and inside its own region.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const d = JSON.parse(readFileSync(new URL("../web/data/leonida.json", import.meta.url)))
const inside = ([x, y], poly) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[j]
    if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) c = !c
  }
  return c
}
const near = ([x, y], poly, r) => poly.some(([px, py]) => Math.hypot(px - x, py - y) < r)
const shapes = [d.map.land, ...d.map.islands.map(i => i.pts)]
const pins = d.places.filter(p => p.x != null && p.cat !== "people")

test("ids are unique", () => {
  for (const list of [d.places, d.missions, d.collectibles, d.regions]) {
    const ids = list.map(x => x.id)
    assert.equal(new Set(ids).size, ids.length)
  }
})

test("every pin is on land or the shore (bays and reefs are nature pins and may sit in the water)", () => {
  const off = pins.filter(p => p.cat !== "nature" && !shapes.some(s => inside([p.x, p.y], s) || near([p.x, p.y], s, 8)))
  assert.deepEqual(off.map(p => p.id), [])
})

test("every pin is inside its region", () => {
  const region = Object.fromEntries(d.regions.map(r => [r.id, r]))
  const wrong = pins.filter(p => p.region && !inside([p.x, p.y], region[p.region].poly) && !near([p.x, p.y], region[p.region].poly, 12))
  assert.deepEqual(wrong.map(p => `${p.id} (${p.region})`), [])
})

test("the map credits its source", () => assert.match(d.credits, /gtadb/i))
