# KAINARA standalone HTML UI for Figma

The pages use a **flat, static prototype presentation** for import: animations are disabled, the landing spotlight is upright with a simple dashboard preview instead of video, and decorative depth effects are reduced. The diagonal meal artwork stays as an embedded image. Every page still contains its own complete CSS and images; no supporting files are required.

The **46 screens and states** in this folder reproduce the current frontend from `C:/Users/chima/Desktop/Nutrimind`. [screens.html](screens.html) is the screen index. Each page is one self-contained HTML file: styles, fonts, images, inline SVG icons and the local preview script are embedded. No server, installation, network connection or supporting folders are needed to render a page.

## Import a page

1. Open `screens.html` to choose a page, or open the desired HTML directly.
2. Give that single HTML file, or its complete contents, to your HTML → Figma script/importer. You can copy it alone to another folder.
3. Use **1440 × 1000** for the desktop reference or **390 × 1000** for mobile.

Text remains editable HTML. Inline SVG icons and SVG charts can remain vectors where the importer supports them. Photographs, mascot/canvas captures and captured video frames are embedded images. The landing page's diagonal meal collage is also a static image embedded directly in `index.html`, with desktop/tablet/mobile captures. This preserves its perspective and soft edges when Figma drops CSS transforms or masks; the collage's meal captions are part of that image. The headline, body copy and buttons remain HTML. Font matching and layer conversion depend on the importer.

For the full scrolling workspace, open a page with **`?figma=1`**, such as `dashboard.html?figma=1`. With JavaScript disabled, add **`figma-export`** to the root `<html>` class before importing. This exposes the full content rather than the ordinary fixed-height app viewport. It also arranges the nutritionist review sheets for import; it does not preserve interactive canvas pan/zoom.

Sibling HTML files are needed only to follow local navigation links. External source links are navigation, not rendering dependencies. Alt + S and All tools open the index when it is alongside the page.

## Coverage and preview behavior

Included areas: public/authentication, six onboarding steps, member dashboard/meals/groceries/progress/profile/reports/export, nutritionist review/library/profile states, and administrator accounts/data/meals/overview. Source-route mappings are in [manifest.json](manifest.json).

Current consolidated destinations are preserved: Sources uses `/docs#data-sources`; nutritionist onboarding uses the Users **RNDs** tab; Analytics uses the administrator overview. `profile-clinical-evidence.html` and `admin-meals.html` are included.

Account text, credentials, nutrition figures and totals are **synthetic demo fixtures**, fixed around October 14, 2026. The exported fixture snapshot is immutable; selected preview controls can change local presentation or navigate without updating fixture files. Public artwork comes from the existing repository. No live authentication, account changes, generation, clinical decisions or backend requests occur. Reset password shows the captured invalid-link state. Rich selectors and React interactions are static states.

## Source and verification

The exporter uses the shared **Desktop checkout**, previewed on port **3200**. [manifest.json](manifest.json) records its directory, commit and working-tree status; [source-fingerprints.json](verification/source-fingerprints.json) records hashes of key source files. Existing uncommitted source changes are included. This documentation update did not alter the app source.

The report dated **2026-10-15 12:40:54 UTC** records **96 checks with no failures**: 46 pages plus the index, each copied alone into a temporary directory and rendered offline at desktop/mobile widths, plus JavaScript-disabled dashboard and full-content checks. See [verification/report.json](verification/report.json) and adjacent reference screenshots. These checks cover the exported design artifact, not live backend behavior or universal pixel equality.

Regeneration requires the Desktop frontend dependencies, Playwright Chromium and its port-3200 preview. The exporter, index builder, finalizer and verifier are in `scripts/`; embedded preview templates are in `scripts/templates/`. They are maintenance files, not page dependencies. See [DESIGN_NOTES.md](DESIGN_NOTES.md) and [ASSET_CREDITS.md](ASSET_CREDITS.md).
