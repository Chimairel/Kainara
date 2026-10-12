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
