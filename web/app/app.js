// Flamingo: a map of Leonida. One data file (data/leonida.json), drawn as SVG, with pins as HTML so they stay one size
// at any zoom. Two tabs (Map, Settings), a search button, and one sheet that shows search, a place, or a list.
import { search, norm } from "./search.js"
import { estimate, missionsDone, STORY_SHARE } from "./story.js"
import { createClient } from "./spark.js"
import { reconcile, toRow } from "./sync.js"

const $ = s => document.querySelector(s)
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const icon = id => `<svg class="i"><use href="#i-${id}"/></svg>`
const NS = "http://www.w3.org/2000/svg"

const data = await (await fetch("../data/leonida.json")).json()
const cat = Object.fromEntries(data.categories.map(c => [c.id, c]))
const region = Object.fromEntries(data.regions.map(r => [r.id, r]))
const place = Object.fromEntries(data.places.map(p => [p.id, p]))
const mission = Object.fromEntries(data.missions.map(m => [m.id, m]))
const coll = Object.fromEntries(data.collectibles.map(c => [c.id, c]))
const pinned = data.places.filter(p => p.x != null)
const mapCats = data.categories.filter(c => pinned.some(p => p.cat === c.id))

// ---------- settings and progress, kept on this device ----------
const VERSION = "1.6.0"
let hits = null   // place ids matching the search, shown as lettered pins while the search is open
const KEY = "flamingo.v1"
const DEF = { fav: {}, pins: [], recentQ: [], recentP: [], hinted: false, savePct: "", theme: "system", labels: true, regions: false, cluster: true, spoilers: false, hideVisited: false, hidden: [], visited: {}, done: {}, found: {} }
const st = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || "{}") } } catch { return { ...DEF } } })()
const save = (progress = true) => { if (progress && acct.user) { st.dirty = true; schedulePush() } try { localStorage.setItem(KEY, JSON.stringify(st)) } catch {} }

// ---------- accounts: sign in with email to keep progress on every device (api.jaybulb.com, table flamingo_progress) ----------
// ?api=http://localhost:8787 points a QA run at a local API; any other host is ignored, so a link can't send tokens elsewhere
const apiParam = (() => { try { const u = new URL(new URLSearchParams(location.search).get("api")); return ["localhost", "127.0.0.1"].includes(u.hostname) ? u.origin : null } catch { return null } })()
const sb = createClient(apiParam || "https://api.jaybulb.com")
const acct = { user: null, mode: "out", msg: "", busy: false, syncedAt: 0 }
let pushTimer = 0
function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(pushProgress, 1500) }
async function pushProgress() {
  if (!acct.user) return
  const { error } = await sb.from("flamingo_progress").upsert(toRow(acct.user.id, { visited: st.visited, done: st.done, found: st.found, savePct: st.savePct, fav: st.fav, pins: st.pins }), { onConflict: "id" })
  if (!error) { st.dirty = false; st.linked = true; acct.syncedAt = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(st)) } catch {} ; refreshAcct() }
}
async function pullProgress() {
  if (!acct.user) return
  const { data, error } = await sb.from("flamingo_progress").select("*")
  if (error) return
  const r = reconcile(st, data?.[0] || null)
  Object.assign(st, { visited: r.progress.visited, done: r.progress.done, found: r.progress.found, savePct: r.progress.savePct, fav: r.progress.fav, pins: r.progress.pins })
  if (r.push) { st.dirty = true; await pushProgress() } else { st.linked = true; acct.syncedAt = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(st)) } catch {} }
  queue(); refreshAcct()
  if (document.body.classList.contains("on-story")) drawStory()
}
function refreshAcct() { if (document.body.classList.contains("on-settings")) drawSettings() }
sb.auth.onAuthStateChange((event, session) => {
  acct.user = session?.user || null
  if (event === "PASSWORD_RECOVERY") { acct.mode = "reset"; setTab("settings") }
  else acct.mode = acct.user ? "in" : (acct.mode === "form" ? "form" : "out")
  if (acct.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) pullProgress()
  if (!acct.user) { st.linked = false; st.dirty = false }
  refreshAcct()
})
addEventListener("focus", () => acct.user && !st.dirty && pullProgress())
function acctHTML() {
  const m = acct.msg ? `<p class="acct-msg">${esc(acct.msg)}</p>` : ""
  if (acct.mode === "in") {
    const ago = acct.syncedAt ? Math.max(0, Math.round((Date.now() - acct.syncedAt) / 60000)) : null
    return `<div class="row"><span class="ic" style="--c:var(--pink)">${icon("people")}</span><span class="t"><b>${esc(acct.user.email)}</b><small>${st.dirty ? "Syncing…" : ago == null ? "Signed in" : ago < 1 ? "Synced just now" : `Synced ${ago} min ago`}</small></span></div>
      <button class="row link" id="acSync"><span class="t"><b>Sync now</b></span></button>
      <button class="row link" id="acOut"><span class="t"><b>Sign out</b></span></button>
      <button class="row danger" id="acDel"><span class="t"><b>Delete account</b></span></button>${m}`
  }
  if (acct.mode === "form" || acct.mode === "reset") {
    const reset = acct.mode === "reset"
    return `<form class="acct-form" id="acForm">
      ${reset ? "" : `<input id="acEmail" type="email" autocomplete="email" placeholder="Email" required>`}
      <input id="acPass" type="password" autocomplete="${reset ? "new-password" : "current-password"}" placeholder="${reset ? "New password" : "Password"}" minlength="8" required>
      <div class="acct-btns">${reset ? `<button class="act on wide" type="submit" data-do="reset">Set new password</button>` : `<button class="act on" type="submit" data-do="in">Sign in</button><button class="act" type="submit" data-do="up">Create account</button>`}</div>
      ${reset ? "" : `<button class="acct-link" type="button" id="acForgot">Forgot password?</button>`}${m}</form>`
  }
  return `<button class="row" id="acOpen"><span class="ic" style="--c:var(--pink)">${icon("people")}</span><span class="t"><b>Sign in or create an account</b><small>Keep your progress on every device</small></span>${icon("chev").replace('class="i"', 'class="i chev"')}</button>${m}`
}
function wireAcct(root) {
  const set = (o) => { Object.assign(acct, o); drawSettings() }
  root.querySelector("#acOpen")?.addEventListener("click", () => set({ mode: "form", msg: "" }))
  root.querySelector("#acSync")?.addEventListener("click", () => { st.dirty ? pushProgress() : pullProgress() })
  root.querySelector("#acOut")?.addEventListener("click", async () => { await sb.auth.signOut(); set({ mode: "out", msg: "Signed out. Your progress stays on this device." }) })
  const del = root.querySelector("#acDel")
  del?.addEventListener("click", async () => {
    if (!del.dataset.armed) { del.dataset.armed = 1; del.querySelector("b").textContent = "Tap again to delete your account"; return }
    const { error } = await sb.auth.deleteAccount(); set({ mode: "out", msg: error ? error.message : "Account deleted. Your progress stays on this device." })
  })
  root.querySelector("#acForgot")?.addEventListener("click", async () => {
    const email = root.querySelector("#acEmail").value.trim(); if (!email) return set({ msg: "Type your email first." })
    await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/app/#settings` }); set({ msg: "If that email has an account, a reset link is on its way." })
  })
  const form = root.querySelector("#acForm")
  form?.addEventListener("submit", async e => {
    e.preventDefault(); const what = e.submitter?.dataset.do || "in"
    const email = root.querySelector("#acEmail")?.value.trim(), password = root.querySelector("#acPass").value
    form.querySelectorAll("button").forEach(b => b.disabled = true)
    let r
    if (what === "in") r = await sb.auth.signInWithPassword({ email, password })
    else if (what === "up") r = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/app/#settings` } })
    else r = await sb.auth.updateUser({ password })
    if (r.error) return set({ msg: r.error.message || "That didn't work. Try again." })
    if (what === "up") return set({ mode: "form", msg: "Check your email to confirm, then sign in here." })
    set({ mode: "in", msg: what === "reset" ? "Password changed." : "" })
  })
}
const dark = matchMedia("(prefers-color-scheme: dark)")
const applyTheme = () => { document.documentElement.dataset.theme = st.theme === "system" ? (dark.matches ? "dark" : "light") : st.theme }
dark.addEventListener("change", applyTheme); applyTheme()

// ---------- geometry: smooth polygons the same way every app does (Catmull-Rom to cubic Bézier) ----------
function smooth(pts, closed = true, t = .5) {
  const n = pts.length, P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2)
    const c1 = [p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3]
    const c2 = [p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3]
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return closed ? d + "Z" : d
}
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.appendChild(e); return e }

function drawWorld() {
  const w = $("#world"), m = data.map
  const defs = el("defs", {}, w)
  const clip = el("clipPath", { id: "landclip" }, defs)
  const landD = smooth(m.land), islandD = m.islands.map(i => smooth(i.pts)).join("")
  el("path", { d: landD + islandD }, clip)
  m.keys.forEach(([cx, cy, rx, ry, r]) => el("ellipse", { cx, cy, rx, ry, transform: `rotate(${r} ${cx} ${cy})` }, clip))
  // terrain patterns: forest dots in the park, marsh ticks in the Grassrivers
  const forest = el("pattern", { id: "forest", width: 14, height: 14, patternUnits: "userSpaceOnUse" }, defs)
  el("circle", { cx: 4, cy: 4, r: 1.6, fill: "#34c759", opacity: .35 }, forest); el("circle", { cx: 11, cy: 10, r: 1.3, fill: "#34c759", opacity: .3 }, forest)
  const marsh = el("pattern", { id: "marsh", width: 16, height: 12, patternUnits: "userSpaceOnUse" }, defs)
  el("path", { d: "M2 8h5M10 3h4", stroke: "#00a29a", "stroke-width": 1, opacity: .4, "stroke-linecap": "round" }, marsh)

  el("path", { class: "shore", d: landD + islandD }, w)
  el("path", { class: "land", d: landD }, w)
  m.islands.forEach(i => el("path", { class: "land", d: smooth(i.pts) }, w))
  m.keys.forEach(([cx, cy, rx, ry, r]) => el("ellipse", { class: "land", cx, cy, rx, ry, transform: `rotate(${r} ${cx} ${cy})` }, w))
  const tint = el("g", { "clip-path": "url(#landclip)" }, w)
  // land cover: forest in the park, wetland in the Grassrivers, farmland round the lake, city grey in Vice City
  const cover = { "mount-kalaga": "forest", grassrivers: "wetland", ambrosia: "farm", "vice-city": "city" }
  data.regions.forEach(r => cover[r.id] && el("polygon", { class: `cover ${cover[r.id]}`, points: r.poly.join(" ") }, tint))
  data.regions.forEach(r => el("polygon", { class: "region", points: r.poly.join(" "), fill: r.color }, tint))
  el("polygon", { class: "terrain", points: region["mount-kalaga"].poly.join(" "), fill: "url(#forest)" }, tint)
  el("polygon", { class: "terrain", points: region.grassrivers.poly.join(" "), fill: "url(#marsh)" }, tint)
  // built-up areas around the towns
  ;[[812, 830, 70, 90], [170, 390, 46, 38], [660, 568, 36, 28], [316, 770, 22, 18], [482, 704, 22, 16]].forEach(([cx, cy, rx, ry]) => el("ellipse", { class: "urban", cx, cy, rx, ry, opacity: .9 }, tint))
  data.regions.forEach(r => r.id !== "leonida-keys" && el("polyline", { class: "region-edge", points: r.poly.filter(([x, y]) => x > 0 && x < 1000 && y > 0 && y < 1000).join(" ") }, tint))
  const streets = el("g", { "clip-path": "url(#landclip)" }, w)
  ;[[812, 830, 70, 90, 9], [170, 390, 46, 38, 8], [660, 568, 36, 28, 7], [316, 770, 22, 18, 6], [482, 704, 22, 16, 6]].forEach(([cx, cy, rx, ry, step], i) => {
    const id = `town${i}`, c = el("clipPath", { id }, defs); el("ellipse", { cx, cy, rx, ry }, c)
    const g = el("g", { "clip-path": `url(#${id})` }, streets); let d = ""
    for (let x = cx - rx; x <= cx + rx; x += step) d += `M${x},${cy - ry}L${x + ry * .12},${cy + ry}`
    for (let y = cy - ry; y <= cy + ry; y += step) d += `M${cx - rx},${y}L${cx + rx},${y - rx * .06}`
    el("path", { class: "street", d }, g)
  })
  m.lakes.forEach(l => el("ellipse", { class: "lake", cx: l.cx, cy: l.cy, rx: l.rx, ry: l.ry }, w))
  const roads = el("g", {}, w)
  m.roads.forEach(r => el("path", { class: "road-edge", d: smooth(r.pts, false) }, roads))
  m.roads.forEach(r => el("path", { class: "road", d: smooth(r.pts, false) }, roads))
}

// ---------- the view: scale and translate, pan, pinch, wheel, fling ----------
const mapEl = $("#map"), world = $("#world")
const view = { s: 1, x: 0, y: 0 }
let fitS = 1
const size = () => ({ w: mapEl.clientWidth, h: mapEl.clientHeight })
// the land's bounds, Keys included, so the fit fills the screen with land rather than sea
const B = (() => { const pts = [...data.map.land, ...data.map.keys.map(k => [k[0], k[1]])]; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return { x0: Math.min(...xs) - 20, y0: Math.min(...ys) - 20, x1: Math.max(...xs) + 20, y1: Math.max(...ys) + 30 } })()
function fitView(pad = { t: 64, b: 104, l: 8, r: 8 }) {
  const { w, h } = size(), bw = B.x1 - B.x0, bh = B.y1 - B.y0
  const wide = w >= 900 && document.body.classList.contains("sheet-open")
  const L = wide ? 410 : pad.l
  const s = Math.min((w - L - pad.r) / bw, (h - pad.t - pad.b) / bh)
  return { s, x: L + (w - L - pad.r - bw * s) / 2 - B.x0 * s, y: pad.t + (h - pad.t - pad.b - bh * s) / 2 - B.y0 * s }
}
function clamp(v) {
  const { w, h } = size(), [W, H] = data.size
  v.s = Math.min(Math.max(v.s, fitS * .7), fitS * 14)
  // the map may slide until its edge reaches a fifth of the screen, so pins near the coast can clear the sheet
  v.x = Math.min(Math.max(v.x, w * .2 - W * v.s), w * .8)
  v.y = Math.min(Math.max(v.y, h * .2 - H * v.s), h * .8)
  return v
}
let raf = 0
const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render() }) }
function setView(v) { Object.assign(view, clamp({ ...view, ...v })); queue() }
let anim = 0
function animateTo(t, ms = 420) {
  cancelAnimationFrame(anim)
  const from = { ...view }, to = clamp({ ...view, ...t }), t0 = performance.now()
  const ease = k => 1 - Math.pow(1 - k, 3)
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = ease(k)
    // zoom in log space so it feels even
    const s = Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * e)
    // keep the world point under the centre moving in a straight line
    const { w, h } = size()
    const cx0 = (w / 2 - from.x) / from.s, cy0 = (h / 2 - from.y) / from.s, cx1 = (w / 2 - to.x) / to.s, cy1 = (h / 2 - to.y) / to.s
    const cx = cx0 + (cx1 - cx0) * e, cy = cy0 + (cy1 - cy0) * e
    Object.assign(view, { s, x: w / 2 - cx * s, y: h / 2 - cy * s }); render()
    if (k < 1) anim = requestAnimationFrame(step)
  }
  anim = requestAnimationFrame(step)
}
function zoomAt(f, px, py, animate = false) {
  const s = Math.min(Math.max(view.s * f, fitS * .7), fitS * 14), k = s / view.s
  const t = { s, x: px - (px - view.x) * k, y: py - (py - view.y) * k }
  animate ? animateTo(t, 280) : setView(t)
}
// centre a world point, leaving room for the sheet
function focus(x, y, s = Math.max(view.s, fitS * 3.2)) {
  const { w, h } = size(), wide = w >= 900
  const cx = wide ? 410 + (w - 410) / 2 : w / 2
  const cy = wide ? h / 2 : Math.min(h * .32, h - sheetH() - 80)
  animateTo({ s, x: cx - x * s, y: cy - y * s })
}
const sheetH = () => sheet.classList.contains("open") ? sheet.offsetHeight : 0

const ptrs = new Map()
let gesture = null, moved = false, vel = { x: 0, y: 0, t: 0 }
mapEl.addEventListener("pointerdown", e => {
  if (e.target.closest(".pin, .cluster, .rcard")) return
  cancelAnimationFrame(anim); cancelAnimationFrame(fling)
  mapEl.setPointerCapture(e.pointerId)
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
  moved = false; startGesture()
  clearTimeout(pressTimer)
  if (ptrs.size === 1) pressTimer = setTimeout(() => { if (!moved && ptrs.size === 1) { pressed = true; dropPin(e.clientX, e.clientY) } }, 550)
})
let pressTimer = 0, pressed = false
mapEl.addEventListener("contextmenu", e => { e.preventDefault(); dropPin(e.clientX, e.clientY) })
// your own pin, where you pressed: kept in st.pins (and synced with an account)
function dropPin(cx, cy) {
  const x = Math.round((cx - view.x) / view.s), y = Math.round((cy - view.y) / view.s)
  const pin = { id: `u${Date.now().toString(36)}`, name: "My pin", note: "", x, y, at: Date.now() }
  st.pins = [...(st.pins || []), pin]; save(); queue()
  navigator.vibrate?.(10)
  stack.length = 0; push({ type: "pin", id: pin.id, fresh: true })
  focus(x, y, view.s)   // keep the new pin above its sheet
}
function startGesture() {
  const p = [...ptrs.values()]
  if (p.length === 1) gesture = { kind: "pan", x0: p[0].x, y0: p[0].y, vx: view.x, vy: view.y }
  else if (p.length >= 2) {
    const [a, b] = p, d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
    gesture = { kind: "pinch", d0: d, cx0: cx, cy0: cy, v: { ...view } }
  }
}
mapEl.addEventListener("pointermove", e => {
  if (!ptrs.has(e.pointerId)) return
  const prev = ptrs.get(e.pointerId)
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
  const p = [...ptrs.values()]
  if (gesture?.kind === "pan" && p.length === 1) {
    const dx = p[0].x - gesture.x0, dy = p[0].y - gesture.y0
    if (Math.hypot(dx, dy) > 6) clearTimeout(pressTimer)
    if (Math.hypot(dx, dy) > 4) { moved = true; mapEl.classList.add("drag") }
    const now = performance.now(), dt = Math.max(1, now - vel.t)
    vel = { x: (e.clientX - prev.x) / dt, y: (e.clientY - prev.y) / dt, t: now }
    setView({ x: gesture.vx + dx, y: gesture.vy + dy })
  } else if (gesture?.kind === "pinch" && p.length >= 2) {
    moved = true
    const [a, b] = p, d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
    const g = gesture.v, s = Math.min(Math.max(g.s * d / gesture.d0, fitS * .7), fitS * 14), k = s / g.s
    setView({ s, x: cx - (gesture.cx0 - g.x) * k, y: cy - (gesture.cy0 - g.y) * k })
  }
})
let fling = 0, lastTap = 0
const end = e => {
  if (!ptrs.has(e.pointerId)) return
  clearTimeout(pressTimer)
  if (pressed) { pressed = false; ptrs.delete(e.pointerId); gesture = null; return }
  ptrs.delete(e.pointerId); mapEl.classList.remove("drag")
  if (ptrs.size) { startGesture(); return }
  if (gesture?.kind === "pan" && moved && performance.now() - vel.t < 60) {
    let vx = vel.x * 16, vy = vel.y * 16
    const step = () => { vx *= .93; vy *= .93; setView({ x: view.x + vx, y: view.y + vy }); if (Math.hypot(vx, vy) > .4) fling = requestAnimationFrame(step) }
    fling = requestAnimationFrame(step)
  }
  if (!moved && e.type === "pointerup") {
    const now = performance.now()
    if (now - lastTap < 300) { zoomAt(2, e.clientX, e.clientY, true); lastTap = 0 }
    else { lastTap = now; if (top()?.type === "place" || top()?.type === "list") closeSheet() }
  }
  gesture = null
}
mapEl.addEventListener("pointerup", end); mapEl.addEventListener("pointercancel", end)
mapEl.addEventListener("wheel", e => {
  e.preventDefault(); cancelAnimationFrame(anim)
  const mouseWheel = e.deltaMode !== 0 || (!e.deltaX && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50)
  if (e.ctrlKey || mouseWheel) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0022)), e.clientX, e.clientY)
  else setView({ x: view.x - e.deltaX, y: view.y - e.deltaY })
}, { passive: false })
addEventListener("keydown", e => {
  if (document.body.classList.contains("on-page") || e.target.closest("input")) return
  const { w, h } = size()
  if (e.key === "+" || e.key === "=") zoomAt(1.6, w / 2, h / 2, true)
  else if (e.key === "-") zoomAt(1 / 1.6, w / 2, h / 2, true)
  else if (e.key === "/" ) { e.preventDefault(); openSearch() }
  else if (e.key === "Escape") closeSheet()
  else if (e.key.startsWith("Arrow")) { const d = 80; animateTo({ x: view.x + (e.key === "ArrowLeft" ? d : e.key === "ArrowRight" ? -d : 0), y: view.y + (e.key === "ArrowUp" ? d : e.key === "ArrowDown" ? -d : 0) }, 200) }
})
$("#zin").onclick = () => { const { w, h } = size(); zoomAt(1.8, w / 2, h / 2, true) }
$("#zout").onclick = () => { const { w, h } = size(); zoomAt(1 / 1.8, w / 2, h / 2, true) }
$("#fit").onclick = () => animateTo(fitView())

// ---------- pins, clusters and labels ----------
const MYPIN = { id: "mypin", name: "My pins", one: "My pin", color: "#ff3d8b", symbol: "mappin" }
cat.mypin = MYPIN
const myPins = () => (st.pins || []).map(p => ({ ...p, cat: "mypin", region: null, tag: "mine", mine: true }))
let filter = null // a category id from the chips, or null for everything
let selected = null
const pinEls = new Map(), labelEls = new Map(), clusterPool = []
const rlabels = data.regions.map(r => {
  const d = document.createElement("div"); d.className = "rlabel"; d.textContent = r.short; $("#rlabels").appendChild(d)
  const items = pinned.filter(p => p.region === r.id && p.cat !== "people" && p.cat !== "vehicle")
  const c = document.createElement("button"); c.className = "rcard glass"; c.style.setProperty("--c", r.color)
  c.innerHTML = `${esc(r.short)}<span class="n">${items.length}</span>`; c.setAttribute("aria-label", `${r.name}, ${items.length} places. Zoom in.`)
  c.onclick = e => { e.stopPropagation(); zoomToItems(items) }
  $("#pins").appendChild(c)
  return { r, d, c }
})
const OVERVIEW = 1.45
const PRIORITY = ["mypin", "district", "safehouse", "landmark", "race", "store", "business", "activity", "transport", "nature", "weapons", "waink", "meditation", "vehicle", "people"]
const prio = p => PRIORITY.indexOf(p.cat)
function visible(p) {
  if (p.id === selected) return true
  if (hits) return hits.includes(p.id)
  if (filter) return p.cat === filter
  if (st.hidden.includes(p.cat)) return false
  if (st.hideVisited && st.visited[p.id]) return false
  // people and vehicles sit on top of their place; only show them when asked for
  if (p.cat === "people" || p.cat === "vehicle") return false
  return true
}
function pinEl(p) {
  let b = pinEls.get(p.id)
  if (!b) {
    b = document.createElement("button"); b.className = "pin drop"; b.style.setProperty("--c", cat[p.cat].color)
    b.setAttribute("aria-label", `${p.name}, ${cat[p.cat].one}`); b.innerHTML = icon(p.mine ? "pin" : p.cat)
    if (p.mine) b.classList.add("mine")
    b.onclick = e => { e.stopPropagation(); p.mine ? (stack.length = 0, push({ type: "pin", id: p.id })) : openPlace(p.id, { fromMap: true }) }
    $("#pins").appendChild(b); pinEls.set(p.id, b)
  }
  return b
}
function labelEl(p) {
  let l = labelEls.get(p.id)
  if (!l) { l = document.createElement("div"); l.className = "plabel" + (p.cat === "district" ? " district" : ""); l.textContent = p.name; $("#plabels").appendChild(l); labelEls.set(p.id, l) }
  return l
}
function render() {
  world.setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.s})`)
  const z = view.s / fitS
  // zoomed out: one card per region instead of a cloud of pins
  const overview = z < OVERVIEW && !filter && !selected && !hits
  mapEl.classList.toggle("streets-on", z > 3)
  for (const { r, d, c } of rlabels) {
    const t = `translate(${view.x + r.label[0] * view.s}px, ${view.y + r.label[1] * view.s}px) translate(-50%, -50%)`
    d.style.transform = t; c.style.transform = t
    d.classList.toggle("hide", overview || z > 3.4); c.classList.toggle("hide", !overview)
  }
  const list = overview ? [] : [...pinned.filter(visible), ...myPins().filter(p => p.id === selected || (filter ? filter === "mypin" : !hits && !st.hidden.includes("mypin")))].sort((a, b) => prio(a) - prio(b))
  const pos = p => [view.x + p.x * view.s, view.y + p.y * view.s]
  // group pins that would overlap; the selected pin always stands alone
  const groups = []
  for (const p of list) {
    const [x, y] = pos(p)
    const g = st.cluster && !hits && p.id !== selected && groups.find(g => !g.sel && Math.abs(g.x - x) < 30 && Math.abs(g.y - y) < 30)
    if (g) g.items.push(p); else groups.push({ x, y, items: [p], sel: p.id === selected })
  }
  const shown = new Set(), labels = [], boxesPins = []
  let ci = 0
  for (const g of groups) {
    if (g.items.length === 1) {
      const p = g.items[0], b = pinEl(p); shown.add(p.id)
      b.style.transform = `translate3d(${g.x}px, ${g.y}px, 0)`
      b.classList.toggle("sel", p.id === selected); b.classList.toggle("visited", !!st.visited[p.id])
      const letter = hits ? String.fromCharCode(65 + hits.indexOf(p.id)) : ""
      if (b.dataset.letter !== letter) { b.dataset.letter = letter; b.classList.toggle("lettered", !!letter) }
      b.hidden = false; boxesPins.push([g.x - 16, g.y - 16, g.x + 16, g.y + 16])
      if (st.labels && (z > 2.2 || p.cat === "district" && z > 1.35 || p.id === selected)) labels.push({ p, x: g.x, y: g.y })
    } else {
      let c = clusterPool[ci]
      if (!c) {
        c = document.createElement("button"); c.className = "cluster"; c.innerHTML = "<span></span>"
        c.onclick = e => { e.stopPropagation(); zoomToItems(c._items) }
        $("#pins").appendChild(c); clusterPool.push(c)
      }
      ci++
      const top = g.items[0]
      c._items = g.items; c.hidden = false; c.classList.toggle("big", g.items.length > 9)
      boxesPins.push([g.x - 20, g.y - 20, g.x + 20, g.y + 20])
      c.style.setProperty("--c", cat[top.cat].color)
      c.style.transform = `translate3d(${g.x}px, ${g.y}px, 0)`
      c.querySelector("span").textContent = g.items.length
      c.setAttribute("aria-label", `${g.items.length} places near ${top.name}. Zoom in.`)
    }
  }
  for (; ci < clusterPool.length; ci++) clusterPool[ci].hidden = true
  for (const [id, b] of pinEls) if (!shown.has(id)) b.hidden = true
  // labels right of their pin, skipped where they would collide
  const boxes = [], used = new Set()
  const overlapsPin = (box, own) => boxesPins.some(b => !(own && b[0] === own[0] && b[1] === own[1]) && box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])
  labels.sort((a, b) => (b.p.id === selected) - (a.p.id === selected) || prio(a.p) - prio(b.p))
  for (const { p, x, y } of labels) {
    const l = labelEl(p), w = (l._w ||= p.name.length * (p.cat === "district" ? 7.6 : 7) + 4)
    const box = [x + 20, y - 9, x + 20 + w, y + 9]
    if (boxes.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) || overlapsPin(box, [x - 16, y - 16])) continue
    boxes.push(box); used.add(p.id)
    l.style.transform = `translate3d(${x + 21}px, ${y - 9}px, 0)`; l.hidden = false
  }
  for (const [id, l] of labelEls) if (!used.has(id)) l.hidden = true
}
function zoomToItems(items, bottom = 0) {
  items = items.filter(p => p.x != null); if (!items.length) return
  const xs = items.map(p => p.x), ys = items.map(p => p.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const { w, h } = size(), pad = 70, wide = w >= 900 && document.body.classList.contains("sheet-open")
  const L = wide ? 410 : 0, top = 70, avail = h - top - (bottom || 110)
  const s = Math.min((w - L - pad * 2) / Math.max(30, x1 - x0), (avail - pad) / Math.max(30, y1 - y0), fitS * 14)
  animateTo({ s, x: L + (w - L) / 2 - (x0 + x1) / 2 * s, y: top + avail / 2 - (y0 + y1) / 2 * s })
}

// ---------- category chips ----------
const CHIPS = ["safehouse", "store", "business", "activity", "landmark", "race", "nature", "waink", "weapons", "transport", "vehicle", "people"]
function drawChips() {
  const c = $("#chips")
  c.innerHTML = `<button class="chip all glass${filter ? "" : " on"}" data-c="">All</button>` +
    CHIPS.filter(id => cat[id] && pinned.some(p => p.cat === id)).map(id => `<button class="chip glass${filter === id ? " on" : ""}" data-c="${id}" style="--c:${cat[id].color}">${icon(id)}${esc(cat[id].name.split(" &")[0].split(",")[0])}</button>`).join("")
  c.querySelectorAll(".chip").forEach(b => b.onclick = () => setFilter(b.dataset.c || null))
}
function setFilter(id) {
  filter = id === filter ? null : id; drawChips(); queue()
  if (filter) { const items = pinned.filter(p => p.cat === filter); if (items.length) zoomToItems(items) }
}

// ---------- the sheet ----------
const sheet = $("#sheet"), head = $("#sheetHead"), body = $("#sheetBody")
const stack = []
const top = () => stack[stack.length - 1]
function push(v) { stack.push(v); showSheet() }
function closeSheet() {
  stack.length = 0; selected = null; hits = null; sheet.classList.remove("peek"); sheet.classList.remove("open", "full"); document.body.classList.remove("sheet-open")
  history.replaceState(null, "", location.pathname + location.search); queue()
}
function back() { stack.pop(); stack.length ? showSheet() : closeSheet() }
function showSheet() {
  const v = top()
  sheet.classList.add("open"); document.body.classList.add("sheet-open")
  sheet.classList.toggle("full", v.type === "search" || v.type === "list" || v.type === "layers")
  if (v.type !== "search") { hits = null; sheet.classList.remove("peek") }
  const backBtn = stack.length > 1 ? `<button class="round" id="sBack" aria-label="Back">${icon("back")}</button>` : ""
  const close = `<button class="round" id="sClose" aria-label="Close">${icon("close")}</button>`
  selected = v.type === "place" || v.type === "pin" ? v.id : null
  if (v.type === "search") {
    head.innerHTML = `${backBtn}<label class="field">${icon("search")}<input id="q" type="search" placeholder="Search Leonida" autocomplete="off" spellcheck="false" enterkeyhint="search" value="${esc(v.q || "")}"></label>${close}`
    const q = $("#q"); q.oninput = () => { v.q = q.value; drawSearch(v) }
    q.onfocus = () => sheet.classList.remove("peek")
    q.onkeydown = e => { if (e.key === "Enter" && q.value.trim()) remember("recentQ", q.value.trim(), 6); if (e.key === "Enter" && hits?.length) { q.blur(); showHits() } }
    if (v.focus) { v.focus = false; setTimeout(() => q.focus({ preventScroll: true }), 60) }
    drawSearch(v)
  } else {
    head.innerHTML = `${backBtn}<div style="flex:1"></div>${close}`
    body.scrollTop = 0
    if (v.type === "place") drawPlace(v)
    else if (v.type === "region") drawRegion(v)
    else if (v.type === "mission") drawMission(v)
    else if (v.type === "collectible") drawCollectible(v)
    else if (v.type === "list") drawList(v)
    else if (v.type === "layers") drawLayers(v)
    else if (v.type === "pin") drawPin(v)
  }
  $("#sBack") && ($("#sBack").onclick = back)
  $("#sClose").onclick = closeSheet
  const hash = v.type === "search" ? "" : v.id ? `#${v.type}/${v.id}` : ""
  history.replaceState(null, "", location.pathname + location.search + hash)
  queue()
}
function openSearch() { if (top()?.type === "search") { $("#q")?.focus(); return } stack.length = 0; push({ type: "search", q: "", focus: true }) }
function remember(list, v, n) { st[list] = [v, ...(st[list] || []).filter(x => x !== v)].slice(0, n); save(false) }
function openPlace(id, { fromMap = false } = {}) {
  const p = place[id]; if (!p) return
  const q = top()?.type === "search" && top().q?.trim()
  if (q) remember("recentQ", q, 6)
  remember("recentP", id, 6)
  if (fromMap || top()?.type === "place") stack.length = 0
  push({ type: "place", id })
  if (p.x != null) focus(p.x, p.y)
}
const missionName = m => st.spoilers && m.name ? m.name : m.name ? `Mission ${m.n}` : `Mission ${m.n} (name withheld)`
const chapterName = m => st.spoilers ? `Chapter ${m.chapter}: ${m.chapterTitle}` : `Chapter ${m.chapter}`
const who = m => m.who.length ? m.who.join(" and ") : "Jason or Lucia"
const where = p => [cat[p.cat].one, p.region ? region[p.region].name : "Location not known yet"].join(" · ")
const row = (attrs, ic, color, title, sub, right = icon("chev").replace('class="i"', 'class="i chev"'), sq = false) =>
  `<button class="row" ${attrs}><span class="ic${sq ? " sq" : ""}" style="--c:${color}">${icon(ic)}</span><span class="t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span>${right}</button>`
const placeRow = (p, letter = "") => row(`data-place="${p.id}"`, p.cat, cat[p.cat].color, (letter ? `<span class="letter">${letter}</span>` : "") + esc(p.name), esc(where(p)), st.visited[p.id] ? icon("check").replace('class="i"', 'class="i done"') : undefined)
const pinRow = p => row(`data-pin="${p.id}"`, "pin", "#ff3d8b", esc(p.name), esc(p.note || "Your pin"))
// fold the search sheet down and fit the lettered pins in the map above it
function showHits() {
  if (!hits) return
  const wide = innerWidth >= 900
  if (!wide) sheet.classList.add("peek")
  zoomToItems(hits.map(id => place[id]), wide ? 110 : innerHeight * .4 + 110)
}
const missionRow = m => row(`data-mission="${m.id}"`, "mission", m.heist ? "#ff3d8b" : "#8e8e93", esc(missionName(m)) + (m.heist ? " · Heist" : ""), esc(`${chapterName(m)} · ${who(m)}`), st.done[m.id] ? icon("check").replace('class="i"', 'class="i done"') : undefined)
const collRow = c => row(`data-coll="${c.id}"`, "collectible", "#ff9500", esc(c.name), `${st.found[c.id] || 0} of ${c.total} found`)
function wire(root = body) {
  root.querySelectorAll("[data-place]").forEach(b => b.onclick = () => openPlace(b.dataset.place))
  root.querySelectorAll("[data-pin]").forEach(b => b.onclick = () => { const p = myPins().find(x => x.id === b.dataset.pin); push({ type: "pin", id: b.dataset.pin }); if (p) focus(p.x, p.y) })
  root.querySelectorAll("[data-mission]").forEach(b => b.onclick = () => push({ type: "mission", id: b.dataset.mission }))
  root.querySelectorAll("[data-coll]").forEach(b => b.onclick = () => push({ type: "collectible", id: b.dataset.coll }))
  root.querySelectorAll("[data-region]").forEach(b => b.onclick = () => { push({ type: "region", id: b.dataset.region }); const r = region[b.dataset.region]; zoomToItems(pinned.filter(p => p.region === r.id)) })
  root.querySelectorAll("[data-list]").forEach(b => b.onclick = () => openList(b.dataset.list))
}
function openList(id) {
  push({ type: "list", id })
  if (cat[id] && pinned.some(p => p.cat === id)) { filter = id; drawChips(); zoomToItems(pinned.filter(p => p.cat === id)) }
}
function drawSearch(v) {
  const q = norm(v.q)
  if (!q) {
    const counts = id => id === "mission" ? data.missions.length : id === "collectible" ? data.collectibles.length : data.places.filter(p => p.cat === id).length
    const rp = (st.recentP || []).map(id => place[id]).filter(Boolean), rq = st.recentQ || []
    const favs = Object.keys(st.fav || {}).map(id => place[id]).filter(Boolean), mine = myPins()
    const saved = favs.length || mine.length ? `<p class="sec">Saved</p><div class="group">${favs.map(p => placeRow(p)).join("")}${mine.map(pinRow).join("")}</div>` : ""
    body.innerHTML = saved + (rq.length || rp.length ? `<p class="sec chap">Recents<button class="acct-link" id="clearRecents">Clear</button></p>
      ${rq.length ? `<div class="recent-q">${rq.map(x => `<button class="chip" data-q="${esc(x)}">${icon("search")}${esc(x)}</button>`).join("")}</div>` : ""}
      ${rp.length ? `<div class="group">${rp.map(p => placeRow(p)).join("")}</div>` : ""}` : "") + `<p class="sec">Browse</p><div class="grid">${data.categories.map(c => `<button class="tile" data-list="${c.id}"><span class="ic" style="--c:${c.color}">${icon(c.id)}</span>${esc(c.name.split(" &")[0].split(",")[0])}<small style="color:var(--text2)">${counts(c.id)}</small></button>`).join("")}</div>
      <p class="sec">Regions</p><div class="group">${data.regions.map(r => row(`data-region="${r.id}"`, "region", r.color, esc(r.name), `${data.places.filter(p => p.region === r.id && p.cat !== "people").length} places · ${esc(r.inspiration)}`, undefined, true)).join("")}</div>
      <p class="fine">${esc(data.disclaimer)}</p>`
  } else {
    const res = search(data, v.q, { spoilers: st.spoilers })
    const mineHit = myPins().filter(p => norm(p.name + " " + p.note).includes(norm(v.q)))
    hits = res.filter(r => r.kind === "place" && r.item.x != null).slice(0, 26).map(r => r.item.id)
    if (!hits.length) hits = null
    queue()
    if (!res.length && !mineHit.length) body.innerHTML = `<div class="empty"><b>No results</b>Nothing in Leonida matches “${esc(v.q)}”.${st.spoilers ? "" : "<br>Mission names are hidden. Turn on spoilers in Settings to search them."}</div>`
    else {
      const parts = { region: [], place: [], mission: [], collectible: [] }
      res.forEach(r => parts[r.kind].push(r.item))
      body.innerHTML = [
        mineHit.length && `<p class="sec">Your pins</p><div class="group">${mineHit.map(pinRow).join("")}</div>`,
        hits && `<button class="act wide showmap" id="showHits">${icon("map")}Show ${hits.length} on the map</button>`,
        parts.place.length && `<p class="sec">Places</p><div class="group">${parts.place.map(p => placeRow(p, hits && hits.includes(p.id) ? String.fromCharCode(65 + hits.indexOf(p.id)) : "")).join("")}</div>`,
        parts.region.length && `<p class="sec">Regions</p><div class="group">${parts.region.map(r => row(`data-region="${r.id}"`, "region", r.color, esc(r.name), esc(r.inspiration), undefined, true)).join("")}</div>`,
        parts.mission.length && `<p class="sec">Missions</p><div class="group">${parts.mission.map(missionRow).join("")}</div>`,
        parts.collectible.length && `<p class="sec">Collectibles</p><div class="group">${parts.collectible.map(collRow).join("")}</div>`,
      ].filter(Boolean).join("")
      $("#showHits") && ($("#showHits").onclick = showHits)
    }
  }
  if (!q) {
    hits = null; queue()
    body.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { v.q = b.dataset.q; $("#q").value = v.q; drawSearch(v) })
    $("#clearRecents") && ($("#clearRecents").onclick = () => { st.recentQ = []; st.recentP = []; save(false); drawSearch(v) })
  }
  wire()
}
function drawPlace(v) {
  const p = place[v.id], c = cat[p.cat]
  const here = data.places.filter(o => o.at === p.id)
  const ms = data.missions.filter(m => m.at === p.id)
  const parent = p.at && place[p.at]
  const tagText = { confirmed: "Confirmed by Rockstar", spotted: "Seen in official footage", speculation: "Fan theory" }[p.tag]
  body.innerHTML = `<div class="ph"><span class="ic" style="--c:${c.color}">${icon(p.cat)}</span><div><h2>${esc(p.name)}</h2><p>${esc(where(p))}</p><span class="badge ${p.tag}">${tagText}</span></div></div>
    <p class="note">${esc(p.note)}</p>
    <div class="actions">
      <button class="act${st.visited[p.id] ? " on" : ""}" id="visit">${icon("check")}${st.visited[p.id] ? "Visited" : "Mark visited"}</button>
      <button class="act${st.fav?.[p.id] ? " on" : ""}" id="fav" aria-pressed="${!!st.fav?.[p.id]}">${icon("landmark")}${st.fav?.[p.id] ? "Saved" : "Save"}</button>
      <button class="act" id="share">${icon("share")}Share</button>
    </div>
    ${parent ? `<p class="sec">Found at</p><div class="group">${placeRow(parent)}</div>` : ""}
    ${here.length ? `<p class="sec">Here</p><div class="group">${here.map(placeRow).join("")}</div>` : ""}
    ${ms.length ? `<p class="sec">Missions that start here</p><div class="group">${ms.map(missionRow).join("")}</div>` : ""}
    ${p.region ? `<p class="sec">Region</p><div class="group">${row(`data-region="${p.region}"`, "region", region[p.region].color, esc(region[p.region].name), esc(region[p.region].inspiration), undefined, true)}</div>` : ""}
    <p class="fine">${p.x != null ? "Pin positions are approximate." : "Named in the game, but where it sits isn't known yet."}</p>`
  $("#visit").onclick = () => { st.visited[p.id] ? delete st.visited[p.id] : st.visited[p.id] = Date.now(); save(); drawPlace(v); queue() }
  $("#fav").onclick = () => { st.fav ||= {}; st.fav[p.id] ? delete st.fav[p.id] : st.fav[p.id] = Date.now(); save(); drawPlace(v) }
  $("#share").onclick = async () => {
    const url = `${location.origin}${location.pathname}#place/${p.id}`
    try { if (navigator.share) await navigator.share({ title: p.name, url }); else { await navigator.clipboard.writeText(url); $("#share").lastChild.textContent = "Link copied" } } catch {}
  }
  wire()
}
function drawRegion(v) {
  const r = region[v.id], items = data.places.filter(p => p.region === r.id && p.cat !== "people")
  const seen = items.filter(p => st.visited[p.id]).length
  body.innerHTML = `<div class="ph"><span class="ic" style="--c:${r.color}">${icon("region")}</span><div><h2>${esc(r.name)}</h2><p>Inspired by ${esc(r.inspiration)}</p></div></div>
    <p class="note">${esc(r.blurb)}</p>
    <div class="bar"><i style="width:${items.length ? seen / items.length * 100 : 0}%"></i></div><p class="fine">${seen} of ${items.length} visited</p>
    <p class="sec">Places</p><div class="group">${items.sort((a, b) => prio(a) - prio(b) || a.name.localeCompare(b.name)).map(placeRow).join("")}</div>`
  wire()
}
function drawMission(v) {
  const m = mission[v.id], at = m.at && place[m.at]
  body.innerHTML = `<div class="ph"><span class="ic" style="--c:${m.heist ? "#ff3d8b" : "#8e8e93"}">${icon("mission")}</span><div><h2>${esc(missionName(m))}</h2><p>${esc(chapterName(m))} · Mission ${m.n}</p>${m.heist ? `<span class="badge heist">Heist</span>` : ""}</div></div>
    <p class="note">Played as ${esc(who(m))}.${st.spoilers ? "" : " The name is hidden; turn on spoilers in Settings to see it."}</p>
    <div class="actions"><button class="act wide${st.done[m.id] ? " on" : ""}" id="done">${icon("check")}${st.done[m.id] ? "Done" : "Mark done"}</button></div>
    ${at ? `<p class="sec">Starts at</p><div class="group">${placeRow(at)}</div>` : ""}`
  $("#done").onclick = () => { st.done[m.id] ? delete st.done[m.id] : st.done[m.id] = Date.now(); save(); drawMission(v) }
  wire()
}
function drawCollectible(v) {
  const c = coll[v.id], n = st.found[c.id] || 0
  body.innerHTML = `<div class="ph"><span class="ic" style="--c:#ff9500">${icon("collectible")}</span><div><h2>${esc(c.name)}</h2><p>Collectible · ${c.total} in Leonida</p></div></div>
    <p class="note">${esc(c.note)}</p>
    <div class="stepper"><button class="round" id="dec" aria-label="One fewer">${icon("minus")}</button><div class="num" aria-live="polite">${n}<small> / ${c.total}</small></div><button class="round" id="inc" aria-label="One more">${icon("plus")}</button></div>
    <div class="bar"><i style="width:${n / c.total * 100}%"></i></div>
    <p class="fine">Where each one sits isn't mapped yet. Count them here as you find them.</p>`
  const set = k => { st.found[c.id] = Math.max(0, Math.min(c.total, n + k)); save(); drawCollectible(v) }
  $("#dec").onclick = () => set(-1); $("#inc").onclick = () => set(1)
}
function drawList(v) {
  const c = cat[v.id]
  let rows, n
  if (v.id === "mission") {
    n = data.missions.length
    const done = data.missions.filter(m => st.done[m.id]).length
    rows = `<div class="bar"><i style="width:${done / n * 100}%"></i></div><p class="fine">${done} of ${n} done${st.spoilers ? "" : " · names hidden"}</p>` +
      [1, 2, 3, 4, 5].map(ch => { const ms = data.missions.filter(m => m.chapter === ch); return `<p class="sec">${esc(chapterName(ms[0]))}</p><div class="group">${ms.map(missionRow).join("")}</div>` }).join("")
  } else if (v.id === "collectible") {
    n = data.collectibles.length
    rows = `<div class="group">${data.collectibles.map(collRow).join("")}</div>`
  } else {
    const items = data.places.filter(p => p.cat === v.id).sort((a, b) => a.name.localeCompare(b.name)); n = items.length
    rows = data.regions.map(r => { const g = items.filter(p => p.region === r.id); return g.length ? `<p class="sec">${esc(r.name)}</p><div class="group">${g.map(placeRow).join("")}</div>` : "" }).join("") +
      (items.some(p => !p.region) ? `<p class="sec">Not placed yet</p><div class="group">${items.filter(p => !p.region).map(placeRow).join("")}</div>` : "")
  }
  body.innerHTML = `<div class="ph"><span class="ic" style="--c:${c.color}">${icon(c.id)}</span><div><h2>${esc(c.name)}</h2><p>${n} in Leonida</p></div></div>${rows}`
  wire()
}

// your own pin: name, note, delete
function drawPin(v) {
  const pin = (st.pins || []).find(p => p.id === v.id)
  if (!pin) return closeSheet()
  body.innerHTML = `<div class="ph"><span class="ic" style="--c:var(--pink)">${icon("pin")}</span><div><h2>${esc(pin.name)}</h2><p>Your pin · ${new Date(pin.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p></div></div>
    <div class="pin-form"><input id="pinName" value="${esc(pin.name)}" maxlength="60" aria-label="Name" placeholder="Name"><textarea id="pinNote" rows="3" maxlength="500" aria-label="Note" placeholder="A note: what's here, what to come back for">${esc(pin.note)}</textarea></div>
    <div class="actions"><button class="act" id="pinShare">${icon("share")}Share</button><button class="act danger" id="pinDel">${icon("close")}Delete</button></div>
    <p class="fine">Only you see your pins.${acct.user ? " They sync with your account." : " Sign in to keep them on every device."}</p>`
  const name = $("#pinName"), note = $("#pinNote")
  if (v.fresh) { v.fresh = false; setTimeout(() => { name.focus(); name.select() }, 350) }
  const upd = () => { pin.name = name.value.trim() || "My pin"; pin.note = note.value; save(); body.querySelector("h2").textContent = pin.name; const b = pinEls.get(pin.id); if (b) b.setAttribute("aria-label", pin.name); labelEls.get(pin.id)?.remove(); labelEls.delete(pin.id); queue() }
  name.oninput = upd; note.oninput = upd
  $("#pinDel").onclick = () => { st.pins = st.pins.filter(p => p.id !== pin.id); save(); pinEls.get(pin.id)?.remove(); pinEls.delete(pin.id); labelEls.get(pin.id)?.remove(); labelEls.delete(pin.id); closeSheet() }
  $("#pinShare").onclick = async () => { const t = `${pin.name}${pin.note ? ": " + pin.note : ""}`; try { navigator.share ? await navigator.share({ title: pin.name, text: t }) : (await navigator.clipboard.writeText(t), $("#pinShare").lastChild.textContent = "Copied") } catch {} }
}

// the layers panel: every category on the map, its count and how many you've visited, one switch each
const LAYER_CATS = () => mapCats.filter(c => c.id !== "people" && c.id !== "vehicle")
function drawLayers(v) {
  const cats = LAYER_CATS(), shown = cats.filter(c => !st.hidden.includes(c.id)).length
  body.innerHTML = `<div class="ph"><span class="ic" style="--c:var(--pink)">${icon("layers")}</span><div><h2>Layers</h2><p>${shown} of ${cats.length} categories on the map</p></div></div>
    <div class="lay-all"><button class="act" id="showAll">Show all</button><button class="act" id="hideAll">Hide all</button></div>
    <p class="sec">Categories</p>
    <div class="group">${cats.map(c => {
      const items = pinned.filter(p => p.cat === c.id), seen = items.filter(p => st.visited[p.id]).length, on = !st.hidden.includes(c.id)
      return `<button class="row layer-row${on ? "" : " off"}" data-layer="${c.id}" role="switch" aria-checked="${on}" style="--c:${c.color}"><span class="ic">${icon(c.id)}</span><span class="t"><b>${esc(c.name)}</b><small><span class="lbar"><i style="width:${items.length ? seen / items.length * 100 : 0}%"></i></span>${seen} / ${items.length} visited</small></span><span class="toggle" aria-hidden="true"><input type="checkbox" tabindex="-1"${on ? " checked" : ""}><span></span></span></button>`
    }).join("")}</div>
    <p class="fine">Characters and vehicles show from their chips. The same switches live in Settings.</p>`
  body.querySelectorAll("[data-layer]").forEach(b => b.onclick = e => { e.preventDefault(); const id = b.dataset.layer; st.hidden = st.hidden.includes(id) ? st.hidden.filter(x => x !== id) : [...st.hidden, id]; save(); drawLayers(v); queue() })
  $("#showAll").onclick = () => { st.hidden = []; save(); drawLayers(v); queue() }
  $("#hideAll").onclick = () => { st.hidden = LAYER_CATS().map(c => c.id); save(); drawLayers(v); queue() }
}
$("#layers").onclick = () => { stack.length = 0; filter = null; drawChips(); push({ type: "layers", id: "all" }) }

// drag the sheet down to close it
{
  let y0 = null, dy = 0
  const down = e => { if (e.target.closest("button, input")) return; y0 = e.clientY; dy = 0; sheet.classList.add("dragging"); e.currentTarget.setPointerCapture(e.pointerId) }
  const move = e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)` }
  const up = () => { if (y0 == null) return; y0 = null; sheet.classList.remove("dragging"); sheet.style.transform = ""; if (dy > 90) closeSheet() }
  for (const h of [$("#grab"), head]) { h.addEventListener("pointerdown", down); h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up) }
}

// ---------- settings ----------
function toggleRow(key, title, sub) {
  return `<label class="row"><span class="t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span><span class="toggle"><input type="checkbox" data-key="${key}"${st[key] ? " checked" : ""}><span></span></span></label>`
}
function drawSettings() {
  const pv = Object.keys(st.visited).filter(id => place[id]).length, md = Object.keys(st.done).filter(id => mission[id]).length
  const ct = data.collectibles.reduce((a, c) => a + c.total, 0), cf = data.collectibles.reduce((a, c) => a + Math.min(c.total, st.found[c.id] || 0), 0)
  const stat = (n, of, label) => `<div class="stat"><b>${n}<small> / ${of}</small></b><span>${label}</span><div class="bar"><i style="width:${n / of * 100}%"></i></div></div>`
  $("#settingsBody").innerHTML = `<h1>Settings</h1>
    <p class="sec">Account</p>
    <div class="group" id="acct">${acctHTML()}</div>
    <p class="sec">Progress</p>
    <div class="stats">${stat(pv, pinned.filter(p => p.cat !== "people").length, "Places visited")}${stat(md, data.missions.length, "Missions done")}${stat(cf, ct, "Collectibles")}</div>
    <p class="sec">Appearance</p>
    <div class="group"><div class="seg" role="group" aria-label="Appearance">${["system", "light", "dark"].map(t => `<button data-theme="${t}" aria-pressed="${st.theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div></div>
    <p class="sec">Map</p>
    <div class="group">${toggleRow("labels", "Place names", "Show names next to pins when zoomed in")}${toggleRow("regions", "Region colours", "Tint each of the six regions in its own colour")}${toggleRow("cluster", "Group nearby pins", "Merge pins that overlap into a count")}${toggleRow("hideVisited", "Hide visited places")}</div>
    <p class="sec">Show on the map</p>
    <div class="group">${mapCats.filter(c => c.id !== "people" && c.id !== "vehicle").map(c => `<label class="row"><span class="ic" style="--c:${c.color}">${icon(c.id)}</span><span class="t"><b>${esc(c.name)}</b></span><span class="toggle"><input type="checkbox" data-cat="${c.id}"${st.hidden.includes(c.id) ? "" : " checked"}><span></span></span></label>`).join("")}</div>
    <p class="foot">Characters and vehicles show from their chips, or on the place they belong to.</p>
    <p class="sec">Spoilers</p>
    <div class="group">${toggleRow("spoilers", "Show mission and chapter names", "Off until you've played them")}</div>
    <p class="sec">Data</p>
    <div class="group"><button class="row link" id="export"><span class="t"><b>Export progress</b></span></button><button class="row danger" id="reset"><span class="t"><b>Reset progress</b></span></button></div>
    <p class="foot">${acct.user ? "Progress syncs to your account at api.jaybulb.com. Nothing else is collected." : "Progress stays on this device unless you sign in. Nothing else is collected."}</p>
    <p class="sec">About</p>
    <div class="group">
      <div class="row"><span class="t"><b>Version</b></span><span class="val">${VERSION}</span></div>
      <div class="row"><span class="t"><b>Map data</b></span><span class="val">${new Date(data.updated + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></div>
      <a class="row link" href="https://github.com/nulljosh/flamingo"><span class="t"><b>Source code</b></span></a>
      <a class="row link" href="/brand/"><span class="t"><b>Brand kit</b></span></a>
      <a class="row link" href="mailto:info@jaybulb.com?subject=Flamingo%20map"><span class="t"><b>Report a wrong pin</b></span></a>
    </div>
    <p class="foot">${esc(data.disclaimer)} Grand Theft Auto is a trademark of Take-Two Interactive. Place names come from Rockstar's trailers and site, cross-checked against community maps.</p>`
  const b = $("#settingsBody")
  wireAcct(b)
  b.querySelectorAll("[data-theme]").forEach(x => x.onclick = () => { st.theme = x.dataset.theme; save(false); applyTheme(); drawSettings() })
  b.querySelectorAll("[data-key]").forEach(x => x.onchange = () => { st[x.dataset.key] = x.checked; save(false); applySettings() })
  b.querySelectorAll("[data-cat]").forEach(x => x.onchange = () => { st.hidden = x.checked ? st.hidden.filter(c => c !== x.dataset.cat) : [...st.hidden, x.dataset.cat]; save(); queue() })
  $("#export").onclick = () => {
    const blob = new Blob([JSON.stringify({ app: "flamingo", exported: new Date().toISOString(), visited: st.visited, done: st.done, found: st.found }, null, 2)], { type: "application/json" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "flamingo-progress.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const reset = $("#reset")
  reset.onclick = () => {
    if (!reset.dataset.armed) { reset.dataset.armed = 1; reset.querySelector("b").textContent = "Tap again to reset everything"; setTimeout(() => { if (reset.isConnected) { delete reset.dataset.armed; reset.querySelector("b").textContent = "Reset progress" } }, 3000); return }
    st.visited = {}; st.done = {}; st.found = {}; save(); drawSettings(); queue()
  }
}
function applySettings() { mapEl.classList.toggle("tints", !!st.regions); queue() }

// ---------- story: the mission checklist, and a guess from the save's completion % ----------
function drawStory() {
  const ms = data.missions, n = ms.filter(m => st.done[m.id]).length
  const next = ms.find(m => !st.done[m.id])
  const g = st.savePct !== "" ? estimate(st.savePct, ms) : null
  const where = m => `${chapterName(m)}, mission ${m.n}${st.spoilers && m.name ? `: ${m.name}` : ""}`
  $("#storyBody").innerHTML = `<h1>Story</h1>
    <div class="big"><p class="num">${n}<small> / ${ms.length} missions</small></p><div class="bar"><i style="width:${n / ms.length * 100}%"></i></div>
      <p class="next">${next ? `Next up: <b>${esc(where(next))}</b>` : "<b>Story complete.</b>"}</p></div>
    <p class="sec">Where am I?</p>
    <div class="group">
      <div class="guess"><label for="pct">Completion on your save</label><span class="pct"><input id="pct" type="number" inputmode="decimal" min="0" max="100" step="0.1" placeholder="0" value="${esc(st.savePct)}">%</span></div>
      <div class="guess-out" id="guessOut">${g ? (g.finished ? `That's past the end of the story: <b>all ${ms.length} missions</b> are probably done.` : `About <b>${g.done} of ${ms.length}</b> missions done. You're probably on <b>${esc(where(g.next))}</b>.`) + `<button class="act" id="applyGuess">${icon("check")}Mark the first ${g.done} done</button>` : "Enter the % from your save's pause menu and Flamingo guesses where you are."}</div>
    </div>
    <p class="foot">A guess. It assumes the story is about ${STORY_SHARE}% of a 100% save, as in GTA V. Rockstar hasn't published the real weights.</p>
    ${[1, 2, 3, 4, 5].map(ch => { const cm = ms.filter(m => m.chapter === ch), d = cm.filter(m => st.done[m.id]).length
      return `<p class="sec chap">${esc(chapterName(cm[0]))}<span>${d} / ${cm.length}</span></p><div class="group">${cm.map(m => `<button class="row${st.done[m.id] ? " on" : ""}${next && m.id === next.id ? " nextup" : ""}" data-done="${m.id}" aria-pressed="${!!st.done[m.id]}"><span class="chk">${icon("check")}</span><span class="t"><b>${esc(missionName(m))}</b><small>${esc(who(m))}</small></span>${m.heist ? '<span class="heist">Heist</span>' : ""}</button>`).join("")}</div>` }).join("")}
    <p class="sec">Places</p>
    <div class="group">${LAYER_CATS().map(c => { const items = pinned.filter(p => p.cat === c.id), seen = items.filter(p => st.visited[p.id]).length
      return `<button class="row layer-row" data-list="${c.id}" style="--c:${c.color}"><span class="ic">${icon(c.id)}</span><span class="t"><b>${esc(c.name)}</b><small><span class="lbar"><i style="width:${items.length ? seen / items.length * 100 : 0}%"></i></span>${seen} / ${items.length} visited</small></span>${icon("chev").replace('class="i"', 'class="i chev"')}</button>` }).join("")}</div>
    <p class="sec">Collectibles</p>
    <div class="group">${data.collectibles.map(c => `<div class="row"><span class="ic" style="--c:#ff9500">${icon("collectible")}</span><span class="t"><b>${esc(c.name)}</b><small>${c.total} in Leonida</small></span><span class="mini"><button data-step="${c.id}" data-k="-1" aria-label="One fewer ${esc(c.name)}">${icon("minus")}</button><output>${st.found[c.id] || 0}/${c.total}</output><button data-step="${c.id}" data-k="1" aria-label="One more ${esc(c.name)}">${icon("plus")}</button></span></div>`).join("")}</div>
    <p class="foot">Mission names follow the spoiler switch in Settings.</p>`
  const b = $("#storyBody")
  const pct = $("#pct")
  pct.oninput = () => { st.savePct = pct.value; save(); const pos = pct.selectionStart; drawStory(); const p2 = $("#pct"); p2.focus(); try { p2.setSelectionRange(pos, pos) } catch {} }
  $("#applyGuess") && ($("#applyGuess").onclick = () => { const k = missionsDone(st.savePct, ms.length); ms.forEach((m, i) => { if (i < k) st.done[m.id] ||= Date.now(); else delete st.done[m.id] }); save(); drawStory() })
  b.querySelectorAll("[data-done]").forEach(r => r.onclick = () => { const id = r.dataset.done; st.done[id] ? delete st.done[id] : st.done[id] = Date.now(); save(); const y = $("#story").scrollTop; drawStory(); $("#story").scrollTop = y })
  b.querySelectorAll("[data-list]").forEach(x => x.onclick = () => { setTab("map"); stack.length = 0; openList(x.dataset.list) })
  b.querySelectorAll("[data-step]").forEach(x => x.onclick = () => { const c = coll[x.dataset.step]; st.found[c.id] = Math.max(0, Math.min(c.total, (st.found[c.id] || 0) + +x.dataset.k)); save(); x.parentElement.querySelector("output").textContent = `${st.found[c.id]}/${c.total}` })
}

// ---------- tabs ----------
const TABS = ["map", "story", "settings"]
function setTab(t) {
  const page = t !== "map"
  document.body.classList.toggle("on-page", page)
  document.body.classList.toggle("on-story", t === "story"); document.body.classList.toggle("on-settings", t === "settings")
  $("#tabMap").setAttribute("aria-selected", t === "map"); $("#tabStory").setAttribute("aria-selected", t === "story"); $("#tabSettings").setAttribute("aria-selected", t === "settings")
  $("#tabPill").style.transform = `translateX(${TABS.indexOf(t) * 88}px)`
  if (t === "settings") drawSettings()
  if (t === "story") drawStory()
  if (page) { sheet.classList.remove("open"); document.body.classList.remove("sheet-open"); history.replaceState(null, "", location.pathname + location.search + "#" + t) }
  else { if (stack.length) showSheet(); if (location.hash === "#settings" || location.hash === "#story") history.replaceState(null, "", location.pathname + location.search) }
}
$("#tabMap").onclick = () => setTab("map")
$("#tabStory").onclick = () => setTab("story")
$("#tabSettings").onclick = () => setTab("settings")
$("#searchBtn").onclick = () => openSearch()

// ---------- start ----------
drawWorld(); drawChips(); applySettings()
// first run: three hints in one card, once
if (!st.hinted) {
  const h = document.createElement("div"); h.className = "hint glass"; h.setAttribute("role", "dialog"); h.setAttribute("aria-label", "Getting started")
  h.innerHTML = `<b>Welcome to Leonida</b>
    <p>${icon("map")}<span>Tap a region to zoom in. Tap a pin for its card.</span></p>
    <p>${icon("search")}<span>Search finds any place, mission or collectible.</span></p>
    <p>${icon("story")}<span>Story tracks your run. Type your save % to jump in.</span></p>
    <button class="act on" id="hintOk">Got it</button>`
  document.body.appendChild(h)
  $("#hintOk").onclick = () => { st.hinted = true; save(false); h.classList.add("gone"); setTimeout(() => h.remove(), 300) }
}
function onResize() { const f = fitView(); const first = fitS === 1; fitS = f.s; if (first) Object.assign(view, f); else clamp(view); render() }
addEventListener("resize", onResize); onResize()
setTimeout(() => pinEls.forEach(b => b.classList.remove("drop")), 900)
// deep links: #place/<id>, #region/<id>, #mission/<id>, #list/<id>, #search, #settings
function route() {
  const [kind, raw] = location.hash.slice(1).split("/"), id = decodeURIComponent(raw || "")
  if (kind === "settings" || kind === "story") return setTab(kind)
  if (document.body.classList.contains("on-page")) setTab("map")
  if (kind === "place" && place[id]) openPlace(id, { fromMap: true })
  else if (kind === "region" && region[id]) { stack.length = 0; push({ type: "region", id }); zoomToItems(pinned.filter(p => p.region === id)) }
  else if (kind === "mission" && mission[id]) { stack.length = 0; push({ type: "mission", id }) }
  else if (kind === "collectible" && coll[id]) { stack.length = 0; push({ type: "collectible", id }) }
  else if (kind === "list" && cat[id]) { stack.length = 0; openList(id) }
  else if (kind === "search") { stack.length = 0; push({ type: "search", q: id }) }
  else if (kind === "layers") { stack.length = 0; push({ type: "layers", id: "all" }) }
}
route(); addEventListener("hashchange", route)
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {})
window.flamingo = { view, setView, openPlace, openSearch, setTab, render, data } // for the QA script
