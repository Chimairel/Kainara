# Shared workspace UI

Use these components before copying markup from another page. Role authorization, eligibility, claim state and mutation handling belong in the caller.

| Presentation | Component | Existing examples |
| --- | --- | --- |
| Default surface | `ui/Card` | Membership statistics/calendar, progress, settings |
| Curved stripes and logo | `ui/CardDecoration` or Card decoration props | Membership, dashboard, reports, grocery |
| Queue/history with detail pane | `shared/SplitWorkspace`, `WorkspaceListPane` | Nutritionist cases, nutrition guidance |
| Controlled dropdown | `ui/Select`, `ui/Dropdown` | Progress period, meal/report/review filters |
| Required or uncontrolled form select | `ui/NativeSelect` | Admin authoring and reference-data forms |
| Plan/library meal tile | `user/MealCardPresentation` (`MealTile`, `MealMacros`) | MealCard, PendingMealPreviewCard, RecipeLibraryCard |
| Compact meal presentation | `MealPlate`, `compactMealClasses`, `MealMacros` | Dashboard rows, food history, swap comparison |
| Meal library grid | `shared/MealLibraryLayout` | Member, nutritionist and admin libraries |
| Tabs or section links | `ui/WorkspaceTabs` | Meals, progress, reviews, settings, admin audit |
| Password field | `ui/PasswordInput` | Authentication and profile security |
| Pagination | `ui/Pagination` | All three role libraries |

## Cards

Card keeps both its existing header/footer props and compound CardHeader/CardContent/CardFooter API. It has the Plan Statistics surface shape, border and shadow. Keep a page's existing padding by passing its padding classes or `contentClassName`.

Decorations are optional: `none` (default), `stripes`, `logo`, `both`, or `varied`. Use `varied` with a stable `decorationSeed` such as a card or record ID. A seed picks one of the four variants, including no decoration. This varies cards without hydration differences or flickering on rerenders; don't call Math.random during render. Decorations are hidden from assistive technology and print, and cannot intercept clicks.

## Dropdowns and tabs

Select accepts `{value,label,disabled}` options and a string onChange. Dropdown adapts existing option children to the same menu. Menus use a portal so card overflow doesn't cut them off, reposition on scroll/resize, and support keyboard selection and Escape. Keep NativeSelect for a form that needs browser required validation, FormData, or defaultValue.

WorkspaceTabs accepts items with value, label, optional icon/count and optional href. Use href for navigation so browser links, new tabs and back navigation work. Use onChange for switching local panels. Each instance owns its animation identifier. Continue hiding or unmounting inactive content in the caller.

PasswordInput uses Input's trailingControl slot; never position a visibility button against the label or full field group. Its 44 px button is centered on the actual input and remains keyboard accessible.

## Meals and libraries

MealTile owns the shared curved image, slot theme and frame. MealCard, PendingMealPreviewCard and RecipeLibraryCard provide their specific status badges, body details and actions. Compact rows reuse MealPlate and macro formatting. Shared presentation never implies that a library recipe is approved for a particular member.

MealLibraryLayout is only the grid. Member catalogue requests use useRecipeCatalog, scoped to owner, search, filters and page; staff use their existing role endpoints and account-scoped cache. Both use Pagination. Do not identify recipes by display name, or slice the first API page as if it contains the whole library. Cursor-based compatible pages advance only once the next batch arrives.

## Landing links

SectionLink scrolls a same-page public section without writing a URL hash. Its real href remains available for modified clicks, copied links and cross-page navigation.
