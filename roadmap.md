# Roadmap

## Done (1.0.0, 2026-11-24)
- Data: 6 regions, 90 places (87 pinned), 91 missions, 8 collectible sets
- Web app: a map with a region overview, clustering, labels, category chips and search; sheets for places, regions, missions and collectibles; settings, progress and offline use
- Landing page built from the QA screenshots

## Next
1. iPhone and iPad: built (1.0.0). Next: iPad landscape pass with the inspector column, then a TestFlight build
2. Mac app: the same target, with a sidebar on wide windows
3. More places as the community maps fill in: Ammu-Nations (24), stunt jumps, shipwrecks with coordinates
4. A Swift port of search that agrees with `search.js` on shared vectors
5. App Store listing (name check: no GTA in the title)

## Gap matrix (from /mobbin, 2026-11-24)
Compared against App Store screens of MapGenie (Crimson Desert, Elden Ring), Interactive Map for GTA 5, Companion for Fortnite, Apple Maps, Google Maps, AllTrails, Citymapper and Mapstr. Ordered by what players touch every session. Each row is one minor version, on web and iOS together.

| # | Gap | Who has it | Size | Version | Status |
|---|-----|------------|------|---------|--------|
| G1 | Layers panel on the map: every category with its count, a found bar, Show all / Hide all | MapGenie, GTA 5 map | M | 1.2.0 | done |
| G2 | Search results on the map: matches stay as lettered pins, "Show on map" folds the sheet down | GTA 5 map, Apple Maps, Google Maps | M | 1.3.0 | done |
| G3 | My pins: long-press to drop your own pin with a note; star places as favourites | MapGenie notes, Mapstr, GTA 5 map favourites | M | 1.4.0 | todo |
| G4 | Recents: last searches and places you opened, on the empty search | Apple Maps, Google Maps | S | 1.5.0 | todo |
| G5 | Progress per category in the Story tab, beside missions and collectibles | Elden Ring map tracker, GTA 5 map | S | 1.6.0 | todo |
| G6 | First-run hints: tap a region, long-press to pin, where Story lives | Mapstr, Apple Maps | S | 1.7.0 | todo |

Skipped on purpose: photos and quest walkthroughs (no rights to the art, no verified step data), satellite tiles (Rockstar's imagery), accounts, social and paywalls.

Also fixed in 1.3.0: hidden pins were still drawn on the web, because `.pin { display: grid }` overrode the `hidden` attribute. QA now checks what is drawn, not the attribute.

## 1.4.0 (2026-11-24)
- Accounts on the web: email sign-up, sign in, reset, sign out and delete, from Settings. Progress (visited, missions, collectibles, save %) syncs through api.jaybulb.com's `flamingo_progress` table, which is owner-only. The first link merges, and after that the newer side wins (`web/app/sync.js`, tested). Checked end to end against a local API by `tests/account.mjs`.
- GTA VI colours: Vice pink `#ff3d8b`, sunset `#ff8a3d → #ff3d8b`, sea teal `#14b8c4`, and teal-tinted water. No violet.
- New icon: a white pin over a striped sunset and teal water.
- Next: accounts in the iOS app (same table, URLSession), then G3 to G6.
