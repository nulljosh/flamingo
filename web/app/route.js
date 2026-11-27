// Shortest-path ordering for a run through a set of pins: nearest neighbour from every start, then 2-opt.
// An open path (you don't need to come back), on the map plane. Pure, so the tests and both apps agree.
// Swift twin: apple/Flamingo/Route.swift.

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

export function pathLength(pts) {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += d(pts[i - 1], pts[i])
  return s
}

function nearest(pts, start) {
  const left = pts.map((_, i) => i).filter(i => i !== start), out = [start]
  while (left.length) {
    const last = pts[out[out.length - 1]]
    let bi = 0
    for (let k = 1; k < left.length; k++) if (d(last, pts[left[k]]) < d(last, pts[left[bi]])) bi = k
    out.push(left.splice(bi, 1)[0])
  }
  return out
}

// 2-opt on an open path: reverse any stretch that makes the path shorter, until nothing does
function twoOpt(pts, order) {
  const o = order.slice(), n = o.length
  let better = true
  while (better) {
    better = false
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = i > 0 ? pts[o[i - 1]] : null, b = pts[o[i]], c = pts[o[j]], e = j < n - 1 ? pts[o[j + 1]] : null
        const before = (a ? d(a, b) : 0) + (e ? d(c, e) : 0), after = (a ? d(a, c) : 0) + (e ? d(b, e) : 0)
        if (after < before - 1e-9) { o.splice(i, j - i + 1, ...o.slice(i, j + 1).reverse()); better = true }
      }
    }
  }
  return o
}

// pts: [{x, y, ...}] -> the same objects, in route order
export function tour(pts) {
  if (pts.length < 3) return pts.slice()
  let best = null, bestLen = Infinity
  for (let s = 0; s < pts.length; s++) {
    const o = nearest(pts, s), len = pathLength(o.map(i => pts[i]))
    if (len < bestLen) { best = o; bestLen = len }
  }
  return twoOpt(pts, best).map(i => pts[i])
}
