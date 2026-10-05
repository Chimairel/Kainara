# System journey audit — October 6, 2026

## Objective and evidence rules

Exercise current member, nutritionist and administrator journeys in batches, reproduce failures, fix confirmed software defects, and retest every fix. Starting revision: `0101939`. This is a software audit, not clinical validation.

Each result must record the scenario, expected behavior, actual result, evidence type, defect ID where applicable and retest. A passing unit test, intercepted browser response, seeded service fixture, actual HTTP journey and external-provider journey are distinct evidence levels. Never report a batch as passed when only part ran. Older acceptance scripts are references until their assumptions have been checked against current code.

## Environment and coordination

- Work in the shared checkout on development; preserve owner documentation and servers. No demo promotion is implied.
- Inspect status and current revision before changes; commit focused repairs with Codex attribution and push development only after verification.
- Prefer an isolated local PostgreSQL database and separately configured API/frontend for destructive, rejection, publication, suspension and payment simulations. Verify exact target before migrations, fixtures or mutations. No reset, schema push or bulk seed against shared Neon.
- Shared development checks, if needed for provider/runtime parity, use clearly labeled test identities and normal gated services. Do not change real member approvals, real staff identity or shared recipe governance for test setup.
- Keep account IDs, passwords, tokens, OTPs, raw database data and provider payloads in ignored local artifacts. Do not include them in this document or commits.
- Synthetic reviewers/admins are test fixtures, not real professionals. Keep their decisions distinguishable in audit records. Retain required audit history and disable temporary elevated access after completion.
- Bound Gemini calls and use deterministic failure injection only in the isolated test process. Report actual calls separately from injected provider behavior. No live money or messages to third parties.

## Batches

### Batch 0 — Baseline and harness

1. Check source, engineering record, routes, schemas, migrations, current policy versions and available acceptance scripts.
2. Inspect existing local infrastructure; provision an isolated database without touching shared state.
3. Establish synthetic admin, two eligible nutritionists, applicant, ineligible nutritionist and members. Use ordinary registration/OTP, login and staged application flows where feasible; label directly seeded bootstrap roles.
4. Run backend/frontend unit, lint, TypeScript, production builds, architecture and formatting gates. Record inherited failures separately.
5. Record API/database targets, source revision, fixtures, cleanup strategy and evidence locations without secrets.

### Batch 1 — Identity, onboarding and declared safety

Member matrix (each starts as a fresh account):

| Scenario | Core expectation |
| --- | --- |
| Explicit no condition/no allergy | Complete onboarding and report acknowledgment; unrestricted sourcing can proceed |
| Supported single food allergy | No known-allergen meal becomes usable without matching evidence; current membership rules apply |
| Multiple food allergies | Enforce all restrictions together, including ingredient aliases |
| Supported diabetes | Current health answers, profile review and meal evidence remain required |
| Hypertension | No accidental unrestricted approval; reviewer journey preserves current scope |
| Kidney disease/severe supported combination | Escalation/review gates and complete current context remain enforced |
| Heart condition + nuts + MSG | Reproduce restricted sourcing after profile approval; verify batch-save fix |
| Pregnancy/lactation | Eligibility, declared context, calculations and review behavior match current policy |
| Supported intolerance or ingredient avoidance only | Distinguish preference/exclusion from allergy and condition; preserve exclusions |
| Recognized but unsupported condition/restriction | Explicit manual review route; no silent assumption of safe applicability |
| Unknown condition and unknown allergy | Clarification remains required; no arbitrary approval or generation bypass |
| Apparently non-food condition/allergy, e.g. pollen or dust | Inspect actual classification; do not assume an arbitrary declaration is nutritionally irrelevant |
| Contradictory NONE + restriction, duplicates and aliases | Reject contradictions or normalize consistently without losing restrictions |
| Vegan/vegetarian/pescatarian with restrictions | Positive diet tags and restriction intersection are both enforced |

Additional identity cases: wrong/expired/replayed OTP, unverified access, wrong password, expired access refresh, stale role claims, Google collision/intent contract, incomplete onboarding, consent versions and session isolation. Actual Google-provider verification requires a genuine owner-controlled identity; a mocked Google result is reported as such.

### Batch 2 — Reports, membership and preparation

1. Generate/read/acknowledge current reports; stale versions, changed safety and repeated acknowledgment.
2. Free, pending Health trial, active paid Lifestyle/Health, expired access and scheduled periods. Trial clock starts only at a usable current plan; case-planning membership gates remain enforced.
3. Unrestricted, restricted and unsupported profile approval states. Before approval, zero candidate-generation work; after approval, only properly approved meals become actionable.
4. Library-first/corpus-next sourcing, rice/no-rice/included-rice behavior, portion fitting, macro totals, ingredient provenance, grocery consistency and review work keys.
5. Missing corpus slots, Gemini capacity deferral, timeout/error/malformed result, pending queue, durable retry, concurrent triggers and idempotent cycle creation. Separate real provider observations from injected failures.
6. Starter versus full week, shopping anchors, current/upcoming cycles, deadline gaps and profile changes during preparation. Verify preparing → previews/ready/failed without page refresh.

### Batch 3 — Nutritionist workflow and recipe governance

1. Profile queue/detail/claim/approve/decline/request details; stale scope, claim expiry, competing reviewers and changed declarations.
2. Case queue visibility and member previews; claim/release, approve exact saved plate and reject a meal with recorded reasons.
3. Rejection replacement/fallback, unavailable slots and member updates; no rejected meal remains actionable or reuses invalid clearance.
4. Base recipe verification versus member case approval; independent recipe changes, applicable meal types, flags, revisions and scoped approval reuse.
5. Suspended/unverified/expired-license nutritionists cannot act. Ordinary members/admins cannot call nutritionist-only endpoints or read private clinical files.
6. Review/audit attribution, rejected/approved archive, notification events and no cross-member evidence leakage.

### Batch 4 — Member tracking and derived records

1. Mark eaten/skipped, reset status, external meal capture, macro intake and history persistence.
2. Swap only eligible uneaten meals; reset restores eligibility; limits, concurrency and exact serving/rice evidence.
3. Grocery progressive inclusion, quantities, availability toggles, bulk operations, PDFs and purchases after swap/rejection.
4. Weight, progress, adherence, hydration and weekly check-in due/submit/repeat behavior; report/profile adaptation and current-plan preservation.
5. Export/deletion using disposable accounts; password and Google-only contracts, failed authorization and dependent-record cleanup.

### Batch 5 — Administrator workflow

1. Overview/search/pagination/analytics/audit; correct population and membership wording, no patient credential or private-document leakage.
2. Nutritionist application/call/invitation/verification/rejection; invitation replay, expired/suspended staff access and audit history.
3. Admin meal authoring/manual versus AI generation, FNRI identities and nutrient basis, draft editing and recipe governance. Admin creation must not silently grant nutritionist certification.
4. Reference-data draft/import/publish/rollback on isolated data; schema validation, unknown IDs, stale expected revisions and derived invalidation.
5. Suspend/restore disposable member/staff accounts and cross-role route/API authorization. Owner real accounts remain untouched.

### Batch 6 — Browser, resilience and regression

1. Actual API-connected member, nutritionist and admin views at 390 and 1440 px; navigation, modals, loading/empty/error states, overflow and accessible controls.
2. Refresh/token expiry, interrupted requests, slow auxiliary requests, recovery polling, retry and session switching with cache isolation.
3. Retest every confirmed defect with a targeted regression, then run the package gates affected by the changes and relevant cross-role browser journeys.
4. Inspect final diff, record evidence/limits, commit repairs and push development. Summarize open defects and unverified integrations explicitly.

## Execution ledger

The plan above was written before execution. Final evidence combines **66 distinct audit probes**, **17 fresh member scenarios**, normal applicant activation, synthetic bootstrap staff, database/service regressions and browser checks. Exploratory failures and retests remain in ignored logs; the count uses the most recent result for each named probe, not every repeated execution.

| Batch | Status | Evidence |
| --- | --- | --- |
| 0 | Completed locally | Disposable PostgreSQL, migrated schema, source reference copy, baseline/final package gates; no shared patient fixtures |
| 1 | Passed | 18 grouped intake/identity probes across 16 fresh scenarios; normal registration and captured OTP; supplementary fresh shellfish + gluten scenario |
| 2 | Passed within stated coverage | 17 preparation/review-gate probes; corpus/library sourcing, pending previews, failed coverage and idempotency; additional membership/report/checkout acceptance |
| 3 | Passed | 9 grouped reviewer probes; exact saved-plate approval, changed-plate rejection, claims, pending replacement and source governance |
| 4 | Passed | 9 grouped tracking probes plus swap/purchase regressions; actual HTTP and database assertions |
| 5 | Passed | 4 grouped administrator probes covering nine workspaces, suspension, authoring and normal applicant/call/invitation activation; isolated reference-data publication/rollback acceptance |
| 6 | Passed within stated coverage | 5 API boundary probes; six Chromium role/viewport cases covering 34 actual API-connected views; 15 intercepted resilience/privacy/membership cases passed, 10 separately configured role cases skipped |
| Supplement | Passed | 4 allergy-source probes: independent flag release, fresh safe failure, reviewed-source recovery, withdrawal blocking existing meals |

### Test environment and data boundary

- Starting revision: `0101939`; shared checkout `C:/Users/chima/Desktop/Nutrimind`, branch `development-synced`, tracking `origin/development`.
- Task-owned PostgreSQL 16 container: `kainara-system-audit-20261006`, loopback port `55478`. Main database: `kainara_system_audit`; separate `membership_acceptance` and `nutrimind_admin_data` databases isolate older acceptance fixtures.
- All 91 migrations applied locally. Copied 15,072 reference food records, 1,960 available raw recipes and 3,073 applicable-type entries through a read-only source export. Real accounts, clinical approvals and reviewer governance were not copied.
- Bootstrap roles are one synthetic administrator, three eligible synthetic nutritionists and one unverified nutritionist. Applicant activation uses the normal email-proof/call/invitation services. None are genuine professional credentials.
- Tests use normal Express HTTP routes, PostgreSQL and the actual source-selection/persistence code. Service fixtures and captured mail are identified separately. Gemini is disabled in the synthetic matrix; corpus selection requires no Gemini call.
- Only shared development database change was the additive grocery migration, after checking the development Neon host and pending migration. No shared member approval, recipe governance or clinical data was altered by this audit.
- Credentials, OTPs, account IDs, raw exports and tokens remain in ignored `.codex-runtime/system-audit` artifacts. Owner `Documentations/` and existing development servers are preserved.

## Findings and fixes

All confirmed application defects below were repaired and retested. AUD-007 is test maintenance. Severity describes software impact, not a clinical assessment.

| ID | Severity | Reproduction / actual behavior | Fix | Verification |
| --- | --- | --- | --- | --- |
| AUD-001 | P2 | A second generation request collided with a live job and returned a generic server failure | Return `409 GENERATION_IN_PROGRESS`; keep the existing lease and admission guards | Actual local job collision created no additional meals; new unit regression proves no second admission/generation call |
| AUD-002 | P2 | Logging an inaccessible or uncleared scheduled meal surfaced as a generic server error | Owned missing meal returns 404; failed clearance returns 409; controller preserves typed errors | Foreign meal 404; pending/uncleared meal 409; DONE/SKIPPED/reset and repeat writes verified; unit assertions verify no blocked write |
| AUD-003 | P2 | Sending altered recipe/nutrition values with approval produced a 500 | Return `422 MEAL_APPROVAL_RECIPE_CHANGE_NOT_ALLOWED`; approve only the saved plate | Changed calorie submission rejected without changing saved evidence; ordinary claimed exact-plate approval succeeds |
| AUD-004 | P2 | Rejecting a rice-paired raw recipe selected another rice-compatible dish but saved only its base component | Raw rejection replacement uses the ordinary prepared-corpus composer with governed rice, planning targets and serving signatures; profile/source/composition checks and replacement linking remain atomic | Initial DB reproduction: paired Bam-I replaced by Asian Fried Chicken without rice. Retest preserved pairing semantics: included-rice recipe needs no second rice side; replacement stays pending, rejected original stays unusable |
| AUD-005 | P2 | Opening swap options for eaten/skipped or inaccessible meals returned generic failures | Return owned 404 or typed conflict errors for logged, uncleared, changed-profile and closed-cycle meals | Actual eaten meal 409; reset restores options; ordinary preview/confirmation/replay succeeds; no duplicate swap log |
| AUD-006 | P1 | Swapping away an ingredient already bought attempted to write quantity/source count zero, violated PostgreSQL constraints and rolled back the swap | Add `GroceryItem.isObsolete`; retain positive historical amounts and purchases, hide retired rows from active lists/PDF/checklist mutations, reactivate the same row if needed again | Actual purchased-ingredient swap succeeds; retired row cannot be toggled; swapping back restores the same row ID, purchase quantity and checked state. PDF and ownership checks pass |
| AUD-007 | Maintenance | Older scripts expected allergy-only Health gating, mandatory document readiness, a removed lead/two-reviewer feature or application submission without inbox proof | Condition-specific membership fixtures now include diabetes; document acceptance uses current health-answer readiness plus actual document status/facts; remove obsolete lead assertions and update applicant proof/callers | Membership, report membership, document lifecycle and integrated-role acceptance pass; broad script TypeScript passes. Updating legacy callers is not evidence that every legacy suite ran |
| AUD-008 | P2 | A failed, completely empty cycle was treated as an existing finished selection. Explicit preparation retry could not reconsider newly reviewed source evidence | Only an owned, failed, fully empty and unfrozen current episode can be re-sourced. Recheck emptiness/current profile under the existing generation lock before superseding it. Ordinary whole-plan replacement remains disabled | Fresh shellfish + gluten member: zero meals before evidence; two approved meals with composed rice after independent recipe verification/certification. Repeated generation preserves those rows; foreign/nonempty retry is excluded; transactional guard rejects a populated cycle; withdrawal makes both meals unusable |

### Changed implementation areas

- Meal generation, empty-plan retry and the source-plan transaction.
- Scheduled logging and swap read error propagation.
- Nutritionist exact-plate approval and raw rejection replacement.
- Grocery projection, checklist guards and additive Prisma migration `20261006053000_preserve_removed_grocery_purchases`.
- Reusable guarded audit scripts and opt-in actual API browser smoke coverage.
- Selected outdated acceptance fixtures; no membership policy or reviewer eligibility rule was relaxed to obtain a pass.

## Member matrix and observed outcomes

These are software workflow fixtures. An approved synthetic decision is not human clinical approval.

| Scenario | Observed result |
| --- | --- |
| Explicit no restrictions | 15 approved starter meals; 11 plates with a governed rice side |
| Shellfish only | Safe source-coverage failure when the deliberately empty reviewed library has no matching evidence |
| Nuts + eggs + dairy | Safe source-coverage failure; did not use incompatible corpus recipes as automatic approvals |
| Diabetes | Profile review required; 15 pending candidate meals after scoped approval; exact saved-plate approval releases a meal |
| Hypertension | Same review gates; pending candidates remain unusable until approved |
| Kidney disease + shellfish | Current health answers and scoped profile review enforced; pending candidate/reviewer flow works |
| Heart condition + nuts + MSG intolerance | Scoped profile review and pending candidates work; no legacy-account bypass or automatic meal approval |
| Pregnancy/lactation declaration | Female fixture and current health-answer/profile-review flow; candidates remain pending |
| Gout | Current condition details and profile review required; pending preparation works |
| Lactose intolerance + avoided pork | Restriction scope preserved; profile review and candidate review remain enforced |
| Unknown custom condition + allergy | Approval fails `PROFILE_CLARIFICATION_REQUIRED`; reviewer can request details; no generation job bypass |
| Pollen allergy | Classified as unresolved custom restriction; clarification required, not silently discarded |
| Myopia + dust mites | Unresolved custom declarations require clarification; test did not make a dietary/medical judgment |
| Vegan | 10 approved source meals plus safe coverage gaps; missing slots fail without inventing approval |
| Vegetarian | 15 approved source meals |
| Pescatarian + no rice | 15 approved source meals, zero separate cooked-rice components; isolated account deletion verified |
| Shellfish + gluten, supplementary fresh account | Safe failure before compatible evidence, then two usable independently reviewed recipe servings; flags immediately remove their usability |

### Policy conclusions confirmed by executable behavior

- Supported food allergies alone do not automatically require the Health case-planning membership. Every used recipe must still have compatible reviewed evidence; membership eligibility is not meal safety authority.
- Declared conditions/intolerances and unresolved custom entries retain scoped profile review. Profile approval allows candidate preparation; it does not approve individual meals.
- Current policy allows an eligible verified RND to approve an exact saved plate. Historical lead/two-reviewer requirements are not current release gates. Independent verification of an authored reusable recipe and flag resolution are separate rules and were enforced.
- The introductory Health clock starts when the first cleared current meal becomes usable. A starter can count; pending previews do not. Expiry blocks a new case week while keeping existing cleared records available.
- Admins can author FNRI-based drafts and raise flags. They cannot use member generation or grant nutritionist recipe certification simply by creating a draft. This audit did not find an admin AI-generation endpoint to exercise.

## Other journeys exercised

- Unverified member cannot start onboarding APIs; captured OTP verification succeeds. Contradictory NONE/restriction input is rejected, and duplicate/custom aliases preserve canonical restrictions.
- Wrong password and old refresh-cookie replay fail; a valid refresh works. Cross-role routes reject members/staff attempting incompatible operations or changing a role field in a request body.
- Reviewer competing claims conflict; changed-plate approval fails; rejection records a decision/audit before attempting replacement. Preview meals cannot be logged or swapped as usable meals.
- DONE/repeated DONE/reset/SKIPPED/reset preserves a single scheduled log. Outside-meal preview/confirm/replay/history/void and foreign ownership checks work without Gemini when using reported nutrition.
- Hydration add/subtract/reset and negative-input rejection work. Weight entry, progress read and export work; exported data does not expose password hashes.
- Weekly check-in returns not-due first. Advancing only the synthetic fixture's original acknowledgment makes it due; ordinary unchanged submission/replay creates one check-in. The feature remains present.
- Grocery checklist/rebuild/purchase preservation, foreign-row denial and a real `%PDF-` response pass. Swap limits, preview tokens and idempotent confirmation remain enforced.
- Administrator overview, accounts, licenses, applications, data, meals, library, audit and safety-operation workspaces return 200 to the admin and 403 to a member.
- Suspending a synthetic RND invalidates an existing token; restoration returns access. Expired PRC blocks review while keeping audit records.
- Applicant email proof, submission, pre-call approval refusal, future-call refusal, simulated elapsed call, confirmation, invitation activation and replay rejection use normal services. No real meeting/email is claimed.
- Reference publication/rollback validates two releases, three activations and 11 audit events; published rows resist mutation. This used an empty dedicated database.
- Checkout acceptance covers signed webhook retries, provider receipt checks, ownership, scheduling/credit/trial preservation and idempotency with mocked PayMongo responses; no real payment was made.
- Supporting-document acceptance encrypts/stores/reads a synthetic PDF payload, records sufficient review and confirmed facts, then supersedes/withdraws documents. Current health-answer readiness is checked independently of optional documents.

## Verification summary

| Gate | Result / evidence level |
| --- | --- |
| Main audit | 66 distinct probes, latest result 66 passed; earlier failed exploratory runs retained in ignored evidence |
| Backend suite | 772 tests: 771 passed, zero failed, one existing TODO |
| Frontend suite | 662 tests passed across 146 files; no frontend product source was changed in this audit |
| Actual API Chromium | Six role/viewport cases, 34 view loads at 390/1440 px; no page exceptions, API 5xx or whole-page overflow |
| Intercepted Chromium resilience/privacy/membership | 15 passed; 10 separate fixture-dependent role cases skipped |
| Additional acceptance | Outside review, integrated roles, membership, report membership, mocked-provider checkout, local document lifecycle, reference publication/rollback passed |
| TypeScript | Backend production, broad acceptance-script and new system-audit script configurations; frontend no-emit check passed |
| Builds / lint | Backend and frontend production builds; backend and frontend lint passed |
| Repository gates | Changed-file formatting, source modules <=900 lines, diff whitespace checks passed |

Browser forwarding uses actual isolated API responses. SSE is forwarded as a stream. Each browser case performs a fresh real synthetic login so expired access tokens in an evidence file do not turn a smoke test into a false login redirect failure. Mobile/desktop load coverage is not a claim that every interactive control was exercised in a browser; mutation behavior above is primarily HTTP/database evidence.

### Reproduction entry points

The following scripts refuse an unapproved database target; the core matrix also requires `NODE_ENV=test`, membership enabled and Gemini disabled. They mutate only the designated synthetic local database. Use migrated PostgreSQL and the ordinary reference corpus; never run them against a shared host.

1. `backend/scripts/system-journey-members.ts 0`, then `1`.
2. `system-journey-planning.ts`, `system-journey-reviews.ts`, `system-journey-tracking.ts`, `system-journey-admin.ts`, `system-journey-boundaries.ts` in order.
3. `system-journey-allergy-source.ts` for fresh restricted source/retry/withdrawal coverage.
4. `system-journey-browser-server.ts`, then opt-in `frontend/e2e/system-journey-live.spec.ts` using `NUTRIMIND_SYSTEM_AUDIT_BROWSER=1` against the local frontend. Stop the audit server afterward.

Stateful scripts are an ordered audit harness, not a blanket replacement for the package's independent unit tests. Later fixtures intentionally expire membership, withdraw recipes and delete an isolated account, so an individual earlier batch should not be blindly rerun against final mutated state. Archived attempt logs are useful for failure reconstruction; latest named results establish retest status.

Evidence files under ignored `.codex-runtime` include `audit-confirmed-*`, `audit-allergy-source-final.log`, `audit-backend-complete.log`, `audit-frontend-baseline.log`, `audit-browser-live-final.log`, `audit-browser-resilience.log`, acceptance logs and `system-audit/state.json`. They are local execution artifacts, not public account data.

## Coverage limits and follow-up verification

- No live Gemini request was made in this isolated audit. Unit/injected provider behavior and corpus success do not prove deployed Gemini model availability, quota recovery, malformed-output recovery or medical accuracy.
- Real Google OAuth, SMTP delivery, external photo/upload delivery, real PRC/identity verification and live payment settlement were not exercised here. Intercepted Google-only deletion UI tests and signed mocked webhooks do not establish those integrations.
- Corpus rejection replacement rice behavior was retested. This is not a claim that every certified deadline fallback or from-scratch AI replacement preserves identical rice semantics; those paths need dedicated provider/serving evidence.
- Empty failed-cycle re-sourcing is verified. Recovery that adds newly reviewed sources into an already populated partial cycle was not verified; existing saved meals are deliberately not replaced by the new empty-cycle path.
- Time-based membership/check-in/call/license tests advance isolated fixture timestamps, not the machine clock or any shared member state.
- The older `case-approval-journey-acceptance.ts` and `current-journey-audit.ts` callers compile after maintenance. Their entire historical runtime scenarios were not rerun; their fixture/context assumptions still require review before relying on them. The new guarded matrix is the current evidence for the tested journeys.
- These tests do not establish qualified clinical review, nutrition accuracy, production concurrency under load, all possible condition combinations or every mobile interaction. Unknown declarations remaining blocked are expected software behavior, not a finding that their medical meaning was resolved.

## Integration and cleanup

Repairs are intended for `origin/development`, with Codex attribution. The grocery migration is additive and must accompany the updated generated Prisma client on any future deployment. This request does not independently promote demo/production.

The task-owned API and PostgreSQL container are stopped after verification; their local synthetic data and ignored evidence remain available for a deliberate rerun. No temporary elevated test account was created in a shared database by this audit. Existing owner development servers remain running.
