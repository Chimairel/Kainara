# Mobile assets

- `kainara-icon.png`: unmodified copy of the existing KAINARA
  `frontend/public/icons/icon-512.png` at the migration baseline.
- `sleeping-nara.ts`: the committed KAINARA `frontend/public/logo/sleeping-light.svg`
  at `e8c4c764`, decoded from UTF-16 and represented as a string for React Native
  SVG rendering. No character redesign or generated illustration.
- Other PNGs in this directory are unmodified Expo blank-typescript template
  artwork. They are not referenced by the app configuration or member screens.
- Food images are API-provided assets. Preserve the API image description and
  attribution; do not infer that a representative photo depicts the logged food.
- `nara-default-directions.webp`: unchanged copy of the existing web Nara default
  3×3 atlas at `7dfbbc7f`. The native portrait displays its center cell using a
  clipped image viewport; the character is not redrawn.
- `fonts/`: unchanged DM Sans, Outfit and JetBrains Mono variable TrueType files
  from `frontend/src/app/fonts/` at `7dfbbc7f`, with their adjacent SIL Open Font
  License files. The web font README records the official Google Fonts sources.
