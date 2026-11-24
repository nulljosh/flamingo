# Flamingo loop handoff (2026-11-24)

The `/loop` builds Flamingo toward an A+ landing page and app: web and iOS first, then Mac and iPad. Every step must pass `node --test tests/search.test.mjs`, `node tests/qa.mjs` and `node tests/landing.mjs`, and the screenshots get a look by eye. Then commit, push and deploy.

## Where things stand
- Web app and landing page are live at flamingo.jaybulb.com (Cloudflare Worker `flamingo`). QA passes: 28 app checks and 4 landing checks, against both local and live.
- The iPhone and iPad SwiftUI app (`apple/`) builds on Xcode 15.2. `scripts/ios-shots.sh` takes 10 simulator screenshots, and the landing page shows 3 of them.
- GitHub: the public repo nulljosh/flamingo was not created. The auto-mode classifier blocked `gh repo create`, so commits are local only. Joshua needs to OK it or run it himself.

## Next
See `roadmap.md`.

## Restart prompt
```
/loop until A+ quality landing page and project: Flamingo, the GTA VI map (~/Documents/Josh/Code/flamingo). Web and iOS first, then Mac and iPad. QA with screenshots as proof, use them in the landing page styled like Keyrate.
```
