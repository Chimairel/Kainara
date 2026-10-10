# Transaction timeout audit — October 10, 2026

## Cause and scope

The older admin health-profile audit failed with Prisma P2028: its default 5-second interactive transaction expired after 6,026 ms while reading the related member. The exact review, member and saved profile snapshot were present. They were not deleted or reconstructed.

Inspected all **145 runtime transaction call sites across 68 source modules**: 142 interactive callbacks and three array transactions. Of the interactive calls, 60 omit options and 19 only specify isolation; these 79 calls previously inherited the 5-second timeout. Admin review-context transactions now also explicitly use the common budget. The array API is not governed by the interactive callback timeout.

The shared Prisma client now provides a **30-second execution limit and 10-second acquisition limit**. This covers implicit options and isolation-only options without changing their isolation levels. Existing 30–90-second workflow overrides remain. No transaction replay was added; revision checks, claims, authorization, audit writes, and rollback semantics remain in place.

## Overrides reviewed

| Operation | Execution budget | Reason |
| --- | --- | --- |
| Clinical evidence, including document review/invalidation | 20 → 30 seconds | Multiple dependent clinical queries, changes and notifications |
| Library safety certification | 15 → 30 seconds | Ingredient evidence, declarations and independent review checks |
| Admin case details and evidence files | 30 seconds | Related historical reads and mandatory access audit |
| Meal batch preview | 30 → 60 seconds | Up to 100 ingredient-mapping and duplicate checks |
| Meal batch import | 60 → 120 seconds | Atomic creation and validation of up to 100 drafts |
| PSA snapshot ingestion | 5 → 120 seconds | Serial loops over commodities, mappings and observations |
| Login/refresh sessions | Retain 15 seconds, 5-second acquisition | Two or three session queries; intentionally bounded authentication lock waits |
| Existing grocery/lifecycle work | Retain 90 seconds | Existing budget for larger plan/list projections |
| Existing outside-meal work | Retain 60 seconds | Existing capture/review/aggregation budget |

Reviewed script transaction declarations separately. Maintenance scripts that import the shared client inherit its new default; independent clients and disposable acceptance probes retain their local per-operation settings. In particular, developer account creation already supplies 60 seconds, catalogue completion supplies up to 300 seconds, and synthetic lock-expiry probes intentionally use shorter limits. No migration/import/seed was run against the shared database in this change.

## Verification

- Normal development localhost API: the **exact historical entry from the screenshot** returns its saved revision-2 decision and snapshot, with one recorded sensitive-detail access. A newer clarification case also loads. Anonymous requests return 401; member and RND requests return 403. Responses retain private/no-store caching.
- Regression test models 7.5 seconds of database work while ensuring the saved profile remains separate from the current profile and access is recorded.
- Fresh loopback PostgreSQL acceptance: a default transaction commits after six seconds; isolation-only Serializable options also survive six seconds. An explicit one-second override expires without replay; timeout and validation failures both roll back writes. Initial startup attempt was refused because PostgreSQL was not yet ready; the subsequent acceptance run passed all checks.
- Backend suite: **896 passed, zero failed, one existing TODO** (897 total), using the suite's explicit disabled-feature baseline. Enabled development behavior was exercised separately over HTTP. Backend build, ESLint and architecture guard/all 25 budgets passed.
- Browser confirmation was not completed: the browser tool refused binding to the existing error-page tab under its URL policy. No browser workaround was attempted. Frontend files were unchanged by this fix.

Longer budgets do not guarantee arbitrary batch size or network latency will complete. They are upper bounds, not deliberate delays. Pool saturation, database statement limits, HTTP/proxy deadlines and slow queries remain separate concerns; raising these transaction limits does not alter them. Admin case failures now log the request ID and Prisma error code without clinical contents.

## Runtime call-site inventory

Counts include array and interactive calls. All interactive calls using the shared client inherit the default unless explicitly overridden.

| Source module | Calls | Lines |
| --- | ---: | --- |
| [account-settings.service.ts](../backend/src/services/account-settings.service.ts) | 1 | 52 |
| [admin-data.service.ts](../backend/src/services/admin-data.service.ts) | 8 | 172, 190, 211, 288, 325, 360, 380, 455 |
| [admin-meal-authoring.service.ts](../backend/src/services/admin-meal-authoring.service.ts) | 2 | 203, 216 |
| [admin-meal-batch.service.ts](../backend/src/services/admin-meal-batch.service.ts) | 2 | 135, 162 |
| [admin-meal-image.service.ts](../backend/src/services/admin-meal-image.service.ts) | 2 | 41, 84 |
| [admin-meal-log.service.ts](../backend/src/services/admin-meal-log.service.ts) | 3 | 27, 54, 121 |
| [admin-review-context.service.ts](../backend/src/services/admin-review-context.service.ts) | 2 | 30, 51 |
| [admin.service.ts](../backend/src/services/admin.service.ts) | 2 | 102, 130 |
| [ai-capacity.service.ts](../backend/src/services/ai-capacity.service.ts) | 1 | 57 |
| [application-email-verification.service.ts](../backend/src/services/application-email-verification.service.ts) | 2 | 17, 54 |
| [auth/password-auth.ts](../backend/src/services/auth/password-auth.ts) | 1 | 159 |
| [auth/sessions.ts](../backend/src/services/auth/sessions.ts) | 2 | 22, 95 |
| [certified-slot-fallback.service.ts](../backend/src/services/certified-slot-fallback.service.ts) | 1 | 184 |
| [checkin.service.ts](../backend/src/services/checkin.service.ts) | 1 | 82 |
| [clinical-clarification.service.ts](../backend/src/services/clinical-clarification.service.ts) | 3 | 145, 204, 276 |
| [clinical-evidence.service.ts](../backend/src/services/clinical-evidence.service.ts) | 7 | 143, 180, 277, 331, 416, 492, 608 |
| [clinical-profile-proposal.service.ts](../backend/src/services/clinical-profile-proposal.service.ts) | 2 | 104, 237 |
| [clinical-profile-review.service.ts](../backend/src/services/clinical-profile-review.service.ts) | 2 | 290, 575 |
| [condition-clearance.service.ts](../backend/src/services/condition-clearance.service.ts) | 6 | 126, 273, 314, 494, 620, 745 |
| [cron.service.ts](../backend/src/services/cron.service.ts) | 1 | 75 |
| [food-composition.service.ts](../backend/src/services/food-composition.service.ts) | 1 | 75 |
| [grocery.service.ts](../backend/src/services/grocery.service.ts) | 4 | 182, 406, 460, 506 |
| [meal-ai-queue.service.ts](../backend/src/services/meal-ai-queue.service.ts) | 1 | 381 |
| [meal-approval-lifecycle.service.ts](../backend/src/services/meal-approval-lifecycle.service.ts) | 2 | 317, 428 |
| [meal-base-verification.service.ts](../backend/src/services/meal-base-verification.service.ts) | 1 | 384 |
| [meal-clarification.service.ts](../backend/src/services/meal-clarification.service.ts) | 1 | 21 |
| [meal-generation.service.ts](../backend/src/services/meal-generation.service.ts) | 1 | 275 |
| [meal-library-publication.service.ts](../backend/src/services/meal-library-publication.service.ts) | 1 | 107 |
| [meal-log.service.ts](../backend/src/services/meal-log.service.ts) | 3 | 227, 333, 574 |
| [meal-plan-composition.service.ts](../backend/src/services/meal-plan-composition.service.ts) | 1 | 411 |
| [meal-plan-cycle.service.ts](../backend/src/services/meal-plan-cycle.service.ts) | 2 | 572, 594 |
| [meal-review-correction.service.ts](../backend/src/services/meal-review-correction.service.ts) | 1 | 27 |
| [meal-review.service.ts](../backend/src/services/meal-review.service.ts) | 4 | 128, 189, 208, 268 |
| [meal-swap-source.service.ts](../backend/src/services/meal-swap-source.service.ts) | 1 | 398 |
| [meal-swap.service.ts](../backend/src/services/meal-swap.service.ts) | 1 | 491 |
| [meal-wide-flag.service.ts](../backend/src/services/meal-wide-flag.service.ts) | 1 | 23 |
| [membership-checkout.service.ts](../backend/src/services/membership-checkout.service.ts) | 4 | 85, 255, 292, 421 |
| [membership-history.service.ts](../backend/src/services/membership-history.service.ts) | 2 | 22, 52 |
| [membership.service.ts](../backend/src/services/membership.service.ts) | 2 | 131, 327 |
| [nutrition-report.service.ts](../backend/src/services/nutrition-report.service.ts) | 2 | 127, 246 |
| [nutritionist-application.service.ts](../backend/src/services/nutritionist-application.service.ts) | 8 | 63, 199, 230, 261, 304, 339, 395, 507 |
| [nutritionist-approval.service.ts](../backend/src/services/nutritionist-approval.service.ts) | 1 | 148 |
| [nutritionist-dispute.service.ts](../backend/src/services/nutritionist-dispute.service.ts) | 1 | 41 |
| [nutritionist-library-certification.service.ts](../backend/src/services/nutritionist-library-certification.service.ts) | 1 | 61 |
| [nutritionist-library-nutrition-evidence.service.ts](../backend/src/services/nutritionist-library-nutrition-evidence.service.ts) | 1 | 117 |
| [nutritionist-library.service.ts](../backend/src/services/nutritionist-library.service.ts) | 1 | 379 |
| [nutritionist-rejection.service.ts](../backend/src/services/nutritionist-rejection.service.ts) | 4 | 78, 269, 374, 438 |
| [nutritionist-replacement.service.ts](../backend/src/services/nutritionist-replacement.service.ts) | 1 | 157 |
| [nutritionist-review.service.ts](../backend/src/services/nutritionist-review.service.ts) | 2 | 335, 693 |
| [observed-meal.service.ts](../backend/src/services/observed-meal.service.ts) | 3 | 79, 155, 241 |
| [outside-meal-capture.service.ts](../backend/src/services/outside-meal-capture.service.ts) | 3 | 252, 387, 463 |
| [outside-meal-review.service.ts](../backend/src/services/outside-meal-review.service.ts) | 4 | 92, 150, 247, 361 |
| [progress.service.ts](../backend/src/services/progress.service.ts) | 1 | 19 |
| [psa-openstat-price-ingestion.service.ts](../backend/src/services/psa-openstat-price-ingestion.service.ts) | 1 | 141 |
| [recipe-derivation.service.ts](../backend/src/services/recipe-derivation.service.ts) | 1 | 18 |
| [retire-fixture-catalogue.service.ts](../backend/src/services/retire-fixture-catalogue.service.ts) | 1 | 13 |
| [retired-plan-repair.service.ts](../backend/src/services/retired-plan-repair.service.ts) | 1 | 154 |
| [review-routing.service.ts](../backend/src/services/review-routing.service.ts) | 1 | 43 |
| [safety-intake.service.ts](../backend/src/services/safety-intake.service.ts) | 2 | 178, 202 |
| [scheduled-meal-log.service.ts](../backend/src/services/scheduled-meal-log.service.ts) | 1 | 17 |
| [upcoming-plan-preparation.service.ts](../backend/src/services/upcoming-plan-preparation.service.ts) | 1 | 74 |
| [user-privacy.service.ts](../backend/src/services/user-privacy.service.ts) | 1 | 120 |
| [user-profile.service.ts](../backend/src/services/user-profile.service.ts) | 2 | 202, 378 |
| [user-safety-intake.service.ts](../backend/src/services/user-safety-intake.service.ts) | 5 | 7, 42, 68, 99, 159 |
| [user-safety-recheck.service.ts](../backend/src/services/user-safety-recheck.service.ts) | 5 | 96, 184, 319, 453, 540 |
| [water.service.ts](../backend/src/services/water.service.ts) | 3 | 21, 31, 41 |
| [web-push.service.ts](../backend/src/services/web-push.service.ts) | 1 | 26 |
| [website-content.service.ts](../backend/src/services/website-content.service.ts) | 1 | 59 |
