// Brand kit QA: full-page screenshots light and dark, every image and the mark load.
import { createRequire } from "node:module"
import { homedir } from "node:os"
const require = createRequire(`${homedir()}/Documents/Josh/Code/epiphany/package.json`)
const { chromium } = require("playwright")
const base = process.argv[2] || "http://localhost:8790"
const b = await chromium.launch({ channel: "chrome", headless: true })
let fails = 0
for (const theme of ["light", "dark"]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: theme }), errors = []
  p.on("pageerror", e => errors.push(e.message))
  await p.goto(`${base}/brand/`); await p.waitForTimeout(1500)
  const broken = await p.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.src))
  const chips = await p.locator("#cats .chip").count()
  const ok = !broken.length && !errors.length && chips > 15
  console.log(`${ok ? "PASS" : "FAIL"} brand ${theme} (${chips} colour chips)${broken.length ? " broken " + broken : ""}${errors.length ? " " + errors : ""}`)
  if (!ok) fails++
  await p.screenshot({ path: `docs/img/qa/brand-${theme}.png`, fullPage: true })
  await p.close()
}
await b.close(); process.exit(fails ? 1 : 0)
