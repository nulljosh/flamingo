# Flamingo loop handoff (2026-11-24)

The `/loop` builds Flamingo toward an A+ landing page and app: web and iOS first, then Mac and iPad. Every step must pass `node --test tests/search.test.mjs`, `node tests/qa.mjs` and `node tests/landing.mjs`, and the screenshots get a look by eye. Then commit, push and deploy.

## Where things stand
- Web app and landing page are built. The local QA passes: 28 app checks and 4 landing checks.
- Not yet published: the GitHub repo and the Cloudflare deploy are waiting on Joshua's go-ahead.
- iOS: not started (roadmap step 1).

## Next
See `roadmap.md`.

## Restart prompt
```
/loop until A+ quality landing page and project: Flamingo, the GTA VI map (~/Documents/Josh/Code/flamingo). Web and iOS first, then Mac and iPad. QA with screenshots as proof, use them in the landing page styled like Keyrate.
```
