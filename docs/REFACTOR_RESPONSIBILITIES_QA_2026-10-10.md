# Frontend and backend responsibility refactor — October 10, 2026

Change ID: `CHG-20261010-14`.

## Scope

The owner requested another codebase refactor. Inspection found the existing architecture guard passing, with several orchestration modules near its 900-line ceiling. This pass extracts four independently understandable responsibilities while retaining public interfaces, existing UI, database queries, policy checks and decision semantics. No dependency, schema, database target or feature-flag change is required.

| Existing module | Extracted responsibility | Before → after |
| --- | --- | --- |
| `backend/src/services/meal-plan-composition.service.ts` | `meal-library-slot-selection.service.ts`: deterministic slot ranking, serving resolution, retained slots and recipe rotation | 900 → 772 |
| `backend/src/services/clinical-evidence.service.ts` | `clinical-document-access.service.ts`: owner/claimed document access, current evidence scope, access audit and authenticated decryption | 873 → 785 |
| `frontend/src/features/meals/useMealsWorkspace.ts` | `meal-plan-presentation.ts`: Manila day groups, approved/pending/retained date union, selected day, starter dates and counts | 814 → 680 |
| `frontend/src/features/nutritionist-reviews/useNutritionistReviews.ts` | `useCaseReviewQueue.ts`: queue cache, coalesced requests, owner/generation guards, errors and invalidation; `review-types.ts`: shared contracts | 796 → 571 |

Line counts use the architecture script's newline-split convention, including the trailing newline. Composition limits are now 800/800/700/600 lines respectively, alongside the existing 900-line global guard and other extracted entry-point budgets.

## Preserved boundaries

- Meal composition still owns admission/eligibility queries, repair context, persistence and publication. Slot selection receives already admitted candidates and keeps certified-before-pending ordering, diet/calorie checks, three-day rotation, rice handling and case-approval requirements.
- `ClinicalEvidenceService` retains its existing file methods. Their delegated implementation checks member ownership or the current RND claim and document scope before audit/decryption. Current readiness is supplied through the existing service method, avoiding a service dependency cycle.
- Member fetching, mutations and selection remain in the workspace hook. The extracted model only derives display data; it does not change selected dates, generate meals or mutate plans.
- RND decisions, claims, live context withdrawal, unfinished drafts and detail loading remain in the existing review hook. Queue requests retain owner checks, generation fencing, cache lifetime and coalescing. Existing type import paths remain compatible through re-exports.

## Verification

- Full backend suite: **895 passed, zero failures, one existing TODO** (896 total), including TypeScript test compilation.
- Full frontend suite: **880 passed across 187 files**, plus **eight Node checks**. Existing queue race/owner isolation, claim/swap, live invalidation, plan selection and retained-date component coverage passed without changing its expectations.
- Six new backend checks cover retained slots and rotation, certified/pending ordering and approval requirements, incompatible diet/calorie gaps, missing meal claims, unrelated readiness documents, and scoped owner access with an audited authenticated decrypt.
- Backend and frontend ESLint passed, including the new tests. Architecture check passed for all source modules and **25 composition/controller/service budgets**.
- Backend and frontend production builds passed. The backend alias rewrite processed 211 compiled files; Next completed compilation, type checks and route generation using its separate production output directory.

The first backend run exposed an issue in the new test harness: Node's method mock cannot inspect Prisma delegate proxies. The tests now substitute delegate functions with restoration after each test; the final full run passed. Product authorization checks were not weakened.

## Limits and operational state

This is a behavior-preserving source refactor, not another feature rollout. No shared database migration, seed, clinical data update, feature enablement or demo promotion occurred. Unrelated working-copy edits were excluded. The previous authenticated synthetic browser evidence remains documented in `EXACT_REUSE_BROWSER_QA_2026-10-10.md`; browser journeys were not rerun for this pass. Automated checks do not establish clinical validity or exhaustive absence of defects.
