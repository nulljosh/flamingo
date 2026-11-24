# Flamingo loop handoff (2026-11-24)

The `/loop` builds Flamingo toward an A+ landing page and app: web and iOS first, then Mac and iPad. Every step must pass `node --test tests/search.test.mjs`, `node tests/qa.mjs` and `node tests/landing.mjs`, and the screenshots get a look by eye. Then commit, push and deploy.

## Where things stand
- 2.0.0 is live at flamingo.jaybulb.com. Repo nulljosh/flamingo, tags v1.2.0 to v2.0.0.
- Web and iOS (iPhone and iPad) are at parity: map, layers, search with lettered results, place cards, own pins, saved places, recents, Story (checklist, save-% guess, category progress), settings, and accounts synced through api.jaybulb.com `flamingo_progress`.
- QA: `node --test tests/search.test.mjs`, `node tests/qa.mjs` (web, about 45 checks), `node tests/landing.mjs`, `node tests/brand.mjs`, `node tests/account.mjs` (needs a local jaybulb-api), `sh scripts/ios-shots.sh <udid>`.

## Next
See `roadmap.md`.

## Restart prompt
```
/loop until A+ quality landing page and project: Flamingo, the GTA VI map (~/Documents/Josh/Code/flamingo). Web and iOS first, then Mac and iPad. QA with screenshots as proof, use them in the landing page styled like Keyrate.
```
