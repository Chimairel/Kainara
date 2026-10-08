# Meal governance verification — October 8, 2026

Change ID: CHG-20261008-05.

## Actual HTTP, authentication and SQL

The guarded `backend/scripts/meal-governance-local-acceptance.ts` ran successfully against a fresh, task-owned PostgreSQL 17 fixture at `127.0.0.1:55485/kainara_meal_governance`. All 95 migrations were applied. Accounts, mapped composition food, member cases and encrypted supporting files were synthetic. No external provider calls or shared database writes were made.

| Scenario group | Verified assertions |
| --- | --- |
| Roles and notes | Member cannot flag; suspended/expired RNDs rejected; structured fields/version required; no author self-confirmation |
| Concurrent first flags | RND/admin reports through different variants create one incident; all serving variants held; member slots require safety revalidation; grocery list stale; one withholding notification |
| First re-review | Claim, independence, evidence acknowledgements and every concern resolution required; valid re-verification publishes recipe; stale flag fails; old member holds remain |
| Second incident | Quarantine rather than pending; two distinct confirmations required; expired credentials no longer count; admin release blocked early |
| Database enforcement | Reports/decisions/confirmations cannot be rewritten/deleted; serving created during quarantine remains held; direct publication and lineage detachment cannot bypass hold |
| Corrections and future flags | Additional reports do not increment count; material correction invalidates confirmations; immutable original/effective values retained; current-version release succeeds; later flag quarantines immediately and both challenged quarantine confirmers are excluded |
| JSON batches | Template and selected export; mapping/gram errors; 100-meal/2-MB limits; wrong owner rejected; duplicates revalidated; all-or-nothing failure; repeat imports return same drafts |
| Approval-specific flags | Only the selected approval and dependent member plan suspended; base recipe and unrelated member remain unaffected |
| Admin clinical oversight | Case relationship enforced; arbitrary member query/unrelated audit/file rejected; read/file accesses recorded; encrypted related file decrypts; withdrawn file rejected; member review attribution retained |
| Legacy and archive | Prior incident count remains unknown rather than guessed; unresolved lineage archive keeps all serving versions unavailable |

The ten scenario groups passed after the final eligibility, notification, grocery and lineage-detachment checks. Immutable evidence is enforced by the new migration's PostgreSQL triggers. The test also exercises concurrency using actual database transactions, rather than mocked Prisma calls.

## Deterministic checks

- Backend: **812 passed**, zero failures, one existing TODO (813 total).
- Frontend: **744 Vitest tests** and **8 Node security/worker tests** passed.
- Backend and frontend lint passed.
- Backend production build passed: 182 compiled modules with rewritten aliases.
- Frontend production build passed: 62 pages.
- Source architecture and whitespace checks passed. No dependencies added.

## Browser presentation

Twelve Chromium checks passed using the production frontend and synthetic API interception:

- Admin and RND quarantined-case panels at 390 px and 1440 px: recorded concerns, immutable nutrition timeline, RND claim/confirmation controls, disabled premature admin release and available unresolved archive.
- Admin JSON preview/import at 390 px and 1440 px: correction-required errors, disabled invalid import, valid preview, new unverified drafts and one import request.
- Existing admin/RND audit details, failure/retry and recorded missing values at 320 px, 390 px and 1440 px.

Phone admin review/batch and desktop RND review screenshots were inspected. Tested pages and detail panels had no horizontal overflow or page exceptions. The initial audit browser attempt used the old “Nutritionist history” selector; updating it to the new “RND history” label resolved the failure. Two unit failures caused by a new audit child requiring a missing AuthProvider were resolved by passing the caller's authenticated owner ID; stale responses are discarded after account changes.

## Limits and rollout

This is software verification with synthetic data. It does not establish clinical correctness, live credential validity, external-provider behavior or an actual patient journey. Browser API fixtures test presentation; the disposable backend fixture supplies separate server authorization and transaction evidence.

The additive migration `202610080002_meal_review_governance` was **not** applied to the shared development or demo databases. Shared migration application requires a confirmed target, authorization and verified backup. Demo promotion remains separate. Existing member holds require fresh safety/approval checks after release; a corrected recipe's stale safety certification still needs its normal RND certification workflow.
