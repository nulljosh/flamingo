// Renders the PNG icons and the Open Graph card from web/icon.svg and the live map, with Chrome (Playwright).
// node scripts/assets.mjs [baseUrl]   (serve web/ first: python3 -m http.server 8790 -d web)
import { createRequire } from "node:module"
import { homedir } from "node:os"
const require = createRequire(`${homedir()}/Documents/Josh/Code/epiphany/package.json`)
const { chromium } = require("playwright")
const base = process.argv[2] || "http://localhost:8790"
const b = await chromium.launch({ channel: "chrome", headless: true })
for (const [n, file] of [[180, "apple-touch-icon.png"], [512, "icon-512.png"], [32, "favicon-32.png"], [1024, "../apple/Flamingo/Assets.xcassets/AppIcon.appiconset/icon-1024.png"]]) {
  const p = await b.newPage({ viewport: { width: n, height: n } })
  // touch icons are square; iOS rounds them
  await p.setContent(`<style>html,body{margin:0;background:#ff3d8b}</style><img src="${base}/icon.svg" style="width:${n}px;height:${n}px;display:block;${n >= 180 ? "clip-path:inset(0)" : ""}">`)
  await p.waitForTimeout(300); await p.screenshot({ path: `web/${file}`, omitBackground: n < 180 }); await p.close()
}
// OG card: the app at a wide size, the title over it
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: "light" })
await p.goto(`${base}/app/#place/ocean-beach`); await p.waitForTimeout(1800)
await p.addStyleTag({ content: `.chips,.ctrls,.dock{display:none!important}` })
await p.evaluate(() => { const d = document.createElement("div"); d.innerHTML = '<img src="/icon.svg" style="width:72px;height:72px;border-radius:16px"><b>Every pin in Leonida.</b><span>The unofficial map for GTA VI</span>'; d.style.cssText = "position:fixed;right:48px;bottom:48px;z-index:99;display:grid;gap:8px;justify-items:end;text-align:right;padding:28px 32px;border-radius:28px;background:rgba(255,255,255,.8);backdrop-filter:blur(20px);box-shadow:0 10px 40px rgba(0,0,0,.15);font:600 20px -apple-system,sans-serif;color:#6e6e73"; d.querySelector("b").style.cssText = "font-size:44px;color:#1d1d1f;letter-spacing:-.03em"; document.body.appendChild(d) })
await p.waitForTimeout(400); await p.screenshot({ path: "web/og.png" })
await b.close(); console.log("assets written")
