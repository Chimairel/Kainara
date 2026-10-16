# Nara VA — Help / Contact Support

Created October 16, 2026 with the built-in image generation tool in edit mode and real transparency enabled. The original `../nara-tanod/directions.png` and `../nara-tanod/reactions.png` were both inspected and used as identity references. Accepted VA directions then anchored matching reactions. [Exact prompts and correction history](prompts.md) are retained.

Nara keeps her warm skin, large dark teal eyes, catchlights, compact dark teal bun, side-swept bangs and cyan/yellow/coral hair accents. Her support outfit is a cream collared blouse, deep teal blazer and headset/microphone. There is no TANOD cap/uniform, medical coat, badge, held prop or added professional credential. Visual identity was assessed locally; image generation does not guarantee identical facial pixels.

## Assets and mapping

- `directions.png` and `reactions.png`: final RGBA source sheets, each 1254 × 1254.
- `../../public/mascots/nara-va-directions.webp` and `nara-va-reactions.webp`: packed 1080 × 1080 atlases, 360 px per tile.
- Directions in viewer order: up-left / up / up-right; left / front / right; down-left / down / down-right.
- Reactions: blink / heart / sparkle; surprised / starstruck (runtime name `wink`) / bashful; sleepy / spiral-eyed dizzy / delighted with an open smiling mouth.

The source files are preserved so packing needs no further generation. No runtime image-generation request, external mascot fetch, package change or chat API was added. The existing MIT-attributed `src/components/auth/NaraSprite.jsx` renderer and its license remain unchanged.

## Help integration

`src/components/shared/SupportMascot.tsx` reuses that renderer for pointer following, keyboard/touch boops and four-quick-click dizzy reactions. Mouse hover selects delighted; pointer-down/keyboard activation releases hover so it cannot hide click reactions. Live reduced-motion changes switch to a static center portrait and remove the interactive renderer. The illustration does not read form content.

`SupportContact.tsx` uses VA in both the existing 1024 px desktop scene canvas and 160 px mobile title decoration. `AuthHeroPanel.tsx` accepts optional `mascot` and `mascotAssets` props, including matching preload/decode readiness. Its default TANOD art, house/photo composition, scene controls and theme toggle are retained. Support submission, authentication, validation, abort and idempotency handlers are unchanged. The headset is decorative; the form remains a support request rather than a live chat.

## Verification

The installed page-mascot screening, shoulder-anchor packing and verification scripts passed. [Packing output](verification/packing.txt):

- Both sheets have real alpha and no detected cell-edge contact.
- Directions shoulder spread 4.3% (script calls this marginal, within its accepted <8% bound); shoulders/head 0.90.
- Cross-sheet fit overlap 95.6%; verification overlap 86.2%.
- Measured vertical body shift 0.00 px at a 140 px canvas; palette match 82.4%; shoulder-width difference 0.9%.
- Independent [source checks](verification/source-checks.json) inspect all four cell margins. The tightest opaque source margin is 5 px; packed frames have clear gutters. No image was accepted solely from a passing alignment number: two expressions framing attempts were rejected before a final spacing edit removed the top-row bleed.

Inspected the packed [light](verification/contact-light-160.png) and [dark](verification/contact-dark-160.png) contact sheets at the mobile 160 px canvas size, all expressions and directions, [viewer-left/right crops](verification/viewer-left-right.png), and a [front/blink overlay](verification/front-blink-overlay.png). Left/right face the correct viewer direction. The body remains visually planted; the face and clothing are consistent across expressions. Minor illustration limitation: bun/ribbon positioning differs between upper-right and other right-facing angles, as in the original direction reference. The inherited builder's soft bottom fade is visible on light backgrounds. Desktop enlargement can soften raster detail.

Twelve scoped DOM tests passed across `SupportMascot.test.tsx`, `SupportMascotHero.test.tsx`, existing `SupportContact.test.tsx` and `AuthShell.test.tsx`. Coverage includes all eight pointer sectors, open-mouth hover, four-click spiral reaction, Enter activation without form submission, live reduced-motion changes/listener cleanup, both Help asset hookups, unchanged TANOD defaults, decode failure recovery, and existing support authentication/draft/duplicate-send/account-change behavior. Frontend TypeScript and scoped ESLint passed; Impeccable detector returned `[]` for changed UI targets. React review checked hook cleanup, local asset loading, native button semantics, accessible names and preserved form boundaries.

Fresh browser/screenshots and actual desktop/mobile layout interaction were not verified: prior browser access was rejected, and no alternate automation route was used. These images are local atlas composites, not browser captures. A shared frontend production build was intentionally omitted under the task's concurrent-edit restriction. No deployment, push, database or environment change was performed.

## Rebuild

From `frontend`, using Python with Pillow, NumPy and SciPy:

```text
python <page-mascot-skill>/scripts/mascot.py nara-va --skip-generate
python characters/nara-va/verify-assets.py
npx vitest run src/components/shared/SupportMascot.test.tsx src/components/shared/SupportMascotHero.test.tsx src/components/shared/SupportContact.test.tsx src/components/auth/AuthShell.test.tsx
npx tsc --noEmit --incremental false
```

`verify-assets.py` creates inspection composites and source metrics only; it does not edit either source sheet or served atlas.
