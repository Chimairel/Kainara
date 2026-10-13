# Solar Icons preview — October 13, 2026

## Branch and environment

`codex/solar-icons`, implemented in `C:\Users\chima\Desktop\Nutrimind`. The normal frontend remains `http://localhost:3000`; the actual backend remains `http://localhost:5000`. No new worktree, preview port, database change or live application release.

The preceding image upload is a separate commit shared with development. Icons remain on this experimental branch. Do not publish this branch unless the owner chooses the icon preview.

## Shared system

- Replace the application’s Lucide imports across 196 UI/type modules with `components/ui/icons`. Pin `@solar-icons/react` to 2.3.2 and remove the unused Lucide package.
- Keep 158 semantic app icon names mapped to 139 Solar assets. Use per-icon imports and pure factory exports so unused icons can be eliminated. Linear serves controls and status; LineDuotone serves navigation and context. Existing sizes/classes, SVG refs and events remain compatible.
- Preserve Kainara’s palette and component hierarchy. Inherit `currentColor`, including the caller’s selected, success, warning and error colors. Use the same secondary color at 22% opacity and a 1.7 default stroke. No arbitrary hue pairs, new decorative cards or mascot replacements.
- Solar has no equivalent glyph for every ingredient-specific symbol. Plate, leaf and chef hat are the mapped generic food symbols; adjacent labels preserve the exact dietary/ingredient meaning.
- Decorative icons remain hidden from assistive technology. Accessible action labels stay on controls; labelled SVGs retain their supplied labels. Solar Icons by 480 Design (CC BY 4.0) is credited visibly in the public footer.
- PublicHeader had pre-existing uncommitted edits. Include only its icon import in this commit; other changes remain unstaged.

Implementation follows the [Solar React guide](https://solar-icons.vercel.app/docs/v2/packages/react) and [shared-icon article](https://solar-icons.vercel.app/blog/build-consistent-icon-system-react). Color decisions follow the incumbent DESIGN.md and Impeccable Colorize guidance.

## Verification

- Frontend production build passes (65 routes/pages), with the existing separate production output directory; backend production build passes for the independent image update.
- Full frontend Vitest run: 1,049 passed; five stale assertions failed for already-approved logo, meal-title, retained-menu and homepage structured-data changes. Update those assertions without changing production behavior. The focused rerun passes all 12 tests, including three new SVG contract tests for refs/events, accessible labels, inherited color, explicit size, duotone opacity and loader classes. Eight dependency/security/service-worker Node tests pass.
- Four existing Chromium member journeys pass at 390/1440 px in both themes, retaining meal photos/logo fallback, clean titles and current menu hierarchy. Eight new intercepted Chromium staff journeys pass at the same sizes/themes: admin refresh and tab actions, RND tab selection on desktop, and the existing desktop review gate on mobile. Synthetic profiles and all API requests are intercepted; these journeys do not create accounts, change claims, log meals or write to Neon.
- Initial older staff browser fixtures used a superseded refresh-button placement and omit the current credential/mobile gates. They are not counted as passing. The new focused fixture explicitly supplies eligible synthetic RND credentials and exercises the current gates.
- New icon files/tests pass ESLint; the final Next build includes its existing lint/type gate. Source architecture budgets pass. Impeccable’s mechanical detector reports no findings on the shared icon files/footer. Visual inspection covered desktop admin and mobile RND captures; member captures preserve the same established cards. No theme/layout redesign was introduced.
- Screenshots are private under `backend/.local/meal-presentation-audit/`: `solar-admin-*`, `solar-nutritionist-*`, and the member `cloudinary-dashboard-*` captures. They show synthetic preview accounts in this same Desktop checkout on port 3000.

## Run the focused browser check

From `frontend`, with the usual dev server already running:

```powershell
$env:NUTRIMIND_REPAIR_E2E = 'true'
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3000'
npx playwright test e2e/solar-icons.spec.ts --workers=1
```

Normal application data and local/live database routing are unchanged. Uploaded images exist in Cloudinary, but publishing their latest application mappings and publishing this icon preview are separate release decisions.

## Two-color revision requested by the owner

The original same-color LineDuotone preview did not match the owner's reference. Replace context/navigation assets with BoldDuotone from the same pinned package. Keep Linear for small controls and semantic statuses.

- Shared secondary layer: theme terracotta at 65%; explicit caller colors and status meanings remain intact.
- Dark sidebar: cream primary details plus peach secondary shapes. Orange selected navigation: dark pine primary details plus cream secondary shapes at 85%.
- Light/dark mobile navigation and tab rails: existing theme green when inactive; fixed dark pine when selected on orange.
- White secondary actions use light-theme pine in either theme. No new icon containers or changes to cards/layouts.
- Expose `secondaryColor` and `secondaryOpacity` alongside normal SVG `color`; customize at the shared boundary rather than editing paths. Theme overrides are scoped CSS variables.

Verification: TypeScript and scoped ESLint pass; four icon contract tests pass, including independent color customization, refs/events and retained spinner behavior. Browser checks use the actual port 3000 and intercepted synthetic member/admin/RND data, never real account mutations. The initial batch found a mobile selection specificity defect; the confirmation batch passes all 12 journeys after the correction. Keep the cream/peach override scoped to the desktop portal rail, not unrelated document/queue asides. Screenshots remain in the private local audit folder. Live application and database are unchanged.

## Filled icons throughout the shared interface

The owner subsequently requested filled shapes for controls as well. This supersedes the earlier choice to keep Linear controls. All 158 shared app symbols now use BoldDuotone or solid Bold; rename the former linear map to `icons/filled.ts`. Search, history, filters, review tools, disclosure arrows and utility controls receive filled Solar assets. Status/error/check symbols and rotating loaders use solid Bold in their existing semantic foreground colors. The shared inline LoadingSpinner also uses Solar instead of its custom outline circles, retaining its dimensions, loading-bar registration and accessible status text.

Source tracing found no remaining imports from Solar Linear, LineDuotone or Outline, Lucide, Heroicons or React Icons. Remaining authored SVGs are logos, avatars, charts and existing illustrated/loading artwork, rather than shared interface glyphs.

TypeScript, scoped ESLint and all four icon contract tests pass. All 12 local browser journeys pass and now explicitly reject outline Solar classes in member, admin and RND views, in both themes at 390/1440px. Existing action labels, dimensions, events, recipe images and layout remain covered. All API test data is intercepted; no database or deployment changes.

## Owner-selected palette, notifications and grocery dropdown

After previewing the pine/sage alternative, the owner selected `#efb48a` and `#f7a249`. Use opaque apricot (`#f7a249`) primary details and peach (`#efb48a`) secondary filled shapes consistently in both themes, including sidebar, account menus and selected actions. The icon palette remains separate from unchanged text, focus and action/selection surfaces. SVG primary color resolves the shared token explicitly, so caller utility classes cannot accidentally wash icons out; explicit `color` and secondary props still customize individual icons. These pale decorative colors do not establish a universal 3:1 icon contrast claim on light/orange surfaces; controls retain their existing labels, accessible names and focus indicators.

Notification header and row icons use 24px SVGs, with 32px for the empty state. Remove their colored border/background wrappers, while retaining unread indicators, accessible labels, focus rings and click/read actions. The grocery filter was rendering an additional chevron outside Dropdown even though Dropdown delegates to the same Select as Weight Progress; remove the redundant chevron and obsolete overlaid filter icon/padding. Trace found no other Dropdown/Select callers with the same duplicate-chevron overlay.

TypeScript, scoped ESLint and 18 focused notification/select/icon tests pass. Browser coverage now also checks grocery filtering with exactly one arrow, notification icon size/transparent borderless wrappers and account-menu colors, at desktop/mobile in both themes using synthetic intercepted API data. Initial inspection found dark utility classes overriding the account icon colors; resolve them at the shared icon boundary. The deliberately unavailable image fixture now receives an explicit intercepted 404 for deterministic image-error coverage. No real account, database or hosted application mutations.

Final owner-selected palette verification: all four member browser journeys pass at 390px and 1440px in light/dark on localhost:3000. Screenshots confirm the exact opaque color pair, unboxed notifications and single dropdown arrow. Scoped ESLint passes. Earlier 18 focused unit tests and eight staff journeys passed for the same component behavior before the final color-only change.
