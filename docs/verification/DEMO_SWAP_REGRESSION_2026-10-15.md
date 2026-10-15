# Demo swap regression and recent-release audit — October 15, 2026

## Confirmed cause

The member swap preview succeeded but confirmation returned HTTP 400 with `Failed to execute meal swap.` Railway recorded five failures between 14:06:43 and 14:09:38 UTC. The underlying error was a Prisma 5.22 Rust query-engine panic at `query_document/mod.rs:83:86`, `Option::unwrap()` on `None`, while executing parallel snapshot and meal reads inside the swap transaction.

The October 14 optimization `f6c3972b` added explicit `relationLoadStrategy: 'query'` to model reads through the shared client extension. A controlled local comparison of the same parallel unique/many reads inside an interactive transaction passed with the preceding extension behavior and panicked with the explicit strategy. This exposed an older parallel-read pattern introduced in `217ecd40`; the October 15 notification-label pushes did not edit it. Earlier verification missed member swap execution through this client configuration.

At inspection, Railway deployment `29fd71f6-3063-4e94-9450-1e9a3c6d5ae4` and Vercel production `nutrimindv1-jsp1cyhuv-chimairels-projects.vercel.app` both reported commit `6212344e9f203e98afe06cd1f4ebeb2a581b1079`. There was no frontend/API commit mismatch. The newer assistant branch was not deployed. Localhost database isolation did not cause this query-engine failure.

## Audit scope and findings

Reviewed recent demo commits, the shared-client optimization, and parallel unique-read call sites. Reproduced these transaction failures using isolated local PostgreSQL:

| Path | Finding / repair |
| --- | --- |
| Member source and library swaps | Shared day-macro reads panic. Use `findFirst` on the same unique plan-group key. |
| Library swap rice lookup | Parallel snapshot unique read and rice read also panic. Preserve the same unique predicate using `findFirst`. |
| Existing daily intake log | Recalculation panics in parallel profile/snapshot unique reads. Both use the same indexed unique-key predicates with `findFirst`. |
| Membership checkout context | Account/balance unique reads mixed with checkout/grant lists panic inside a transaction. Preserve user/account scoping using `findFirst`. |
| RND application admission | Parallel unique email and other identity reads panic before email-proof validation. Preserve exact normalized-email lookup using `findFirst`. |

No eligibility, restriction, claim, approval, signature, membership allowance, preview acknowledgement, audit or email-verification gate was removed. No dependency, schema, feature flag or reference-data change is required.

Railway's filtered runtime error search from 08:09 to 14:20 UTC returned the five swap errors and their Prisma error lines. It did not establish that every other path was healthy: the membership/application failures were found locally by examining the same query pattern. A 501-entry recent HTTP sample contained no 5xx; expected auth/conflict responses and the swap's generic 400 were present. This is a bounded regression investigation, not a complete system audit or proof that all live defects are resolved.

## Verification

- Exact original transaction crash reproduced before repair; the repaired macro transaction completes.
- Full member source swap on the existing explicitly named local synthetic member passed: preview, successful execution, persisted replacement nutrition/components, allowance log, notification and idempotent replay. Repeated with an existing daily intake log, exposing and then fixing the additional recalculation panic. All writes rolled back. This fixture currently has source options but no eligible certified-library option; a full certified-library swap is not claimed.
- Added `npm run test:acceptance:parallel-transactions`, guarded to `127.0.0.1:55432/kainara_local_development`. It uses the real Prisma engine for macro/membership transactions, rolls back a synthetic user/cycle/meal/daily-log recalculation, and exercises actual application admission to the existing `APPLICANT_EMAIL_UNVERIFIED` gate without creating an application or sending email.
- Backend application build and test TypeScript passed. Backend suite: **1,123 passed, zero failed, one existing TODO**. Existing macro/RND-search mocks were updated to the repaired read method without changing their behavioral expectations.
- Meal, RND review and outside-food UI suites: **236 passed across 50 files**. No frontend code changed.
- At 14:30:58 UTC, bounded read-only migration comparison reported **109 hosted / 111 local** migration rows, no failed migrations, no pending migrations against each target's branch and no checksum drift. Local-only migrations are `20261015100000_member_assistant` and `20261015140000_water_residual_precision`; they are outside this hotfix. No hosted member or catalogue data was modified.

## Release state

The owner explicitly authorized publishing the swap hotfix while the separate meal/profile-question correction proceeds locally. Implementation commit `963435ce` was promoted as narrow release `9f16e4af3dcde6839e41ea5370de147088aa6adf`, parented directly on `6212344e`. Only 12 reviewed backend/test/documentation files changed; frontend, migrations, lockfile and deployment configuration match the prior demo. The separate assistant branch and its migrations were excluded. A temporary Git index and committed archive kept unrelated shared-checkout edits out of the release.

The release archive's backend build and real-engine local acceptance passed. Its backend suite had 1,086 passes, one existing TODO and one missing-root-script harness error; after extracting the complete committed repository, both database-guard tests passed independently (1,087 behavioral passes in total). This is distinct from the larger feature branch's 1,123 passing tests.

| Host | Verified release |
| --- | --- |
| Railway API | `2b03e3ae-c0d8-4815-a256-53d0c0e9901b` — SUCCESS, commit `9f16e4af`; `/ready` passes |
| Vercel frontend | `nutrimindv1-31los7i5t-chimairels-projects.vercel.app` — READY, commit `9f16e4af`; public application returns HTTP 200 |

The repaired macro query completed inside an explicitly read-only transaction against the confirmed hosted defense database using the exact released backend code. The agent's authenticated request was rejected by the hosted API (401); no hosted signing credential was retrieved and no saved meal was changed by that check. The owner subsequently tested the signed-in live swap and explicitly confirmed that it worked. No migration, configuration, catalogue or member-data change was required. Code rollback remains the preceding compatible `6212344e` pair; no database rollback is needed.
