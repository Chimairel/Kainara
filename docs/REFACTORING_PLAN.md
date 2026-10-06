# Refactoring plan

## Purpose

Make routes easy to scan and workflows easy to debug without changing the UI, API contracts, authorization, clinical policies, or database schema. Keep the separate Next.js frontend and Express backend.

## Frontend structure

```text
app/(user)/meals/page.tsx             route entry and Suspense boundary
features/meals/MealsWorkspace.tsx     page composition
features/meals/useMealsPage.ts        URL, breadcrumb and presentation state
features/meals/MealsPlanSection.tsx   plan panel
features/meals/MealsHistorySection.tsx history panel
features/meals/useMealsWorkspace.ts  existing API and mutation orchestration
components/ui/                      shared visual primitives
```

- Route files compose or import a named feature workspace.
- Workspaces compose named sections and connect their props to the feature hook.
- Hooks own fetching, cache ownership, polling, state and mutations. Presentational sections use typed props and existing components.
- Keep feature-only components in their feature folder. Promote a component to shared components when multiple features genuinely use it.
- Keep inactive panels unmounted as before. Preserve providers, Suspense, owner isolation, effects, ref behavior and mutation refreshes.
- Avoid splitting every paragraph or small function into a file. Use meaningful sections, not numbered fragments.

## Backend structure

```text
routes/meals.routes.ts               middleware and endpoint wiring
controllers/meals.controller.ts     compatible handler entry points
controllers/meals/plan-read.ts       current/workspace reads
controllers/meals/generation.ts      preparation requests
controllers/meals/swaps.ts           swap/library requests
services/auth.service.ts             compatible authentication entry points
services/auth/google-auth.ts         Google identity workflow
services/auth/email-verification.ts  OTP verification and resend
services/auth/password-auth.ts       login and password recovery
services/auth/sessions.ts            refresh/session lifecycle
domain/                             existing pure policy modules
```

- Split by operation or cohesive workflow. Keep routes and public method signatures stable.
- Keep transaction callbacks, locks, conditional writes, retries and access checks intact when moving code.
- Use shared helpers for actual shared mechanics. Do not create a generic utility layer containing unrelated business rules.
- Keep service dependencies one way; workflow modules must not import their compatibility facade.

## Batches

1. **Member core and backend entry points:** Dashboard, Meals and Groceries; meal controller workflows and authentication workflows. Establish concrete examples of the structure above.
2. **Member details:** progress, meal details, outside meal entry, profile and report sections; separate remaining large feature hooks when their responsibilities justify it.
3. **Staff:** nutritionist profile/case/library/review sections and admin analytics/authoring/reference sections.
4. **Backend core:** clinical evidence, condition clearance, meal composition/swap/log/grocery operations. Extract pure preparation/policy helpers first; keep write transactions together.
5. **Public/onboarding and maintenance:** landing/docs/intake composition, navigation maps, documentation and regression checks.

Each batch is an independently verified commit. Inventory remaining work honestly; a thin route alone does not mean its feature implementation is fully refactored.

## Batch 1 completed — October 6, 2026

| Entry point | Before | After |
| --- | ---: | ---: |
| Dashboard route | 699 lines | 5 lines |
| Meals route | 846 lines | 12 lines |
| Grocery route | 601 lines | 5 lines |
| Meal controller facade | 850 lines | 68 lines |
| Authentication service facade | 789 lines | 59 lines |

Dashboard now has a workspace, state hook, preparation/eligibility content, generation notices and date navigation. Groceries has a workspace, state hook, progress section, filter section and items section using the existing table. Meals has a workspace, route/presentation hook, generation notice, date navigation, plan section and history section; its existing library panel, API hook and modals remain reused.

Meal handlers are grouped into generation, reads/details, cycles, scheduled logs and swaps. Authentication is grouped into registration, Google identity/authentication, email verification, password authentication/recovery and sessions. Existing class entry points, signatures and Google creation retry behavior remain compatible. Moved workflows do not import their facades.

Verification:

- AST comparison: all 31 original backend method bodies and 131 frontend state/effect statements are unchanged. The empty-plan JSX moved from page setup into the plan presentation section.
- Backend suite: 785 passed, zero failed, one existing TODO.
- Existing frontend suite: 664 passed across 146 files. Six new regression tests passed separately, covering preparing-to-ready/failed refresh, pending previews, profile-review gating, eaten/reset calorie updates, meal deep links and tab/breadcrumb routing.
- Backend and frontend production builds, frontend standalone TypeScript, changed-file lint/formatting, architecture budgets and whitespace checks passed.
- Existing grocery route tests continue to exercise actual feature wiring, including current/next week, optimistic checklist changes, bulk updates, failures and account ownership.

No database migration, shared data mutation, dependency change, live provider call or new browser/clinical verification was performed. The UI markup and business operation bodies were preserved. This completes the first structural batch; batches 2–5 remain planned, and large existing modules such as ProgressWorkspace, OutsideMealModal, clinical evidence and meal swap still need their own focused refactors.

## Batch 2 completed — landing and long frontend screens (October 6, 2026)

The landing now composes seven named sections: hero, platform, process, nutritionists, sources, guides and call to action. `useLandingHomeModel` owns the existing authentication redirect and workspace link selection. The public entry remains compatible with its server-provided media prop.

| Entry point | Before | After |
| --- | ---: | ---: |
| LandingHome | 753 | 55 |
| ProgressWorkspace | 899 | 170 |
| OutsideMealModal | 848 | 30 |
| ProfileWorkPanel | 829 | 120 |
| AdminStatistics | 817 | 91 |
| AccountSettings | 812 | 143 |
| MealCard | 811 | 135 |
| DocsChapters | 805 | 33 |
| OutsideMealReviewsPanel | 785 | 46 |
| MealActivityCalendar | 769 | 77 |
| MealHistoryCard | 733 | 106 |
| SharedMealLibraryWorkspace | 705 | 90 |
| CaseReviewWorkspace | 698 | 217 |
| MealsWorkspaceModals | 630 | 199 |
| ApplicationWizard | 609 | 117 |
| Nutritionist profile route | 605 | 111 |

These are composition entries, not moved monoliths. Their presentation lives in named feature sections, state/effects/handlers in model hooks, and shared local types/constants in dedicated modules. The application wizard has five step components; the docs registry imports twelve chapter modules and retains the existing membership and policy entries in their original order. Existing UI primitives, card components, API hooks and modal boundaries remain in use.

Each section takes only the model fields it uses. Model hooks retain their existing ordering, including guards that precede calculations. Some hooks still contain bounded rendering helpers or early loading/error views; those are not claimed to be pure transport hooks. The largest new module is the 466-line calendar model, with its existing month-cell renderer and date behavior. Extracted composition files have individual architecture budgets to prevent long implementations returning to them.

Verification:

- Source comparison: 287 original state/effect/handler statements, fifteen rendered trees, six application function bodies and fourteen ordered docs registry entries preserved. Comparison accounts for section calls, equivalent fragments and formatting whitespace.
- Full frontend suite: 670 tests passed across 148 files, including existing auth, meal status/reset, calendar, outside-food, account, library and staff review coverage.
- Frontend production build, standalone TypeScript, changed-file lint/formatting, architecture and whitespace checks passed.
- No API contract, backend behavior, schema, shared database data, provider integration or dependency changes. This is automated/source verification, not new browser E2E or clinical evidence.

This completes the sixteen frontend files selected for this batch. Other large frontend modules under 600 lines and backend core services remain in the phased inventory; batches 2–5 from the original plan are only partially covered by this cross-screen batch.

## Verification and acceptance

- Read current code and its immediate dependencies before extraction.
- Compare moved function bodies and JSX against the original revision; changes should be structural.
- Run existing regression tests through the unchanged public entry points, plus frontend and backend production builds and changed-file lint/format checks.
- Update source-location assertions to inspect the new implementation files without weakening their behavior checks.
- Check source architecture and diff whitespace. The existing 900-line ceiling remains a hard limit, not a target size. Extracted route entries are capped at 60 lines and backend facades at 100 lines to prevent implementation growing back into them.
- No live database writes or external provider calls are needed for a structural batch.
- Preserve other tools' uncommitted files; stage only the refactor batch. Push verified commits to development.
