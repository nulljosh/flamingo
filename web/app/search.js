// Search over places, regions, missions and collectibles. Pure functions so the tests (tests/search.test.mjs) and the
// Swift port (apple/Shared/Search.swift) can agree on the same ranking.

export const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’`]/g, "").replace(/[^a-z0-9$]+/g, " ").trim()

// Score one text against the query: whole name first, then the start of a word, then anywhere. 0 is no match.
export function score(text, q) {
  const t = norm(text)
  if (!t || !q) return 0
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  if ((" " + t).includes(" " + q)) return 60
  if (t.includes(q)) return 40
  // every query word starts a word in the text, in any order
  const words = q.split(" "), tw = t.split(" ")
  if (words.length > 1 && words.every(w => tw.some(x => x.startsWith(w)))) return 30
  return 0
}

// Returns [{kind, item, score}] best first. Mission names only match when spoilers are on.
export function search(data, query, { spoilers = false, limit = 60 } = {}) {
  const q = norm(query)
  if (!q) return []
  const cats = Object.fromEntries(data.categories.map(c => [c.id, c]))
  const regs = Object.fromEntries(data.regions.map(r => [r.id, r]))
  const out = []
  for (const p of data.places) {
    let s = score(p.name, q)
    if (!s) s = Math.max(score(cats[p.cat]?.one, q), score(cats[p.cat]?.name, q)) * .5
    if (!s) s = score(regs[p.region]?.name, q) * .4
    if (!s) s = score(p.note, q) * .3
    if (s) out.push({ kind: "place", item: p, score: s + (p.x != null ? 1 : 0) + (p.cat === "district" ? 2 : 0) })
  }
  for (const r of data.regions) {
    const s = Math.max(score(r.name, q), score(r.short, q))
    if (s) out.push({ kind: "region", item: r, score: s + 5 })
  }
  for (const m of data.missions) {
    let s = spoilers && m.name ? score(m.name, q) : 0
    if (!s) s = score(`chapter ${m.chapter} mission ${m.n}`, q) * .6
    if (!s && spoilers) s = score(m.chapterTitle, q) * .3
    if (s) out.push({ kind: "mission", item: m, score: s })
  }
  for (const c of data.collectibles) {
    const s = score(c.name, q)
    if (s) out.push({ kind: "collectible", item: c, score: s })
  }
  return out.sort((a, b) => b.score - a.score || (a.item.name || "").localeCompare(b.item.name || "")).slice(0, limit)
}
