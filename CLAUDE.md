# Flamingo

Unofficial searchable map of GTA VI's Leonida. Web first (target: flamingo.jaybulb.com), then iPhone, iPad and Mac (`apple/`, SwiftUI, xcodegen). Repo nulljosh/flamingo.

- `scripts/build-data.mjs` is the one source of truth; it writes `web/data/leonida.json`, which every app reads. Never hand-edit the JSON
- `web/index.html` is the landing page, styled after Keyrate: jaybulb tokens, topbar, a tilted hero object, footer glyph band. `web/app/` is the map app: `app.js` (map, sheet, settings), `search.js` (pure, tested), `app.css`
- Landing screenshots in `web/img/` are copied from the QA run (`node tests/qa.mjs`); never mock them up
- Tests: `node --test tests/search.test.mjs`, `node tests/qa.mjs`, `node tests/landing.mjs` (serve `web/` on :8790 first). They use Playwright from epiphany's node_modules with `channel: "chrome"`
- Deploy: `env -u CLOUDFLARE_API_TOKEN npx wrangler deploy`
- Rules: no "GTA" in the app name or icon; keep the not-affiliated line; no Rockstar art or map imagery; no beige, no purple, no emojis; mission names stay behind the spoiler toggle
- The loop: see `docs/LOOP-HANDOFF.md`
