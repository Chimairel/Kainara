# Embedded asset provenance

The standalone HTML files reuse assets displayed by the **Desktop Nutrimind checkout**. This export generated no new photographs or AI artwork. Images and font resources are embedded as data URLs; each page renders without an asset folder or external service. Original source metadata remains in the repository.

## Repository artwork and captures

KAINARA logos, Bahay Kubo artwork, capstone-team photograph, Nara sprites, meal imagery and public-page artwork come from `frontend/public/` and the rendered frontend. The authentication scene is defined in `frontend/src/components/auth/AuthHeroPanel.tsx`, using `photos/capstone-team-window-right.png`, `icons/bahay-kubo.svg` and the Nara assets named by `AuthMascot.tsx`. Existing canvas/mascot visuals are frozen as images and existing captured video frames are embedded. This export does not assign a new license to repository artwork or photographs.

Verification PNGs are local captures of the source/export with synthetic account fixtures. Public artwork and photographs are original repository content, not synthetic identities generated for this export.

The landing diagonal meal display is a browser capture of the existing photo collage, embedded directly in `index.html` at desktop/tablet/mobile sizes. It preserves the source photographs and captions as static artwork; the original photo provenance still applies.

## Reviewed meal photographs

Canonical per-image metadata: `frontend/src/components/user/reviewed-meal-images.ts`, `docs/meal-images/generated/approved-meal-images.csv` and `docs/meal-images/`. These describe representative photographs, resized and cropped for display:

| Photograph | Creator | License |
| --- | --- | --- |
| Egg and rice | PaulGorduiz106 | CC BY-SA 4.0 |
| Pandesal | Jessartcam | CC BY-SA 4.0 |
| Oatmeal | Renee Comet | Public domain |
| Beef, pork, tuna and tofu bowls | Andy Li | CC0 |

Exact source-page and license URLs and modification notes remain in the canonical metadata. Preserve them when reusing the embedded photographs. A representative photograph does not certify that it depicts the demo recipe exactly. Existing recipe-catalogue image/source history is also recorded in `docs/meal-images/audit-2026-10-13/`; embedding a displayed resource does not change its attribution or rights.

## Fonts and icons

DM Sans, Outfit, Plus Jakarta Sans and JetBrains Mono originate from the bundled local variable fonts in `frontend/src/app/fonts/`. Its `README.md` records the official Google Fonts repository sources and October 5, 2026 acquisition. Each family has an adjacent **SIL Open Font License** file (`*-OFL.txt`). The root layout uses `next/font/local`; the export embeds the locally generated font resource bytes.

Solar SVG icons come from the existing `@solar-icons/react` 2.3.2 dependency through `frontend/src/components/ui/icons`. The package code is MIT; its `LICENSE-THIRD-PARTY` credits the **Solar Icons Set by 480 Design**, under **CC BY 4.0**. Retain that attribution and the package license notices when distributing the exported icons. Other custom SVG artwork remains attributable to its repository source.

These notes and source license/attribution records accompany reuse; they are documentation, not rendering dependencies.
