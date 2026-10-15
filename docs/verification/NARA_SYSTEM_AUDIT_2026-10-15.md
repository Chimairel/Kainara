# System audit for Nara's guide — October 15, 2026

## Scope and baseline

Audited the shared checkout at `C:\Users\chima\Desktop\Nutrimind`, branch `codex/member-assistant`, base commit `6bc5e016b9cbf7bdae0b38ed48cd8dcbb15438d0`. Pre-existing unrelated changes were present and preserved; checks describe that working copy, not a clean remote release. No application fixes were made during this audit. A preliminary guide-code draft was discarded before running the audit.

This is a system-wide route/workflow and regression audit, with selected localhost browser checks. It is not an exhaustive security audit or an end-to-end certification of every action. Nara's proposed general guide is [here](../NARA_SYSTEM_GUIDE.md); it is a reviewed content specification, not activated runtime knowledge.

### Coverage

| Surface | What was inspected / verified |
| --- | --- |
| Application inventory | All 60 `page.tsx` routes; 632 frontend source modules excluding test/generated filenames in the inventory; 245 direct `api.get/post/put/patch/delete` call sites; 38 backend route files. Counts are syntactic, not endpoint or feature-completeness claims. |
| Public and access | Public docs/help/sources/pricing, auth/onboarding route families, verification and recovery, RouteGuard and corresponding backend guards. |
| Member workflows | Dashboard/intake/water, Meals Plan/History/Library, outside logging and feedback, swaps, groceries, progress, profile sections, saved guidance, membership/checkout, reminders/notifications and exports. |
| RND workflows | Review and library route composition, professional eligibility, claims, flag drafts, independent recipe re-review, outside feedback, profile clarifications and audit. Static review and existing regression tests; no new staff decision was submitted. |
| Admin workflows | Role-protected account/professional administration, support, sources/aliases, meals/batches/images, website content, audit and governance routes. Static review and existing regression tests; no admin mutation or staff browser journey was performed. |
| Nara | Canonical/generated guide, matcher, strict intent schema, service dispatch, consent, credits/receipts, browser help cache and focused test coverage. |
| Link sanity | Literal internal frontend links and all 15 distinct existing guide destinations resolve to inventoried page routes. No missing page destination found by this bounded check. Dynamic links, query behavior and fragment targets require their own checks. |
| API contract inventory | Existing TypeScript-AST audit inspected 1,297 source files, 19 top-level router mounts, 43 nested mounts, 325 route declarations and 243 extractable frontend calls, with no unmatched call. Eleven variable URL call sites remain outside automatic matching. Conditional factory routes are combined, so this is not proof of method authorization or payload compatibility. |

## Findings

### NA-01 · P2 · Existing support and workflow knowledge is missing

**Confirmed:** “how to report issue?”, “I found a bug” and “how do I contact support?” return generic topic choices. Contact Support already exists at `/help`; the verified-account form submits to `/api/support/requests`, stores an admin-inbox request and allows an email reply. This is a Nara knowledge gap, not a missing support feature.

The same pure matcher probe misses weekly check-in, pending-review meaning, RND feedback, missing meals, report acknowledgment and whether calories include rice. Eleven of 17 selected probes returned generic clarification; six existing navigation probes worked. These are a targeted regression set, not a statistical language benchmark.

Evidence: [canonical guide](../../backend/src/domain/member-assistant-information.ts), [support UI](../../frontend/src/components/shared/SupportContact.tsx), [support route](../../backend/src/routes/support.routes.ts), [support service](../../backend/src/services/support.service.ts). Browser reproduced the exact issue question at zero credit cost. Remedy: expand reviewed system entries and paraphrase tests, with support and specific workflows ahead of broad topic matching.

### NA-02 · P2 · Food/nutrition questions fall into app clarification

**Confirmed:** “can you tell me the nutrition fact of pandesal” and “what is protein?” are not admitted to the AI consent path. The matcher currently favors a narrow list of meal terms, explicit search verbs and numeric macro filters. It falls back to “Which part of KAINARA…” for valid educational questions.

Evidence: `needsAi` and final fallback in the [guide](../../backend/src/domain/member-assistant-information.ts); exact pandesal browser reproduction. Remedy: distinguish educational-food scope from app navigation and add regression examples for nutrient explanations and foods outside the current keyword list. Do not send ordinary missed app help to paid AI.

### NA-03 · P2 · Backend cannot yet fulfill broader nutrition questions

**Confirmed by schema/service inspection and pure probe:** valid interpretation intents are only `FIND_MEAL`, `TODAY`, `GUIDANCE`, `CLARIFY` and `UNSUPPORTED`. A proposed `FOOD_FACTS` interpretation fails schema validation. There is no food-composition answer handler or general nutrition education handler in the current Nara service.

Evidence: [interpretation contract](../../backend/src/domain/member-assistant.policy.ts), [dispatch/service](../../backend/src/services/member-assistant.service.ts). This is a gap against the newly accepted scope; it was not a claim that the earlier narrow version implemented general nutrition. Fixing the keyword matcher alone would expose a consent prompt without supplying the missing capability. Remedy: implement the handler/strict schema/retrieval and source rules in the same feature unit. Reuse bounded existing FNRI/USDA records rather than duplicating the catalogue.

### NA-04 · P2 · Public quarantine instructions describe a retired requirement

**Confirmed inconsistency:** the public professional-review chapter says two distinct RNDs must confirm a quarantined version before admin release. Current code rejects RND quarantine claim/confirm with `QUARANTINE_ADMIN_REQUIRED`. Administrative release instead requires the current version, rationale, evidence validation and an admin decision. The current governance document agrees with the code.

Evidence: [public chapter](../../frontend/src/app/docs/chapters/professional-review.tsx), [claim/confirm/adminAction](../../backend/src/services/meal-review.service.ts), [current governance](../MEAL_REVIEW_GOVERNANCE.md). Remedy: correct the public chapter; do not copy that older two-RND instruction into Nara or weaken the implemented release gates.

### NA-05 · P2 · Public onboarding instructions advertise retired document uploads

**Confirmed inconsistency:** Getting started tells members they may upload clinical documents during onboarding or later in Profile. Both new document-upload endpoints currently return HTTP 410 with instructions to use health-detail forms. The current Health details inbox is driven by RND requests; a new declaration alone does not create a form. Historical file read/withdrawal support does not restore new-upload capability.

Evidence: [public onboarding chapter](../../frontend/src/app/docs/chapters/getting-started.tsx), [both upload routes](../../backend/src/routes/user.routes.ts), [health-details policy](../../backend/src/domain/health-details.policy.ts), [inbox](../../frontend/src/features/profile/HealthDetailsInbox.tsx). Local browser shows “No questions from your RND yet” for the fixture, matching current code. Remedy: replace the upload instructions with the current requested-form flow, while retaining accurate legacy-history explanations where needed.

### NA-06 · P3 · Water removal can discard more than requested

**Reproduced using the real service with an in-memory transaction double:** one valid 275 mL entry minus a 250 mL removal returns zero, rather than the expected 25 mL. `WaterService.remove` deletes an entire entry when the residual would be below 50 mL. The add/remove API permits arbitrary integer amounts from 50 to 2000 mL, so such entries are accepted. The current dashboard normally uses 250 mL steps, which limits everyday UI exposure.

Evidence: [water service](../../backend/src/services/water.service.ts), [amount validation](../../backend/src/routes/user.routes.ts), [dashboard controls](../../frontend/src/features/dashboard/CockpitDashboard.tsx). No database water record was created or removed by the probe. Remedy: preserve exact residual volume or explicitly revise/document the product contract; do not silently round away recorded intake.

## Existing open item, not a newly discovered failure

The backend suite retains one explicit clinical-policy TODO, `TEST-021 / DEF-019`: qualified approval of daily calorie bounds. Passing unit tests does not close that policy/sign-off question. See the [clinical approval record](../CLINICAL_POLICY_APPROVAL.md) and current engineering record. No clinical conclusion was made during this audit.

## Verification performed

| Check | Result |
| --- | --- |
| Backend `npm test` (includes test TypeScript check) | 1,103 pass, 0 fail, 1 existing TODO; 1,104 registered |
| Frontend `npm test` | 1,230 Vitest tests in 238 files pass; 8 Node dependency/notification-worker tests pass |
| Backend production build | Pass |
| Frontend production build | Pass |
| Backend lint | Pass with 8 unused-symbol warnings, 0 errors |
| Frontend lint | Pass, no reported warnings/errors |
| Source architecture check | Pass; handwritten modules stay within the 900-line ceiling and 25 extracted entry-point budgets |
| Guide destination / literal page-link inventory | No missing page route detected by the stated static matcher |
| Pure/isolated probes | Reproduced missing help, rejected food-facts schema and water residual loss without database/provider calls |
| Local browser | Verified existing Contact Support form and enabled signed-in fields; loaded Meals Plan with 42 fixture slots and Plan/History/Library controls; Progress exposes “Log today's weight”; Health & goals exposes measurement/settings controls; Health details shows requested-form empty state; Membership exposes current plan/allowances; Export renders the nutrition summary and JSON/print controls. Reproduced both reported Nara failures. No browser errors were returned at the final check. These reads do not prove successful support delivery, actual downloads, checkout, clinical decisions or every data mutation. |

The browser used the existing synthetic local member on localhost ports 3000/5000. It did not send a support request, spend an AI credit, call Gemini, change a profile/meal/review, contact Neon, migrate a database, or deploy. Normal server authentication refreshes may occur during navigation. Both test suites use their existing mocked/unit environments; browser and unit results are separate evidence layers.

Local raw evidence is under `codex_outputs/nara-system-audit-20261015/`: `inventory.json`, `probes.ts`, `probes.json`, backend/frontend test/build/lint logs and `routing-reproduction.png`. These temporary artifacts are not included in the commit and contain no credential exports. The screenshot captures the synthetic member's routing failure and unchanged 40/40 balance.

## Recommended next unit

Use the [audited guide](../NARA_SYSTEM_GUIDE.md) to expand free app help and correct the two public-doc conflicts. Implement wider food/nutrition interpretation and its actual handlers together, preserving credit consent and bounded reference retrieval. Track the low-impact water issue as a separate fix. Keep automatic logging deferred, as requested. No feature activation or demo promotion is part of this audit.

## Page inventory

These are source routes, including compatibility/redirect pages; presence alone does not establish feature activation.

| Surface | Inventoried routes |
| --- | --- |
| Public (9) | `/`, `/docs`, `/help`, `/nutrition-report`, `/nutritionist-apply`, `/nutritionist-invitation`, `/pricing`, `/sources`, `/unauthorized` |
| Authentication (5) | `/forgot-password`, `/login`, `/register`, `/reset-password`, `/verify-email` |
| Onboarding (9) | `/onboarding/allergies`, `/onboarding/allergy-details`, `/onboarding/clinical-evidence`, `/onboarding/condition-details`, `/onboarding/conditions`, `/onboarding/preferences`, `/onboarding/shopping-day`, `/onboarding/stats`, `/onboarding/tos` |
| Member (17) | `/dashboard`, `/dashboard/[mealId]`, `/export`, `/grocery`, `/health-profile`, `/meals`, `/membership`, `/membership/checkout`, `/profile`, `/profile/clinical-evidence`, `/profile/health`, `/profile/nutrition-report`, `/profile/personal`, `/profile/planning`, `/profile/security`, `/progress`, `/progress/reports` |
| RND (6) | `/nutritionist/approved`, `/nutritionist/audit`, `/nutritionist/library`, `/nutritionist/outside-meals`, `/nutritionist/profile`, `/nutritionist/reviews` |
| Admin (14) | `/admin/analytics`, `/admin/audit`, `/admin/data`, `/admin/images`, `/admin/library`, `/admin/meals`, `/admin/more`, `/admin/nutritionists`, `/admin/operations`, `/admin/overview`, `/admin/profile`, `/admin/support`, `/admin/users`, `/admin/website` |
