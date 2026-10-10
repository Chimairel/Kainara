# Exact review reuse — actual browser QA, October 10, 2026

## Result

The requested journeys passed in the connected in-app browser: **16 exact source/target pairs, four negative comparisons, 33 browser-submitted approvals, 33 opened admin snapshots and 16 target member credential/note checks**. These software checks do not establish clinical suitability or provider-backed completion of a real 21-slot plan.

## Environment and method

- Started at `81f34142`, branch `development-synced`. One presentation correction hides `foodItemId` in admin recorded fields.
- Frontend/API used loopback ports **3002/5002**. Task-owned PostgreSQL container `codex-rnd-canvas-20261009`, port **55488**, database `kainara_browser_full_20261010_v3`, had all 103 existing migrations.
- Created **36 synthetic members** (32 source/target members and four near-match members), three RNDs (author, reviewer, observer), and used the existing synthetic admin. Author and reviewer submitted the decisions; observer was available but did not decide cases in this run.
- Actual password sign-ins, queue selections, claims, reference expansion, approval dialogs, credential cards and admin audit controls were used. Localhost and 127.0.0.1 origins isolated simultaneous role cookies. No injected sessions, mocked browser responses, hidden browser fetches, or script-written meal approvals/reference rows.
- Account creation bypassed email/onboarding/application as previously requested. Complete health details, current profile-review prerequisites and acknowledged guidance were seeded; those prerequisite journeys were **not** retested through the browser here.
- External AI, mail and payment providers were disabled. Shared Neon and normal localhost services were preserved. No shared migration, rollout or demo promotion.

## Case matrix

Every row passed: source approval by Reuse author; exact target reference to that approval; separate target approval by Reuse reviewer; admin opens both decisions; target member sees their own reviewer and fresh note.

| Case | Exact reference and fresh approval | Admin snapshots | Target member |
| --- | --- | --- | --- |
| No condition / no allergy | Passed | Passed | Passed after fixture replacement |
| Diabetes | Passed | Passed | Passed |
| Hypertension | Passed | Passed | Passed |
| Kidney disease | Passed | Passed | Passed |
| Heart condition | Passed | Passed | Passed |
| Pregnancy | Passed | Passed | Passed |
| Gout | Passed | Passed | Passed |
| Celiac disease | Passed | Passed | Passed |
| PCOS | Passed | Passed | Passed |
| GERD | Passed | Passed | Passed |
| Shellfish allergy | Passed | Passed | Passed |
| Nut allergy | Passed | Passed | Passed |
| Dairy allergy | Passed | Passed | Passed |
| Gluten allergy | Passed | Passed | Passed |
| Egg allergy | Passed | Passed | Passed |
| Diabetes + nut allergy | Passed | Passed | Passed |

All currently listed condition choices including None, five non-None allergy choices and a combined case were represented. This bounded matrix does not cover every combination of age, diagnosis, medication, ingredient or severity.

### Exact and negative matching

- Exact targets remained pending and needed their own claim and decision. References did not automatically approve them.
- Expanded references showed recorded RND attribution, date and plate nutrition: **795 kcal, 33 g protein, 102 g carbs, 15.15 g fat**, plus the separate-decision explanation.
- Other members' identity/details and `PRIVATE SOURCE` note canaries were absent from references. Target members saw their fresh target note.
- Four diabetes controls showed **no matching prior review**: weight 71 vs 72 kg; age 37 vs 36 within the same age category; different recorded diabetes subtype/details; cooked-rice serving 151 vs 150 g. No decisions were made for negative controls.

### Admin and member checks

- Opened all source/target approvals through **RND history → Details → Open related review details**, including the additional healthy replacement approval.
- The shared read-only canvas retained the correct reviewer, rationale, saved member context and original/effective meal evidence, without clinical decision/claim controls. Sensitive-detail access records appeared in Admin activity.
- All 16 members opened **Reviewed by Reuse reviewer, RND · Your meal approval** and its clinical-note tab. Missing education/experience/specialization remained **Not recorded**.
- An opaque ingredient `foodItemId` was visible in admin evidence. The presentation fix hides it alongside other internal linkage fields. Browser recheck confirmed its absence while nutrition remained visible.

## Fixture corrections and interruption

Initial fixture guidance did not point to its seeded report. Correcting that prerequisite resolved stale-context rejection before approvals. The serving control initially used the wrong enum; fixing `COOKED_RICE` and recalculating actual quantities/macros produced the expected no-reference result.

Initial cycle boundaries used a future midday timestamp instead of normal Manila boundaries. They were normalized. An early healthy-member visit had already caused preparation to supersede/cancel that misdated fixture slot. Its original browser decision/audit were preserved. A **new pending** measured slot was created in the corrected synthetic cycle, then claimed and approved through the browser. Its member view and additional audit passed. Hence **33**, not 32, browser approvals; seed operations did not fabricate the replacement approval.

A bulk fixture date normalization encountered a unique-cycle conflict after its healthy update. No broad retry/deletion was performed; the healthy fixture was corrected specifically. These are fixture limitations, not demonstrated product defects. Provider-disabled one-slot fixtures may display preparation notices; weekly generation completeness is outside this run.

The app closed during testing; the browser was reattached and remaining checks continued. An apparent day-selection issue resolved with a semantic keyboard action after an automation click hit the wrong target; no unsupported product fix was made.

## Verification and artifacts

- `CaseReviewContext.test.tsx` and `AdminAuditWorkspace.test.tsx`: **10 tests across two files passed**, two workers. ESLint passed for `RecordedCaseFields.tsx`.
- This run did not repeat prior full builds/suites; separate evidence is in [Admin canvas QA](ADMIN_CANVAS_QA_2026-10-10.md).
- [Browser decisions/comparisons](verification/reuse-browser-2026-10-10/browser-results.json), [admin snapshots](verification/reuse-browser-2026-10-10/audit-results.json), [member checks](verification/reuse-browser-2026-10-10/member-results.json).
- [Exact reference](verification/reuse-browser-2026-10-10/rnd-exact-reference.png), [weight mismatch](verification/reuse-browser-2026-10-10/rnd-weight-mismatch.png), [fresh member attribution](verification/reuse-browser-2026-10-10/member-fresh-attribution.png), [final admin canvas](verification/reuse-browser-2026-10-10/admin-recorded-context.png).

## Synthetic accounts

Emails are `reuse.<case>.source@example.test` and `reuse.<case>.target@example.test`, using lowercase codes: `none`, `diabetes`, `hypertension`, `kidney_disease`, `heart_condition`, `pregnant`, `gout`, `celiac_disease`, `pcos`, `gerd`, `shellfish`, `nuts`, `dairy`, `gluten`, `eggs`, `combined`.

RNDs: `reuse.author@example.test`, `reuse.reviewer@example.test`, `reuse.observer@example.test`. Admin: `browser.admin@example.test`. Negative members: `reuse.diabetes.weight@example.test`, `reuse.diabetes.age@example.test`, `reuse.diabetes.subtype@example.test`, `reuse.diabetes.serving@example.test`.

These belong to the retained **disposable preview database**, not normal localhost:3000/shared Neon. Local fixture credentials and restart configuration remain in task-local files outside committed evidence. Preview services are stopped after testing; account access requires restarting that preview.
