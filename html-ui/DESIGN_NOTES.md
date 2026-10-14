# KAINARA export: current design evidence

## Source and scope

This export captures the established app in **`C:/Users/chima/Desktop/Nutrimind`**, not the older worktree. The source commit is `29da350e4fdcb670a631b1c745c9eee037c70f0b`, including existing working-tree changes. `manifest.json` and `verification/source-fingerprints.json` identify the capture. The 46 screens plus index reproduce that frontend with synthetic demo data; no design-system replacement or application-source edits were made.

## Colors and typography

The current palette uses warm ivory, forest spruce, jade and terracotta. Core values from the Desktop `frontend/src/app/globals.css`:

| Token | Light | Dark |
| --- | --- | --- |
| `--brand-bg` | `#faf8f5` | `#071914` |
| `--brand-bg-alt` | `#f3efe8` | `#0b231c` |
| `--brand-surface` | `#ffffff` | `#0e271f` |
| `--brand-border` | `#dce4e0` | `#173e33` |
| `--brand-text` | `#0d2820` | `#eff8f3` |
| `--brand-muted` | `#5a746a` | `#8ea99f` |
| `--brand-green` | `#08705b` | `#10b981` |
| `--brand-accent` | `#eb6a38` | `#eb6a38` |
| `--brand-accent-soft` | `#f09e6c` | `#f09e6c` |
| `--brand-cyan` | `#18b9d2` | `#38bdf8` |
| `--sidebar-active` | `#eb6a38` | `#eb6a38` |

The permanently dark intake card uses `#0e271f` with a `#1b4e41` radial accent, light text, jade protein, sky-blue carbs and terracotta fat. Dashboard meal cards retain the source meal-type gradients: terracotta breakfast, emerald lunch, indigo dinner and coral snack. Pending status colors are terracotta/peach. Historic lime-primary descriptions do not apply to this Desktop capture; isolated literal colors in source effects are preserved rather than standardized.

Root layout uses **bundled local fonts**: DM Sans (300–700) for body text, Outfit (300–900) for display, Plus Jakarta Sans (400–800) in the display fallback stack, and JetBrains Mono (400–700) for mono. The export embeds the rendered font files as data URLs in `@font-face`. Dashboard menu headings use 24px bold display text; principal numeric figures use 24px. Exact page utilities and the existing CSS cascade remain authoritative.

## Layout and components

The member workspace retains its fixed-height shell, independently scrolling main panel and floating dark sidebar. At 768px it gains 16px outer padding and 16px separation before the main column. Expanded sidebar width is 248px with 30px corners; mobile hides it in favor of bottom navigation. Portal content is centered within 76rem, with desktop padding `1.5rem 2rem 3rem` and final mobile padding 1rem.

The dashboard retains a 20px gap and, from 1280px, `minmax(360px,1fr) minmax(0,1.4fr)` columns. Main-card padding is 20px, increasing to 24px at 640px. Tailwind's custom `xl`, `2xl`, `3xl` radii are 14px, 20px and 24px. Borders, shadows, organic card decorations and source responsive rules are retained.

Authentication retains the **Bahay Kubo, capstone-team window photograph and Nara mascot** scene. Icons come from the source Solar icon wrappers and remain inline SVG. Numbers become editable text; native SVG gauges/charts remain vectors.

## Static capture constraints

Each HTML includes all CSS, fonts, images and its local preview script. Rendering needs only that file, including when JavaScript and network are disabled. External links only navigate. Demo records are fixed snapshots; preview interactions do not persist clinical or account changes.

Canvas-rendered visuals and mascot poses are frozen embedded raster captures. Video is represented by an embedded capture of its visible frame. These preserve the Desktop capture appearance rather than live movement, pointer tracking, pan/zoom or playback. Desktop-captured raster visuals can scale on mobile, but cannot recreate responsive canvas drawing or new animation poses. Form values and selected states are captured; React state machines are absent.

`?figma=1` adds the root `figma-export` class. Add that class directly when importing with JavaScript disabled. It expands scrolling content and reflows review-canvas sheets into an importable layout. This differs deliberately from the ordinary app viewport. The embedded preview CSS also adds selection/focus handling, a local toast and preserves the source headline gradient when CSSOM serialization drops its shorthand.

## Evidence and limits

Checked the Desktop globals, root/member layouts, Tailwind configuration, Sidebar, CockpitDashboard, meal-theme configuration, AuthHeroPanel/AuthMascot, icon/font provenance, exporter/templates, manifest, fingerprints and verification report. All seven recorded source-file hashes match the current Desktop files. Representative dashboard/auth/landing HTML contains embedded style blocks, fonts and images, no external script, and no remaining canvas element.

The final report dated 2026-10-14 06:41:40 UTC records 96 checks with no failures, including isolated offline rendering, JavaScript-disabled dashboard and full-content mode. The final browser pass also verifies visible landing reveal content and loaded meal counts; it does not establish pixel equality for every state. Use the adjacent source/export screenshots to review visual fidelity. No root design/context files or application source were modified.
