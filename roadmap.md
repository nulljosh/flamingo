# Roadmap

## Done (1.0.0, 2026-11-24)
- Data: 6 regions, 90 places (87 pinned), 91 missions, 8 collectible sets
- Web app: a map with a region overview, clustering, labels, category chips and search; sheets for places, regions, missions and collectibles; settings, progress and offline use
- Landing page built from the QA screenshots

## Gap matrix (from /mobbin, 2026-11-24)
Compared against App Store screens of MapGenie (Crimson Desert, Elden Ring), Interactive Map for GTA 5, Companion for Fortnite, Apple Maps, Google Maps, AllTrails, Citymapper and Mapstr. Ordered by what players touch every session. Each row is one minor version, on web and iOS together.

| # | Gap | Who has it | Size | Version | Status |
|---|-----|------------|------|---------|--------|
| G1 | Layers panel on the map: every category with its count, a found bar, Show all / Hide all | MapGenie, GTA 5 map | M | 1.2.0 | done |
| G2 | Search results on the map: matches stay as lettered pins, "Show on map" folds the sheet down | GTA 5 map, Apple Maps, Google Maps | M | 1.3.0 | done |
| G3 | My pins: long-press to drop your own pin with a note; star places as favourites | MapGenie notes, Mapstr, GTA 5 map favourites | M | 1.4.0 | done |
| G4 | Recents: last searches and places you opened, on the empty search | Apple Maps, Google Maps | S | 1.5.0 | done |
| G5 | Progress per category in the Story tab, beside missions and collectibles | Elden Ring map tracker, GTA 5 map | S | 1.6.0 | done |
| G6 | First-run hints: tap a region, long-press to pin, where Story lives | Mapstr, Apple Maps | S | 1.7.0 | done |

Skipped on purpose: photos and quest walkthroughs (no rights to the art, no verified step data), satellite tiles (Rockstar's imagery), accounts, social and paywalls.

Also fixed in 1.3.0: hidden pins were still drawn on the web, because `.pin { display: grid }` overrode the `hidden` attribute. QA now checks what is drawn, not the attribute.

## 1.4.0 (2026-11-24)
- Accounts on the web: email sign-up, sign in, reset, sign out and delete, from Settings. Progress (visited, missions, collectibles, save %) syncs through api.jaybulb.com's `flamingo_progress` table, which is owner-only. The first link merges, and after that the newer side wins (`web/app/sync.js`, tested). Checked end to end against a local API by `tests/account.mjs`.
- GTA VI colours: Vice pink `#ff3d8b`, sunset `#ff8a3d → #ff3d8b`, sea teal `#14b8c4`, and teal-tinted water. No violet.
- New icon: a white pin over a striped sunset and teal water.
- Next: accounts in the iOS app (same table, URLSession), then G3 to G6.

## 1.5.0 and 1.6.0 (2026-11-24)
- iOS accounts: the same email sign-in and `flamingo_progress` sync as the web, with the session in the Keychain. Checked against a local API: the phone's visits reached the account row.
- G4: recents, the last 6 searches and places, on the empty search.
- G5: progress for each category in the Story tab.
- G6: a first-run card with three hints.
- G3: long-press the map to drop your own pin (name and note), and save places with a star. Both sync (new `fav` and `pins` columns).
- The iOS dock stays centred on every tab.

## 2.0.0 (2026-11-24)
- Gap matrix done (G1 to G6). An Apple pass over every screen: every control is 48 pt and a capsule, one set of radii (cards 28, lists 20, controls round), rows padded 12 by 16, thinner glass (blur 30), a 4 pt focus ring in the accent at 30%, a 34/40 large title at −2.2%.
- iPad checked in the simulator (inspector column).

## 2.0.x (2026-11-24 to 27)
- 14 more sourced pins: Key Lento (the Rusty Anchor, Wonder Whale, police), Port Gellhorn station and trailer signage, Grassrivers airboats and the Hamlet water tower. 104 places, 101 pinned.
- App Store listing drafted in `metadata/` (Flamingo Map, ASC 6839451677). Landing FAQ.
- iPad: the dock centres in the map column while the inspector is open.

## 3.0.0 (2026-11-27): the real map
- The coastline, islands, lakes and region borders are now traced from the GTADB map tiles (CC BY 4.0) by `scripts/trace-coast.py`, replacing the hand-drawn shapes. The Keys are real islands now, not ellipses.
- Pins: 41 placed from GTADB landmark positions (33 by name, 8 by town), 53 moved by a local warp from those anchors and kept on land inside their region. The interstate lines are gone until roads are traced.
- Towns (built-up areas and street grids) come from the data, not the renderers. Credits in Settings, on the landing page and in the README.

## 3.1.0 and 3.2.0 (2026-11-27)
- 3.1: 21 more pins matched to GTADB positions (neighbourhoods such as Downtown, Southside and Washington Beach by the middle of their landmarks; Brian's marina, the state prison, Allied Crystal, NINE1NINE and others by name). 62 of 94 pins are now sourced positions; 32 are still estimated. A data test checks unique ids and that every pin is on land and inside its region.
- 3.2: real streets. 1,585 street lines traced from the GTADB tiles replace the drawn street grids; they fade in once you zoom past the overview, on web and iOS.

## Road to 100
How versions work here: a major is a theme that ships on web and iOS together, a minor is one row below, a patch is a fix. A version number is only spent on something a player can see, with tests and QA screenshots in light and dark, then commit, tag, push and deploy. Numbers are given out when a version ships: if a theme is blocked (on the game, Apple or Joshua), the next unblocked theme takes its number and the blocked one moves down.

### v3 Launch data (once the game is out and sourced)
- 3.0 The real map: coast, lakes and regions traced from GTADB (done). 3.1 matched 21 more pins (32 left), 3.2 traced the streets (done).
- 3.1 Every collectible as its own pin with a found tick, not only a count.
- 3.2 Missions in real order with their givers pinned; spoilers unlock chapter by chapter.
- 3.3 Ammu-Nations, stunt jumps, shipwrecks, races, activities.
- 3.4 A data check in CI: unique ids, every pin inside its region, every pin sourced.

### v4 Plan your run
- 4.0 Routes: the shortest loop through what is left in a region (nearest neighbour plus 2-opt, on device).
- 4.1 Where am I: tap your spot, get the nearest unfinished things.
- 4.2 A 100% tracker with every category the game counts.
- 4.3 Share a route or a set of pins as a link that opens in the app.

### v5 Apple everywhere (needs Xcode 16+ and Joshua's App Store login)
- 5.0 TestFlight, then the App Store.
- 5.1 Mac: a sidebar and a wide map.
- 5.2 Widgets: story % and the next mission; a collectible counter.
- 5.3 Shortcuts and Spotlight: search places from the home screen.

### v6 Accessibility
- 6.0 VoiceOver walks the map pin by pin, with a rotor by category.
- 6.1 Dynamic Type to the largest size, with nothing clipped.
- 6.2 Category colours that work for colour blindness; an increased contrast mode.

### v7 Languages
- 7.0 Strings out of the code on both apps.
- 7.1 Spanish, Portuguese, French, German, Italian.
- 7.2 Japanese, Korean, Simplified Chinese, Russian, Polish. Search that folds each script.

### v8 Community
- 8.0 Suggest a fix or a new pin from its card. Goes to a review queue in jaybulb-api.
- 8.1 A review screen for Joshua; accepted fixes ship in the next data build with credit.
- 8.2 A changelog for each pin.

### v9 Every screen
- 9.0 Android in the Play Store (Trusted Web Activity).
- 9.1 Windows (Microsoft Store PWA).
- 9.2 Apple Watch: story % and the nearest collectible.
- 9.3 Vision Pro: the map as a window.

### v10 GTA Online (Rockstar has said 2027)
- 10.0 Properties and businesses on the map.
- 10.1 This week's events and bonuses, from the Rockstar Newswire.
- 10.2 Your Online progress next to the story's.

### v11 to v100
After v10, one major for each content drop Rockstar ships: an Online update, a story expansion or a new region, each with its pins, missions and collectibles. At several drops a year, v100 is the game's whole life. These numbers are given out as the updates are announced, never ahead of them.
