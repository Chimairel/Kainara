# Flag draft lock verification — October 15, 2026

## Behavior

Clicking Flag reserves one private draft before the reasons page opens. Another eligible RND can read the meal, saved review and audit, but sees **Flag in progress** and its owner's name. No live text sharing was added. Server status refreshes every 15 seconds while the relevant view is visible; begin and submit always check the current database state.

The meal remains available until a valid flag is submitted. Meal flags cover the recipe family, while approval flags affect only the selected approval and its actual usages. Existing independent re-review requirements remain in force.

Drafts autosave after brief typing pauses. Closing the meal canvas flushes pending edits; reopening restores saved notes. Abrupt browser termination before an edit reaches the server cannot guarantee recovery of that unsent edit. Cancel removes the draft page, clears its notes and releases the lock. Thirty minutes without saved edits expires the lease; polling alone cannot extend it. Expired notes can be recovered by their owner when the same evidence is still current and the target is free. An explicit cancellation prevents older expired notes resurfacing.

## Automated checks

| Check | Result |
| --- | --- |
| Backend full suite | 1,085 passed; one existing TODO |
| Backend production build and test TypeScript | Passed |
| Frontend full suite, two workers | 1,206 passed / 234 files |
| Frontend Node checks | Eight passed |
| Final focused draft hook and canvas components | 30 passed / five files |
| Frontend production build and TypeScript | Passed |
| Scoped lint | No errors; three existing approval-lifecycle warnings |
| Impeccable UI detector | No findings |

The first default-concurrency frontend run failed two unrelated timing-sensitive fixtures. A complete two-worker rerun passed; those fixture files were not modified. A stale availability-response race was fixed and covered by a hook regression. An actual simultaneous case submission exposed a serializable conflict; bounded retries now return the saved receipt without duplicate clinical effects.

## Normal shared runtime acceptance

Tests used the existing localhost:5000 API and localhost:3000 frontend, existing synthetic accounts, and uniquely named `qa-flag-draft-20261015*` fixtures. No isolated server or browser token injection was used. The defense database host and database name were asserted before database mutations.

Twenty-six runtime assertions covered:

- Simultaneous begin on a recipe and its variant produces one owner and one clean blocked response.
- Owner status restores saved notes without renewing expiry; another RND receives no private notes.
- Meal detail and staff history endpoints remain readable, and no incident or withholding occurs during drafting.
- Wrong-owner cancellation, cancelled submission, expired submission and changed-evidence submission are rejected.
- Cancellation releases the target, expiry allows takeover, and a later cancellation prevents an older expired draft from resurfacing.
- Concurrent repeated whole-meal submissions produce one incident report and one shared result, with the family withheld only at submit.
- Case approval begin has one owner; concurrent submissions produce one approval flag audit and replay the receipt.
- Profile and condition approval submissions also produce one flag audit under concurrent retry.
- Admins respect RND-owned meal leases and cannot enter RND-only approval flag workflows.
- All four draft lifecycle actions are recorded without unpublished reasons in their audit metadata.

The shared browser confirmed a private reason restored after closing and reopening the canvas, Cancel removed its page, and another RND saw a disabled action naming the holder while both evidence sheets remained readable. Only the RND browser journey was exercised for the new UI; admin and scoped approval boundary/concurrency checks used the normal HTTP API. These are software checks, not clinical validation.

Local screenshots:

- `codex_outputs/flag-draft-recovered-20261015.png`
- `codex_outputs/flag-draft-blocked-20261015.png`

## Data and cleanup

Additive migration `20261015040000_review_flag_drafts` applied successfully; 108 applied migrations were confirmed. The partial unique index is deliberately expressed in migration SQL because Prisma's schema cannot express that predicate.

Cleanup completed at **2026-10-15 06:31:28 UTC**: six owned synthetic meals archived, two synthetic plan rows cancelled, synthetic condition clearance revoked, zero active synthetic draft leases. Audit, decisions and reports remain retained. No account password, real-member meal decision, original review claim, source nutrition value or secret was changed. Agent-created browser tabs were closed.

This record verifies the shared local runtime. Pushing a demo branch is separate from confirming a hosted deployment.
