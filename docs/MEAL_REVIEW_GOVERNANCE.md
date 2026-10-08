# Meal review governance

Change: CHG-20261008-05. Software verification: October 8, 2026. This workflow is not clinical approval.

## Recipe lifecycle

| Event | Recipe state | Required next action |
| --- | --- | --- |
| First flag on a published recipe | Pending re-review; unavailable to members | One uninvolved eligible RND claims and re-verifies the current version |
| Extra reports during a hold | Same incident; unavailable | Review the additional concerns; previous confirmations become stale |
| Flag after first re-verification | Quarantined; unavailable | Two independent current RND confirmations, then admin release |
| Material correction | Hold remains | Review the new version; previous confirmations become stale |
| Admin release | Library eligibility restored | Existing member slots still require fresh eligibility and approval checks |
| Any flag after a prior quarantine | Quarantined immediately | Two confirmations and admin release again |
| Admin archive | Entire lineage archived | Unresolved recipe remains unavailable |

Incidents follow the original recipe lineage, including corrected versions and serving variants. Creating another serving cannot reset the count or escape the hold. A database trigger prevents changing a governed recipe's lineage or publishing a held serving directly. The existing internal `FLAGGED` status continues enforcing member safety blocks; `MealReviewLineage.state` distinguishes pending re-review from quarantine.

Legacy flags remain intact. Their first governed case is incident zero with unknown prior history. The system does not infer incidents by counting variant rows. Future actual publication/flag cycles are recorded normally.

## RND review

The RND meal library contains a shared pending/quarantine queue and a meal-wide review panel. Each report requires a category, affected ingredients or nutrition fields, explanation, evidence/reference, and proposed correction. Publication starts a new incident; reports while held add evidence only.

The reviewer must hold the existing exclusive 30-minute claim. Every recorded concern needs a resolution and the reviewer must acknowledge checking nutrition, measured ingredients, preparation and rice role for every serving. Version hashes bind decisions to the recipe, source composition revisions and report set. Expired licenses, suspended accounts, unverified email or incomplete account activation do not qualify.

Authors, all correction authors, flaggers and the verifier whose decision is challenged cannot confirm the incident. Quarantine requires two different currently eligible reviewers for the same version. Admin release rechecks their independence, qualifications and concern resolutions. Admins may flag or archive, but cannot provide clinical RND confirmations.

Corrections use the existing authoring validation and measured FNRI quantities to calculate nutrition. Before/after values are saved as immutable decisions. Changes remove stale safety declarations and invalidate condition/profile clearances. Re-review can restore base recipe verification; a corrected recipe's separate safety certification remains stale until its existing certification workflow is completed.

Profile and condition approval flags use their separate scoped workflow. They suspend only the affected approval and its dependent member slots, rather than withholding the recipe globally.

## Admin oversight and member attribution

Admin audit records expose chronological review snapshots, report notes, resolutions, actors, timestamps and effective nutrition. New report, confirmation and decision records are append-only at the database level. Missing historical snapshots are labeled unavailable; current values are shown separately.

Related clinical detail access is read-only and derived from the persisted audit case relationship. Clients cannot choose an arbitrary member. Profile/evidence reads and original clinical file downloads produce access audit records. Withdrawn or unrelated files cannot be downloaded. Recipe-only audit cases grant no member clinical access.

Reviewed member meals use the same **Reviewed by [name], RND** credential control. It labels recipe review and member-specific approval separately, retaining recorded reviewer attribution. Missing experience, university, specialization or license fields are shown as not recorded. Existing URLs and the internal `NUTRITIONIST` role identifier remain unchanged.

## JSON batch meals

Use **Admin → Meals → Batch meals** to download a template, select recipes to export, upload/edit JSON, preview errors and import valid drafts. The envelope is `KAINARA_MEALS_V1` with a `meals` array. Limits are 100 meals and 2 MB.

Recipe objects use the normal admin authoring fields: name/type, summary, preparation instructions, nutrition basis, serving description, nutrient values and ingredients with current FNRI `foodItemId` plus `gramsPerServing`. Missing mappings, quantities, instructions or evidence require correction. Export does not guess missing values. Existing exact recipes produce duplicate errors unless the identical payload is a previously completed import by that administrator, which returns its saved result.

Files contain no member data, review flags, approvals or reviewer identities. Import always creates new unverified drafts; it never overwrites a published meal. A valid preview is saved for its administrator. Import revalidates current mappings and duplicates within one atomic transaction. Any error cancels the entire batch. Retrying a completed preview returns the original drafts without creating duplicates.

## API entry points

| Interface | Endpoints |
| --- | --- |
| RND cases | `/api/nutritionist/meal-review-cases`, `/:id`, `/:id/claim`, `/:id/confirm`, `/:id/correct` |
| Admin cases | `/api/admin/meal-review-cases`, `/:id`, `/:id/release`, `/:id/archive` |
| Recipe flags | Existing `/api/{admin,nutritionist}/library/:id/flag`, now requiring `expectedVersion` and structured `notes` |
| Scoped flags | Existing `/api/nutritionist/library/:id/approvals/flag`, requiring kind, approval ID, expected recipe version and notes |
| Admin oversight | `/api/admin/audit-history/:id/review-context`, `/documents/:documentId/file` beneath that case |
| Batch meals | `/api/admin/meals/batch/template` (GET), `/export`, `/preview`, `/import` (POST) |

Case actions require the current review version; flags require the current recipe version. Stale submissions return a conflict. Refresh, inspect the changed evidence and submit a new decision. The former reason-only whole-meal release cannot bypass claimed version-bound review.

## Verification and rollout

Migration: `202610080002_meal_review_governance`. It is additive and includes incident history, immutable snapshots, confirmations, batch retry receipts, lineage hold enforcement and state constraints.

The guarded backend acceptance command is `npm --prefix backend run test:acceptance:meal-governance`. It refuses any database except an empty task-owned `127.0.0.1:55485/kainara_meal_governance` fixture with `NODE_ENV=test`; real provider keys must be disabled. Apply all migrations only to that disposable fixture before running it. Configure synthetic JWT and clinical-document encryption keys for the fixture. Never run the fixture against a shared or production database.

Results and scope are recorded in [verification evidence](verification/MEAL_REVIEW_GOVERNANCE_2026-10-08.md). Browser checks use synthetic API interception; actual HTTP/authentication/SQL authorization is exercised separately in the disposable backend fixture. These tests do not constitute live credential verification or clinical sign-off.

Development integration is separate from shared migration application and demo promotion. Before applying the migration to a shared target, confirm authorization and the database identity, create and verify a backup, and follow the repository migration procedure. Deploy the compatible generated Prisma client and API only after the migration. Existing member holds must not be bulk-cleared during rollout.
