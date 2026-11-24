# Flamingo brand

The live kit is at flamingo.jaybulb.com/brand/. This file keeps the rules.

## Logo
- The icon is a white map pin on a pink tile. It holds a sunset: sun yellow to pink, with three white stripes under the horizon. No text, no game art, never "GTA".
- `mark.svg` is the one-colour mark (`currentColor`): pink on white, white on black, or white on pink.
- Wordmark: the mark, then "Flamingo" in Flamingo Sans Bold, tracking −3.5%.
- Clear space is the width of the pin's head. Smallest size is 16 px.

## Colour
- Flamingo pink `#ff2d55` (dark `#ff375f`) is the only accent. Use `#d70f3c` / `#ff6482` for small pink text.
- Sunset gradient: `#ffcc00 → #ff9500 → #ff2d55`. It appears in the icon only.
- Neutrals are white and cool greys (Apple system). Never beige, sand or warm paper, and never purple.
- Map: water `#cfe2f0`, land `#f7f8f9`, forest `#d4ebcb`, wetland `#d2ece6`, farmland `#e4f0d2`, city `#e8ebef` (see `tokens.css` for dark).
- Categories and regions use Apple system colours, one per thing, defined in `scripts/build-data.mjs`.

## Type
- The site uses Flamingo Sans (Inter, OFL, the same cut as Keyrate). The apps use SF Pro.
- Sizes: 72 hero, 34 large title, 24 card title, 17 body, 15 subhead, 13 section header in caps, 12 region labels in caps with +14% tracking.

## Glass
- Only the chrome floats: chips, the dock, map controls and region cards. Content is never glass.
- Web: `blur(22px) saturate(190%)` with a bright top rim. SwiftUI: `.glassEffect(.regular.interactive())` on iOS 26, `.regularMaterial` before.
- Use an 8 pt grid, 16 pt margins and 44 pt hit areas. Radii are 12, 16, 24 and 32, and capsules.

## Voice
Keep it plain and short. Be honest about the data (confirmed, seen, fan theory). No spoilers by default. Always say it is unofficial.
