# Exact meal approval reuse — October 14, 2026

## Accepted behavior

The owner replaced the reference-only health-condition policy with automatic reuse when every relevant recorded field matches. Reuse makes a scheduled meal APPROVED and available without a second meal-case review. It does not record consumption. Initial health-profile confirmation, current acknowledged guidance, base verification, claims, flags, disputes, and current RND eligibility remain required.

Matching covers body measurements, goal, targets, activity, dietary/rice/cultural preferences, shopping preferences and geography; condition/allergy/custom declarations; full health-detail responses and resolved clarification answers; document content digests and facts; exact recipe/serving signatures, ingredient amounts/units, linked composition revisions, nutrients and side portions. Account identifiers and bookkeeping timestamps are not clinical matching fields.

New decisions capture `EXACT_REVIEW_APPROVAL_V2`. Existing V1 references are reusable only when their saved immutable decision context also passes the stronger V2 clinical comparison. Historical decisions without captured reference evidence are not reconstructed from current profiles. No broad historical backfill is performed.

Reuse provenance lives in the target plan's internal selection evidence. A system audit event identifies reuse; no new human decision is written under the original RND's identity, and no new access to the target member is granted to that RND. Member responses show recorded RND credentials while excluding source patient identities, notes, answers and internal fingerprint/reference fields. Future reads revalidate the source, current context and serving; invalidation returns the reused slot to pending. Lifting a flag does not automatically resurrect that slot.

The shared clearance service performs reconciliation during generation lifecycle synchronization and current/upcoming meal and grocery reads. An active claim or a prior target decision keeps its own review path. Profile, guidance and meal-context loading is batched for cycle slots. Transactions serialize against profile changes and retry serializable write conflicts.

## Verification

- **15 PostgreSQL/HTTP scenarios passed**, using 15 fictional accounts in a fresh ownership-checked loopback PostgreSQL database. The wrapper creates the exact current schema, disables external providers, runs the checks, disconnects, and removes only its newly created database. Shared Neon data was not used for fixture writes.
- All five built-in condition cases passed: diabetes (combined with nuts allergy and a V1 reference), hypertension, kidney disease (raw recipe source), heart condition (verified base without a separate library safety-reviewer relation), and pregnancy (verified generated base).
- Negative checks cover changed age/weight/goal, ingredient quantity, side portions, composition revision and nutrient evidence, active target claim, unconfirmed health profile, quarantined/flagged bases, expired original reviewer, and disputed source decision. Unit checks cover every planning field, clinical answer and document digest.
- Concurrent clearance requests create one reuse audit event, no extra human decision and no consumption record. Admin/RND audit summaries and the meal-scoped approval filter include system reuse. A recipe flag invalidates the target and later release does not resurrect it.
- The member current-plan HTTP route returns the reused meal and original RND attribution without clinical canaries or internal reuse fields. An explicit member status request creates the DONE consumption record.
- **41 backend tests** and **2 focused frontend tests** passed. Backend production build, script TypeScript, scoped ESLint, frontend production build and whitespace checks passed.

Run from `backend`:

```powershell
npx tsx scripts/exact-meal-approval-reuse-local-acceptance.ts
npx tsc --project tsconfig.exact-meal-reuse.json
```

The implementation verification above used API/SQL and component checks. The additional authenticated browser journey below is software verification, not clinical validation. No migration or provider/configuration change is required. Implementation is in the shared Desktop checkout and committed locally; live publishing remains separate.

## Shared browser journey — exact health context

On October 14, 2026, the owner requested the shared localhost runtime rather than an isolated database. The test used `localhost:3000` and its normal API at port 5000. Fixture writes therefore affected the shared defense database; only the new `exact-browser-1014` synthetic accounts and their own profiles, cycles and meal candidates were prepared. Existing member profiles, meal decisions, recipes and provider settings were not changed.

Two labelled synthetic members had identical fictional hypertension declarations, complete health-detail answers, body measurements, goal, activity, calculated target, diet, rice, culture, shopping preferences and acknowledged guidance. Their profile-confirmation prerequisites were prepared as fixtures. Both received the same recorded Pandesal serving, signatures, ingredient quantities/units and linked composition references. Recipe/serving facts came from an existing approved Panlasang Pinoy candidate; no new recipe was published globally and no clinical context from another member was copied. Both complete matching fingerprints were present and equal before approval.

The synthetic RND signed in through the browser, found only the first synthetic member using the queue search, claimed its case and submitted **Confirm approval** with a software-test note. The first serving attempt was rejected by the calorie gate; both synthetic profiles were then given the same suitable activity/target and current guidance snapshots before the successful decision. The successful browser request exceeded the UI response budget but ultimately committed exactly one approval and one V2 reference. A diagnostic service call subsequently refused another decision because the source was already approved; no duplicate decision was created. This slow/uncertain-response behavior remains a finding of this run.

The RND signed out, and the second member signed in normally. Before that login its serving was `PENDING_REVIEW` with no decision or reuse provenance. Normal dashboard/meal reads automatically changed it to `APPROVED`, cleared safety revalidation and recorded the first member's captured approval reference. No RND claimed or decided the second case. The browser then showed:

- **Plan:** Pandesal with **Verified** / **RND Approved**, the recorded synthetic RND attribution and no pending badge.
- **Library:** one Pandesal card, **Scheduled for you** / **In your plan**, and **View planned meal** opening the approved serving.
- **Audit/data:** one `MEAL_PLAN_APPROVED` for the source and exactly one `MEAL_APPROVAL_REUSED` for the target, one source human decision, zero target human decisions, and zero consumption records.

Fixture cycle dates were aligned to Manila business midnight for the current-day display. The current-day meal details showed **Mark as eaten** enabled; the test did not press it. This verifies automatic clearance of an existing scheduled candidate on login/read and its inclusion in the member Library; it does not establish full weekly generation from an empty account or exact-match catalogue discovery before a candidate is scheduled.

The current-day reload exposed a real `P2028` failure: exact-approval revalidation exceeded its 30-second interactive transaction. `reconcileExactMealApprovals` now has a bounded 60-second transaction budget, within the member workspace's 90-second request budget. Isolation, locks, match fields, source eligibility, invalidation and retry rules are unchanged. The diagnostic workspace read subsequently returned HTTP-equivalent 200 with one approved meal, `pendingReview: null`, and the current cycle in 67.4 seconds. This fixes the observed transaction failure; it does not establish fast response times or guarantee arbitrary 21-slot clinical workloads fit that budget.

After the fix, a fresh authenticated browser reload displayed the current-day approved meal without the workspace error. Its details showed **RND Approved** and enabled **Mark as eaten**. The three focused reusable-reference tests, scoped ESLint, backend production build and scoped database assertions passed. No frontend source changes were made.

Scoped database assertions passed. Private setup scripts/manifests and test credentials remain under ignored `backend/.local`; no credentials are included in this record. Browser screenshots are saved locally in `codex_outputs/exact-context-second-library-2026-10-14.png` and `codex_outputs/exact-context-second-plan-2026-10-14.png`. Synthetic fixtures are retained for owner inspection. No migration, deployment or provider configuration changes were made.
