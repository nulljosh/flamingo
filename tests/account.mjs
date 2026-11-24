// Account QA against a local API (jaybulb-api: npx wrangler dev --local, MAIL_DEBUG=1): sign up, confirm, sign in from
// Settings, mark a place visited, and check the row lands in flamingo_progress; then sign out.
// node tests/account.mjs [web=http://localhost:8790] [api=http://localhost:8787]
import { createRequire } from "node:module"
import { homedir } from "node:os"
const require = createRequire(`${homedir()}/Documents/Josh/Code/epiphany/package.json`)
const { chromium, devices } = require("playwright")
const web = process.argv[2] || "http://localhost:8790", api = process.argv[3] || "http://localhost:8787"
let fails = 0
const check = (ok, name, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) fails++ }
const email = `flamingo+${Date.now()}@example.com`, password = "correct horse battery"
const su = await fetch(`${api}/auth/signup`, { method: "POST", headers: { "content-type": "application/json", origin: "https://flamingo.jaybulb.com" }, body: JSON.stringify({ email, password, redirect_to: "https://flamingo.jaybulb.com/app/#settings" }) })
const link = su.headers.get("x-debug-mail"); await fetch(link.match(/https?:\/\/\S+/)?.[0] ?? link, { redirect: "manual" })
check(su.ok && !!link, "account created and confirmed on the local API")

const b = await chromium.launch({ channel: "chrome" })
for (const theme of ["light", "dark"]) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 3, colorScheme: theme }), p = await ctx.newPage()
  await p.addInitScript(() => { if (!localStorage.getItem("flamingo.v1")) localStorage.setItem("flamingo.v1", JSON.stringify({ hinted: true })) })
  await p.goto(`${web}/app/?api=${encodeURIComponent(api)}#settings`); await p.waitForTimeout(1200)
  await p.click("#acOpen"); await p.fill("#acEmail", email); await p.fill("#acPass", password)
  await p.screenshot({ path: `docs/img/qa/phone-signin-${theme}.png` })
  await p.click("[data-do='in']"); await p.waitForTimeout(1500)
  check((await p.textContent("#acct")).includes(email), `${theme}: signed in from Settings`)
  await p.screenshot({ path: `docs/img/qa/phone-account-${theme}.png` })
  if (theme === "light") {
    await p.goto(`${web}/app/?api=${encodeURIComponent(api)}#place/ocean-beach`); await p.waitForTimeout(1200)
    await p.click("#visit"); await p.waitForTimeout(2500)
    const tok = (await (await fetch(`${api}/auth/token?grant_type=password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).json()).access_token
    const rows = await (await fetch(`${api}/rest/flamingo_progress`, { headers: { authorization: `Bearer ${tok}` } })).json()
    check(rows[0]?.visited?.["ocean-beach"] > 0, "light: a visit syncs to the account", JSON.stringify(rows[0]?.visited))
    // a second device: fresh storage, sign in, the visit comes down
    const ctx2 = await b.newContext({ ...devices["iPhone 13"] }), p2 = await ctx2.newPage()
    await p2.addInitScript(() => { if (!localStorage.getItem("flamingo.v1")) localStorage.setItem("flamingo.v1", JSON.stringify({ hinted: true })) })
    await p2.goto(`${web}/app/?api=${encodeURIComponent(api)}#settings`); await p2.waitForTimeout(1000)
    await p2.click("#acOpen"); await p2.fill("#acEmail", email); await p2.fill("#acPass", password); await p2.click("[data-do='in']"); await p2.waitForTimeout(2000)
    check((await p2.textContent(".stat b")).startsWith("1"), "a second device pulls the visit down")
    await ctx2.close()
    await p.goto(`${web}/app/?api=${encodeURIComponent(api)}#settings`); await p.waitForTimeout(1000)
  }
  await p.click("#acOut"); await p.waitForTimeout(600)
  check((await p.textContent("#acct")).includes("Sign in"), `${theme}: signed out`)
  await ctx.close()
}
await b.close(); console.log(fails ? `${fails} FAILED` : "ALL PASS"); process.exit(fails ? 1 : 0)
