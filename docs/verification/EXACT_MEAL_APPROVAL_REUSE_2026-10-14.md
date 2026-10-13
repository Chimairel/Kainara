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

This change has real API/SQL and component verification; it does not claim a new authenticated browser journey or clinical validation. No migration or provider/configuration change is required. Implementation is in the shared Desktop checkout and committed locally; live publishing remains separate.
