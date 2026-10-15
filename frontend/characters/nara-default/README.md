# Nara default — member chatbot

Current outfit: a plain solid green crew-neck T-shirt, requested October 16, 2026. The cream top and teal cardigan from commit `8935de64` are superseded.

## Sources and edit

The built-in image generation tool edited the existing Nara sheets with `transparent_background: true`. The directions edit referenced the previous default directions; the reactions edit referenced the previous default reactions and the accepted green-tee directions. One image call per sheet, with no retries.

The prompts requested a clothing-only replacement: one plain green tee (base color reference `#16A34A`, with normal illustration shading), no cardigan, cream collar, lettering, logo or pattern. Preserve Nara's warm skin, face proportions, large dark teal eyes/catchlights, blush, swept bangs, compact bun and cyan/yellow/coral hair accents. Retain all head directions, front-facing torsos, reactions, transparent gutters and upper-shoulder framing.

- `directions.png` and `reactions.png`: current accepted green-tee sources, both 1254 × 1254 RGBA, directly copied from the image tool. No geometry normalization was required for this revision.
- Served assets: `../../public/mascots/nara-default-directions.webp` and `nara-default-reactions.webp`, each 1080 × 1080 with alpha.
- `reactions-generated.png` and `normalize-reactions.py` are historical artifacts from the first cardigan variant. **Do not run the old normalizer over the current green-tee source.** Initial sources and evidence are recoverable from commit `8935de64`.

Directions remain viewer-relative: up-left / up / up-right; left / front / right; down-left / down / down-right. Reactions remain blink / heart / sparkle; surprised / starstruck / bashful; sleepy / spiral-eyed dizzy / delighted with an open smiling mouth. The unchanged runtime calls the starstruck cell `wink`.

## Rebuild

From `frontend`, using Python with Pillow, NumPy and SciPy:

```powershell
python C:/Users/chima/.codex/skills/page-mascot/scripts/mascot.py nara-default --skip-generate
python characters/nara-default/inspect-portraits.py
```

On this machine, the isolated tool packages are at `C:\Users\chima\.codex\scratch\nara-default-python`; set `PYTHONPATH` to that directory when using the default Python. No app dependency was added. The workflow uses the installed [page-mascot skill](https://koboyo.com/page-mascot), including its screening, packing and verification scripts.

## Current verification — October 16, 2026

[Packing output](packing-verification.txt): both sources have real alpha and no cell-edge contacts. Shoulder spread is 2.7% in both sheets. Packed vertical shift is 0.00 rendered px at 140 px, palette agreement 76.7%, shoulder-width difference 4.7%, minimum body-band overlap 70.9%. These measurements do not imply pixel-identical artwork.

Local inspection covers [all eighteen cells](verification/atlas-contact.png), [viewer-left/right crops](verification/viewer-left-right.png), [front/blink alignment](verification/alignment-overlay.png), and [32/40/48/88 px previews on light/dark backgrounds](verification/portrait-sizes.png). The plain green tee is present throughout; the smiling hover mouth and spiral eyes remain recognizable. [Framing measurements](verification/framing.json) find zero clipped pixels above alpha 40 in every frame at the existing 1.2× portrait scale. The skill's bottom fade is retained. Generated contour/bun and shoulder-detail variation remains; measured shoulder-width difference is 4.7%.

`npx vitest run src/features/member-assistant/nara-portrait.test.tsx src/features/member-assistant/nara-chat.test.tsx`: **18 tests pass in 2 files**, covering local alpha WebP assets, portrait dimensions, all moods, pointer-follow, thinking cadence, hidden-tab/reduced-motion behavior, hover greetings and failure/credit reactions.

The existing `NaraPortrait.tsx` already references these asset paths, so no runtime or component code changed in this revision. The unchanged launcher keeps its transparent 88 px portrait and CSS shadow. Prior complete member-assistant checks (82 tests, TypeScript, scoped lint and design detector) passed for the initial integration in `8935de64`.

The previews use Pillow compositing and are not browser screenshots. Fresh browser verification remains unavailable under the earlier access-policy rejection; no alternate automation route was used. No shared production build, push, deployment, database or environment change was performed.
