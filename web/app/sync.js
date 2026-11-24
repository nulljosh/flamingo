// Account sync for progress. Pure, so tests/search.test.mjs covers it.
// The first time a device links to an account, nothing is lost: visited places and done missions are unioned (earliest
// time wins), collectible counts take the higher number, and the save % takes whichever is set. After that the newer
// side wins: a device with unsynced changes pushes them; a clean device takes the account's copy.
export function union(a = {}, b = {}) {
  const pick = (x = {}, y = {}) => { const o = { ...x }; for (const k in y) o[k] = o[k] ? Math.min(o[k], y[k]) : y[k]; return o }
  const found = { ...(a.found || {}) }
  for (const k in b.found || {}) found[k] = Math.max(found[k] || 0, b.found[k])
  // your pins: union by id; where both have the same pin, this side's edit wins
  const pins = [...(a.pins || []), ...(b.pins || []).filter(p => !(a.pins || []).some(q => q.id === p.id))]
  return { visited: pick(a.visited, b.visited), done: pick(a.done, b.done), found, savePct: a.savePct || b.savePct || "", fav: pick(a.fav, b.fav), pins }
}
// local: { visited, done, found, savePct, dirty, linked }   remote: a flamingo_progress row or null
// returns { take: "local" | "remote" | "union", progress, push }
export function reconcile(local, remote) {
  const mine = { visited: local.visited || {}, done: local.done || {}, found: local.found || {}, savePct: local.savePct || "", fav: local.fav || {}, pins: local.pins || [] }
  if (!remote) return { take: "local", progress: mine, push: true }
  const theirs = { visited: remote.visited || {}, done: remote.done || {}, found: remote.found || {}, savePct: remote.save_pct || "", fav: remote.fav || {}, pins: remote.pins || [] }
  if (!local.linked) return { take: "union", progress: union(mine, theirs), push: true }
  if (local.dirty) return { take: "local", progress: mine, push: true }
  return { take: "remote", progress: theirs, push: false }
}
export const toRow = (id, p) => ({ id, visited: p.visited, done: p.done, found: p.found, save_pct: p.savePct || null, fav: p.fav || {}, pins: p.pins || [] })
