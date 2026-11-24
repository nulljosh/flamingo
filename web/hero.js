// Hero, after Keyrate's keyboard: Flamingo's own object under the title. The map of Leonida lies tilted on the desk,
// and its pins drop in one by one, region by region, then a name card cycles through real places. Layers move at their
// own speed on scroll.
const NS = "http://www.w3.org/2000/svg"
const ground = document.getElementById("mapboard"), card = document.getElementById("dPlace")
const data = await (await fetch("/data/leonida.json")).json()
const cat = Object.fromEntries(data.categories.map(c => [c.id, c]))
const region = Object.fromEntries(data.regions.map(r => [r.id, r]))

function smooth(pts, closed = true, t = .5) {
  const n = pts.length, P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2)
    d += `C${(p1[0] + (p2[0] - p0[0]) * t / 3).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) * t / 3).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t / 3).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) * t / 3).toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return closed ? d + "Z" : d
}
const el = (tag, a, parent) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); parent.appendChild(e); return e }

const svg = el("svg", { viewBox: "40 60 900 1100", class: "hmap", "aria-hidden": "true" }, ground)
const m = data.map, landD = smooth(m.land) + m.islands.map(i => smooth(i.pts)).join("")
const defs = el("defs", {}, svg), clip = el("clipPath", { id: "hclip" }, defs)
el("path", { d: landD }, clip)
m.keys.forEach(([cx, cy, rx, ry, r]) => el("ellipse", { cx, cy, rx, ry, transform: `rotate(${r} ${cx} ${cy})` }, clip))
el("path", { class: "h-land", d: landD }, svg)
m.keys.forEach(([cx, cy, rx, ry, r]) => el("ellipse", { class: "h-land", cx, cy, rx, ry, transform: `rotate(${r} ${cx} ${cy})` }, svg))
const tint = el("g", { "clip-path": "url(#hclip)" }, svg)
// land cover, as in the app: forest, wetland, farmland, city
const cover = { "mount-kalaga": "forest", grassrivers: "wetland", ambrosia: "farm", "vice-city": "city" }
data.regions.forEach(r => cover[r.id] && el("polygon", { class: `h-cover ${cover[r.id]}`, points: r.poly.join(" ") }, tint))
m.lakes.forEach(l => el("ellipse", { class: "h-lake", cx: l.cx, cy: l.cy, rx: l.rx, ry: l.ry }, svg))
m.roads.forEach(r => el("path", { class: "h-road", d: smooth(r.pts, false) }, svg))

// pins, ordered from the Keys up to the park so they land like a wave
const pins = data.places.filter(p => p.x != null && p.cat !== "people" && p.cat !== "vehicle").sort((a, b) => b.y - a.y)
const g = el("g", {}, svg), dots = []
pins.forEach((p, i) => {
  const d = el("g", { class: "h-pin", transform: `translate(${p.x} ${p.y})` }, g)
  d.style.setProperty("--c", cat[p.cat].color); d.style.animationDelay = `${.4 + i * .028}s`
  el("circle", { r: 9.5, class: "h-pin-dot" }, d)
  dots.push({ p, d })
})

// the name card: a real place, its pin lifted
const still = matchMedia("(prefers-reduced-motion: reduce)").matches
const tour = ["jasons-house", "ocean-beach", "allied-crystal", "starlet-motel", "watson-bay", "kalaga-lookout", "jack-of-hearts", "gellhorn-raceway", "leonida-penitentiary", "vercetti-estate"]
let k = 0
function next() {
  const id = tour[k++ % tour.length], p = data.places.find(x => x.id === id), dot = dots.find(x => x.p.id === id)
  dots.forEach(x => x.d.classList.remove("on")); dot?.d.classList.add("on")
  if (card) { card.style.setProperty("--c", cat[p.cat].color); card.querySelector("b").textContent = p.name; card.querySelector("small").textContent = `${cat[p.cat].one} · ${region[p.region].short}`; card.classList.remove("swap"); void card.offsetWidth; card.classList.add("swap") }
}
setTimeout(() => { next(); if (!still) setInterval(next, 2600) }, still ? 0 : 2400)

// parallax: the board sinks slower than the page
const sky = document.getElementById("hsky")
if (!still) addEventListener("scroll", () => {
  const y = scrollY
  ground.style.transform = `translateY(${y * .25}px)`
  if (sky) sky.style.transform = `translateY(${y * .45}px)`
}, { passive: true })
