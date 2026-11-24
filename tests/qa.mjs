// Headless QA: drives the web app in Chrome (Playwright, channel "chrome"), checks it, and saves screenshots.
// node tests/qa.mjs [baseUrl] [outDir]     default http://localhost:8790  docs/img/qa
// Prints PASS/FAIL per check and exits non-zero on any failure.
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
const require = createRequire(`${homedir()}/Documents/Josh/Code/epiphany/package.json`)
const { chromium, devices } = require("playwright")

const base = process.argv[2] || "http://localhost:8790", out = process.argv[3] || "docs/img/qa"
mkdirSync(out, { recursive: true })
let fails = 0
const check = (ok, name, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) fails++ }

const browser = await chromium.launch({ channel: "chrome", headless: true })
async function phone(theme) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], colorScheme: theme, deviceScaleFactor: 3 })
  const page = await ctx.newPage(), errors = []
  page.on("pageerror", e => errors.push(e.message)); page.on("console", m => m.type() === "error" && errors.push(m.text()))
  await page.goto(`${base}/app/`); await page.waitForSelector(".rcard"); await page.waitForTimeout(1300)
  check(await page.isVisible(".hint"), `${theme}: first-run hint shows`)
  await page.screenshot({ path: `${out}/phone-hint-${theme}.png` })
  await page.click("#hintOk"); await page.waitForTimeout(400)
  return { ctx, page, errors }
}
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` })

for (const theme of ["light", "dark"]) {
  const { ctx, page, errors } = await phone(theme)
  check((await page.locator(".rcard:not(.hide)").count()) === 6, `${theme}: overview shows six region cards`)
  check((await page.evaluate(() => document.documentElement.dataset.theme)) === theme, `${theme}: theme follows the system`)
  await shot(page, `phone-map-${theme}`)

  // tap a region card: it zooms in and the pins appear
  await page.locator(".rcard", { hasText: "Grassrivers" }).click(); await page.waitForTimeout(900)
  check((await page.locator(".pin:not([hidden])").count()) >= 4, `${theme}: tapping a region shows its pins`)
  await shot(page, `phone-region-${theme}`)
  // zoom into Vice City: pins split out of clusters and labels show
  await page.evaluate(() => { const f = window.flamingo, w = innerWidth, h = innerHeight, s = f.view.s * 5.2; f.setView({ s, x: w / 2 - 840 * s, y: h * .42 - 826 * s }) })
  await page.waitForTimeout(500)
  check((await page.locator(".plabel:not([hidden])").count()) > 3, `${theme}: labels show when zoomed in`)
  await shot(page, `phone-vicecity-${theme}`)

  // layers: hide a category and its pins go; show all brings them back
  await page.click("#layers"); await page.waitForTimeout(500)
  check((await page.locator("[data-layer]").count()) >= 10, `${theme}: layers lists the categories`)
  await shot(page, `phone-layers-${theme}`)
  const before = await page.locator(".pin:not([hidden]), .cluster:not([hidden])").count()
  await page.click("#hideAll"); await page.waitForTimeout(300)
  check((await page.locator(".pin:not([hidden]), .cluster:not([hidden])").count()) === 0 || before === 0, `${theme}: hide all clears the map`)
  await page.locator("[data-layer='safehouse']").click(); await page.waitForTimeout(200)
  check((await page.getAttribute("[data-layer='safehouse']", "aria-checked")) === "true", `${theme}: one layer switches back on`)
  await page.click("#showAll"); await page.waitForTimeout(200)
  await page.click("#sClose"); await page.waitForTimeout(300)
  // search
  await page.click("#searchBtn"); await page.waitForTimeout(500)
  await shot(page, `phone-browse-${theme}`)
  await page.fill("#q", "garage"); await page.waitForTimeout(300)
  const n = await page.locator("#sheetBody [data-place]").count()
  check(n >= 2, `${theme}: search "garage" finds garages`, `${n} results`)
  await shot(page, `phone-search-${theme}`)
  check((await page.locator(".pin.lettered:not([hidden])").count()) >= 4, `${theme}: search results stay on the map as lettered pins`)
  await page.click("#showHits"); await page.waitForTimeout(800)
  check(await page.evaluate(() => document.querySelector("#sheet").classList.contains("peek")), `${theme}: Show on the map folds the sheet down`)
  await shot(page, `phone-searchmap-${theme}`)
  // checks what is drawn, not the attribute: a hidden pin must not render
  const strays = await page.evaluate(() => [...document.querySelectorAll(".pin:not(.lettered), .cluster")].filter(b => b.getBoundingClientRect().width > 0).map(b => b.getAttribute("aria-label")))
  check(strays.length === 0, `${theme}: only search matches show on the map`, strays.join(" | "))

  // a place card
  await page.locator("#sheetBody [data-place='shore-court-garage']").click(); await page.waitForTimeout(900)
  check((await page.textContent("#sheetBody h2")) === "Shore Court Garage", `${theme}: place card opens`)
  check((await page.locator(".pin.sel").count()) === 1, `${theme}: the pin is selected on the map`)
  await page.click("#visit"); await page.waitForTimeout(200)
  check((await page.textContent("#visit")).includes("Visited"), `${theme}: mark visited`)
  await shot(page, `phone-place-${theme}`)

  // settings
  await page.click("#tabSettings"); await page.waitForTimeout(500)
  check(await page.isVisible("#settings h1"), `${theme}: settings tab`)
  check((await page.textContent(".stat b")).startsWith("1"), `${theme}: progress counts the visit`)
  await shot(page, `phone-settings-${theme}`)
  // story: the checklist and the save-% guess
  await page.click("#tabStory"); await page.waitForTimeout(400)
  check(await page.isVisible("#story h1"), `${theme}: story tab`)
  await page.fill("#pct", "30"); await page.waitForTimeout(200)
  check((await page.textContent("#guessOut")).includes("46 of 91"), `${theme}: 30% guesses 46 of 91 missions`)
  await page.click("#applyGuess"); await page.waitForTimeout(200)
  check((await page.textContent("#storyBody .num")).startsWith("46"), `${theme}: applying the guess ticks 46 missions`)
  await page.locator("[data-done='m3-02']").click(); await page.waitForTimeout(150)
  check((await page.textContent("#storyBody .num")).startsWith("45"), `${theme}: tapping a mission unticks it`)
  await page.evaluate(() => document.querySelector("#story").scrollTo(0, 0)); await page.waitForTimeout(200)
  await shot(page, `phone-story-${theme}`)
  await page.evaluate(() => { const r = document.querySelector(".row.nextup"); document.querySelector("#story").scrollTo(0, r.offsetTop - 260) }); await page.waitForTimeout(250)
  await shot(page, `phone-checklist-${theme}`)
  await page.click("#tabMap"); await page.waitForTimeout(400)
  check(await page.isVisible("#sheet.open"), `${theme}: map tab brings the sheet back`)

  // your own pin: long-press the map, name it, it stays on the map
  await page.click("#sClose"); await page.waitForTimeout(300)
  await page.evaluate(() => { const f = window.flamingo, w = innerWidth, h = innerHeight, s = f.view.s; f.setView({ s, x: w / 2 - 520 * s, y: h * .42 - 300 * s }) }); await page.waitForTimeout(300)
  await page.mouse.move(200, 320); await page.mouse.down(); await page.waitForTimeout(750); await page.mouse.up(); await page.waitForTimeout(600)
  check(await page.isVisible("#pinName"), `${theme}: long-press drops a pin and opens it`)
  await page.fill("#pinName", "Hidden stash"); await page.fill("#pinNote", "Check the water tower"); await page.waitForTimeout(200)
  check((await page.locator(".pin.mine").count()) === 1, `${theme}: the pin is on the map`)
  await shot(page, `phone-mypin-${theme}`)
  // save a place
  await page.click("#sClose"); await page.click("#searchBtn"); await page.fill("#q", "vercetti"); await page.waitForTimeout(250)
  await page.locator("#sheetBody [data-place='vercetti-estate']").click(); await page.waitForTimeout(700)
  await page.click("#fav"); await page.waitForTimeout(150)
  check((await page.textContent("#fav")).includes("Saved"), `${theme}: save a place`)
  // recents: the garage search and the place opened from it
  await page.click("#sClose"); await page.click("#searchBtn"); await page.waitForTimeout(300)
  check((await page.locator("[data-q='garage']").count()) === 1 && (await page.locator("#sheetBody [data-place='shore-court-garage']").count()) >= 1, `${theme}: recents keep the search and the place`)
  check((await page.locator("#sheetBody [data-pin]").count()) === 1 && (await page.locator("#sheetBody [data-place='vercetti-estate']").count()) >= 1, `${theme}: Saved lists the pin and the saved place`)
  await shot(page, `phone-recents-${theme}`)
  // spoilers off by default: mission names hidden from search
  await page.click("#sClose"); await page.click("#searchBtn"); await page.fill("#q", "sinfrontera"); await page.waitForTimeout(200)
  check((await page.locator("#sheetBody [data-mission]").count()) === 0, `${theme}: mission names hidden without spoilers`)

  check(errors.length === 0, `${theme}: no console errors`, errors.join(" | "))
  await ctx.close()
}

// desktop: the sheet is a left panel
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "light" })
  const page = await ctx.newPage(), errors = []
  page.on("pageerror", e => errors.push(e.message))
  await page.addInitScript(() => localStorage.setItem("flamingo.v1", JSON.stringify({ hinted: true })))
  await page.goto(`${base}/app/#region/vice-city`); await page.waitForSelector(".rcard"); await page.waitForTimeout(1400)
  const box = await page.locator("#sheet").boundingBox()
  check(box && box.x < 40 && box.width < 420, "desktop: sheet is a left panel", JSON.stringify(box))
  await shot(page, "desktop-region-light")
  await page.click("#sClose"); await page.click("#fit"); await page.waitForTimeout(700)
  await shot(page, "desktop-map-light")
  await page.emulateMedia({ colorScheme: "dark" }); await page.goto(`${base}/app/#region/vice-city`); await page.waitForTimeout(1400)
  await shot(page, "desktop-region-dark")
  await page.click("#sClose"); await page.click("#fit"); await page.waitForTimeout(700)
  await shot(page, "desktop-map-dark")
  check(errors.length === 0, "desktop: no console errors", errors.join(" | "))
  await ctx.close()
}
await browser.close()
// the landing page shows these exact screenshots
if (!fails && out === "docs/img/qa") {
  const { copyFileSync } = await import("node:fs")
  for (const n of ["phone-search", "phone-vicecity", "phone-place", "phone-browse", "phone-settings", "phone-story", "phone-checklist", "phone-layers", "phone-searchmap", "phone-mypin", "phone-recents", "desktop-region"]) for (const t of ["light", "dark"]) copyFileSync(`${out}/${n}-${t}.png`, `web/img/${n}-${t}.png`)
  console.log("landing screenshots updated in web/img")
}
console.log(fails ? `${fails} FAILED` : "ALL PASS")
process.exit(fails ? 1 : 0)
