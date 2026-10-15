# Nara default — member chatbot

Created October 16, 2026 with the built-in image generation tool and the installed [page-mascot](https://koboyo.com/page-mascot) skill. Both image calls used `transparent_background: true`. This is an everyday clothing variant of the existing Nara artwork, not a new catalogue character.

## Sources and generation

- Identity references inspected before generation: `../nara-tanod/directions.png`, `../nara-tanod/reactions.png` and their README. Preserve warm skin, large dark teal eyes/catchlights, face proportions, swept bangs, compact dark teal bun, blush and cyan/yellow/coral hair accents.
- `directions.png`: accepted first directions generation, 1254 × 1254 RGBA. Referenced both original sheets. Prompt requested the same polished chibi style, with the cap/uniform removed and replaced by a cream crew-neck top/deep teal casual cardigan. Nine viewer-relative head turns, identical front-facing neck/shoulders, head/upper shoulders only, generous gutters, no hands/props/text/shadow/backdrop.
- Reactions attempt one referenced the accepted default directions and both original identity sheets. Rejected after screening found row-boundary contacts, even though packed metrics passed. It is not shipped. Original generated output remains at `C:\Users\chima\.codex\generated_images\01a1418e-f3f1-75a1-ba45-37e80a18cad9\exec-0c42e350-4369-4a61-a822-21ab35765b49.png` locally.
- `reactions-generated.png`: unchanged second reaction generation, 1265 × 1243 RGBA. Referenced the accepted default directions plus original tanod reactions. Prompt repeated Nara's identity/outfit and required very small busts with 25% transparent gutters, identical bodies and the exact nine expression order. The generator still returned unequal row spacing on a rectangular canvas; every drawing was intact and isolated by transparent gaps.
- `normalize-reactions.py` translates those intact rows into an equal square 3×3 canvas without resizing or redrawing the art. `reactions.png` is the resulting 1266 × 1266 source sheet. Both raw and normalized sources are preserved. One directions attempt and two reactions attempts total; no further image retries.

Directions: up-left / up / up-right; left / front / right; down-left / down / down-right. Left and right mean the viewer's directions.

Reactions: blink / heart / sparkle; surprised / starstruck / bashful; sleepy / spiral-eyed dizzy / delighted with an open smiling mouth. The existing runtime calls the starstruck cell `wink`; mappings are unchanged.

## Build and evidence

From `frontend`, using Python with Pillow, NumPy and SciPy:

```powershell
python characters/nara-default/normalize-reactions.py
python C:/Users/chima/.codex/skills/page-mascot/scripts/mascot.py nara-default --skip-generate
python characters/nara-default/inspect-portraits.py
```

Tooling packages were installed outside the repository at `C:\Users\chima\.codex\scratch\nara-default-python`; set `PYTHONPATH` to that directory when using this machine's default Python. No application dependency was added.

The skill builds `public/mascots/nara-default-directions.webp` and `nara-default-reactions.webp`, each 1080 × 1080 with real alpha. [Packing output](packing-verification.txt): source alpha passes, no edge contacts on either sheet, direction shoulder spread 2.7%, reaction shoulder spread 1.6%; 0.00 rendered px vertical shift at 140 px, 86.2% palette agreement, 5.4% shoulder-width difference, 70.8% minimum body-band overlap. These are measured alignment checks, not proof of pixel-identical faces or bodies.

Local visual inspection covered [all eighteen cells](verification/atlas-contact.png), [viewer-left/right crops](verification/viewer-left-right.png), the [front/blink alignment overlay](verification/alignment-overlay.png), and [32/40/48/88 px portraits on light/dark backgrounds](verification/portrait-sizes.png). All nine expressions remain recognizable, especially the open-mouth smile and spiral eyes. [Framing measurements](verification/framing.json) find zero clipped pixels above alpha 40 in every frame at the portrait's 1.2× scale. The previews use Pillow compositing; they are not browser screenshots. Normal generated variation remains in head contour/bun placement and shoulder detail; the body-width change is 5.4%, not zero. The skill's bottom-edge fade is retained.

## Integration and checks

`src/features/member-assistant/NaraPortrait.tsx` references this variant locally. Its viewport sizes remain unchanged, and its inner scale changes from 1.7× to 1.2× to fit the new atlas geometry. Existing launcher drop shadow stays in CSS. The shared `NaraSprite.jsx` runtime/license, auth asset paths, launcher, conversation, composer, session, command and credit logic are unchanged by this variant.

Checks on October 16, 2026:

- `npx vitest run src/features/member-assistant`: **82 tests pass in 8 files**, including ten new portrait/asset checks and existing pointer-follow, thinking cadence, hidden-tab, reduced-motion, tooltip, failure/credit, composer, command and session regressions. jsdom reports its existing unimplemented document-navigation notices.
- `npx tsc --noEmit --incremental false`: passes.
- `npx eslint src/features/member-assistant/NaraPortrait.tsx src/features/member-assistant/nara-portrait.test.tsx`: passes.
- Impeccable detector on `NaraPortrait.tsx`: `[]` (no findings).

Fresh browser verification was not performed because of the prior browser access-policy rejection. No alternate automation route was used. The shared frontend production build was deliberately not run during concurrent editing. No push, deployment, database or environment changes.
