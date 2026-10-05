# Shared workspace UI

Use these components before copying markup from another page. Role authorization, eligibility, claim state and mutation handling belong in the caller.

| Presentation | Component | Existing examples |
| --- | --- | --- |
| Default surface | `ui/Card` | Membership statistics/calendar, progress, settings |
| Curved stripes and logo | `ui/CardDecoration` or Card decoration props | Membership, dashboard, reports, grocery |
| Expandable staff audit | `shared/AuditHistoryList` | Admin and nutritionist Audit |
| Queue/history with detail pane | `shared/SplitWorkspace`, `WorkspaceListPane` | Nutritionist cases, nutrition guidance |
| Controlled dropdown | `ui/Select`, `ui/Dropdown` | Progress period, meal/report/review filters |
| Required or uncontrolled form select | `ui/NativeSelect` | Admin authoring and reference-data forms |
| Plan/library meal tile | `user/PlanMealCardSurface`, `user/MealMacros` | MealCard, PendingMealPreviewCard, RecipeLibraryCard |
| Compact meal presentation | `user/DashboardMealCardSurface`, `DashboardMealPlate`, `MealMacros` | Dashboard rows, food history, swap comparison |
| Meal library grid | `shared/MealLibraryLayout` | Member, nutritionist and admin libraries |
| Tabs or section links | `ui/WorkspaceTabs` | Meals, progress, reviews, settings, admin audit |
| Password field | `ui/PasswordInput` | Authentication and profile security |
| Pagination | `ui/Pagination` | All three role libraries |

## Cards

Card keeps both its existing header/footer props and compound CardHeader/CardContent/CardFooter API. It has the Plan Statistics surface shape, border and shadow. Keep a page's existing padding by passing its padding classes or `contentClassName`.

Decorations are optional: `none` (default), `stripes`, `logo`, `both`, or `varied`. Use `varied` with a stable `decorationSeed` such as a card or record ID. A seed picks one of the four variants, including no decoration. This varies cards without hydration differences or flickering on rerenders; don't call Math.random during render. Decorations are hidden from assistive technology and print, and cannot intercept clicks.

Fixed original accents use `decorationVariant` on Card or `variant` on CardDecoration: `intake`, `grocery`, `membership`, `statistics`, `schedule`, `report`, and `application`. These preserve each design’s original stripe placement, size, watermark and glow. Keep `default` for optional/varied decorations on ordinary cards. Existing surface gradient classes stay on their dedicated designs.

## Dropdowns and tabs

Select accepts `{value,label,disabled}` options and a string onChange. Dropdown adapts existing option children to the same menu. Menus use a portal so card overflow doesn't cut them off, reposition on scroll/resize, and support keyboard selection and Escape. Keep NativeSelect for a form that needs browser required validation, FormData, or defaultValue.

WorkspaceTabs accepts items with value, label, optional icon/count and optional href. Use href for navigation so browser links, new tabs and back navigation work. Use onChange for switching local panels. Each instance owns its animation identifier. Continue hiding or unmounting inactive content in the caller.

PasswordInput uses Input's trailingControl slot; never position a visibility button against the label or full field group. Its 44 px button is centered on the actual input and remains keyboard accessible.

## Meals and libraries

PlanMealCardSurface preserves the Meals tile design with its cropped circular image, colored banner and macro pills. DashboardMealCardSurface preserves the separate compact design with a full colored gradient and an overlapping circular plate. These dedicated meal components do not inherit the default Card surface or its decorations. MealCard, PendingMealPreviewCard and RecipeLibraryCard provide their specific status badges, body details and actions. History and swap rows reuse the compact design and DashboardMealPlate, with caller-specific sizes and actions. Shared presentation never implies that a library recipe is approved for a particular member.

MealLibraryLayout is only the grid. Member catalogue requests use useRecipeCatalog, scoped to owner, search, filters and page; staff use their existing role endpoints and account-scoped cache. Both use Pagination. Do not identify recipes by display name, or slice the first API page as if it contains the whole library. Cursor-based compatible pages advance only once the next batch arrives.

## Landing links

SectionLink scrolls a same-page public section without writing a URL hash. Its real href remains available for modified clicks, copied links and cross-page navigation.

## Audit details

AuditHistoryList fetches one record on expansion through the caller’s role endpoint. Pass the authenticated ownerId for session-scoped reads. RecordedDetails shows only the server’s food/fact projection, with missing nutrition labeled Not recorded; it never fills older records using current meal values. Admins can open existing meal authoring; no audit action automatically publishes reusable food or ingredients.
