// Landing QA: screenshots at phone and desktop sizes, light and dark, and checks that every image loads.
import { createRequire } from "node:module"
import { homedir } from "node:os"
const require = createRequire(`${homedir()}/Documents/Josh/Code/epiphany/package.json`)
const { chromium, devices } = require("playwright")
const base = process.argv[2] || "http://localhost:8790", out = "docs/img/qa"
const b = await chromium.launch({ channel: "chrome", headless: true })
let fails = 0
for (const theme of ["light", "dark"]) for (const [name, opts] of [["desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }], ["phone", { ...devices["iPhone 13"], deviceScaleFactor: 2 }]]) {
  const ctx = await b.newContext({ ...opts, colorScheme: theme }), p = await ctx.newPage(), errors = []
  p.on("pageerror", e => errors.push(e.message))
  await p.goto(`${base}/`); await p.waitForTimeout(3500)
  await p.screenshot({ path: `${out}/landing-${name}-${theme}.png` })
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)) } })
  await p.waitForTimeout(800)
  const broken = await p.evaluate(() => [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.currentSrc || i.src))
  console.log(`${broken.length || errors.length ? "FAIL" : "PASS"} landing ${name} ${theme}${broken.length ? " broken: " + broken.join(", ") : ""}${errors.length ? " errors: " + errors.join(" | ") : ""}`)
  if (broken.length || errors.length) fails++
  await p.screenshot({ path: `${out}/landing-${name}-${theme}-full.png`, fullPage: true })
  await ctx.close()
}
await b.close(); process.exit(fails ? 1 : 0)
