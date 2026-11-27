import { test } from "node:test"
import assert from "node:assert/strict"
import { tour, pathLength } from "../web/app/route.js"

const P = (x, y, id) => ({ x, y, id })

test("small sets come back as they are", () => {
  assert.deepEqual(tour([]), [])
  assert.deepEqual(tour([P(0, 0, "a"), P(5, 5, "b")]).map(p => p.id), ["a", "b"])
})

test("points on a line are visited end to end", () => {
  const pts = [P(30, 0, "d"), P(0, 0, "a"), P(20, 0, "c"), P(10, 0, "b")]
  const ids = tour(pts).map(p => p.id).join("")
  assert.ok(ids === "abcd" || ids === "dcba", ids)
})

test("a zigzag is untangled", () => {
  // a square walked in a crossing order is longer than going round it
  const pts = [P(0, 0, "a"), P(10, 10, "c"), P(10, 0, "b"), P(0, 10, "d")]
  assert.ok(pathLength(tour(pts)) <= 30 + 1e-9)
})

test("every point appears once", () => {
  const pts = Array.from({ length: 40 }, (_, i) => P((i * 37) % 101, (i * 53) % 97, `p${i}`))
  const out = tour(pts)
  assert.equal(out.length, 40)
  assert.equal(new Set(out.map(p => p.id)).size, 40)
  assert.ok(pathLength(out) < pathLength(pts))
})
