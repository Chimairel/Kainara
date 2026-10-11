# Recovered plan rice evidence and recipe presentation

## Confirmed cause

The reported October 12–18 plan still contains 21 approved source meals created on October 7. Fifteen have a 225 g cooked-rice component recorded as `FNRI:0`; the recovered FNRI food is revision 1. The authoritative cycle clearance check correctly excludes stale rice evidence, producing six visible meals and two empty days. Generation is completed, not idle or waiting for AI.

The governed rice remains 129 kcal, 2.1 g protein, 29.7 g carbohydrate and 0.2 g fat per 100 g. All 15 saved rice components match the current four macros exactly. The previous nutrient-evidence completion advanced the source revision without refreshing these older unrestricted composed servings. This mismatch is present in the prepared recovery baseline; the October 12 contract release changed neither those database records nor the clearance rule.

Two saved recipes also return their ingredients in a different SQL relation order from their source arrays. General-source eligibility now compares a multiset of normalized ingredient names, quantities and units. Ingredient multiplicity, actual changes, missing items, portion checks and clinical restrictions remain enforced. Recipe signatures already use order-independent ingredient identities.

## Targeted repair

The owner confirmed a fresh backup and repair of only the reported member's 15 untouched servings on `nameless-dust-38810716` / `br-round-art-b355gp02` / `neondb`. The exact private member/cycle identifiers and before/after row snapshots remain under ignored `backend/.local/defense-audit-20261012/`.

The explicit maintenance command `backend/scripts/repair-unchanged-rice-evidence.ts` defaults to a read-only preview. Application requires the exact target, matching preview fingerprint and verified custom PostgreSQL backup checksum. It serializes profile/cycle/plan changes, locks source/food records and rechecks the fingerprint before writing.

Only unrestricted, unreviewed, approved original Panlasang source servings with identical base ingredients/nutrients, rice quantities/nutrients, valid old signatures and current source eligibility qualify. It excludes logged, claimed, superseded, reviewed, restricted, flagged, retired, clinically cleared or changed-nutrient servings. It recomputes the composed signature and review-work identity against the current rice revision, updates the evidence label, records one honest maintenance audit per slot and marks the cycle grocery projection stale. Meal IDs, choices, totals, ingredients, existing decisions, logs and approvals are preserved. It creates no RND approval. The helper is not called by normal reads or the worker.

A bounded read found three stale rice servings in another recovered cycle. They are outside this authorization and remain untouched. Newly prepared servings use the current food revision; future source changes must still invalidate stale evidence.

## Recipe presentation

The display-only shared title helper shows “French Toast” instead of “How to Make French Toast - The Basic Recipe.” Saved source titles and lookup/evidence identities remain intact. Compact missing-photo thumbnails use the existing neutral utensils icon and an accessible “photo unavailable” label, instead of a category egg icon that could be mistaken for the food photograph. No additional card copy is added.

The saved French toast source has no image/video URL. The [original source article](https://panlasangpinoy.com/how-to-make-french-toast/) still references `wp-content/uploads/2014/10/french-toast-recipe1.jpg`, but that asset returned HTTP 404 during this investigation. No unrelated image is substituted. This release does not restore an unavailable provider photograph.

## Verification

- Local PostgreSQL rehearsal against the prepared recovery copy: six cleared meals before repair, 21 afterward, three per day, zero eligible rows on retry. Complete plan rows match before/after except the recomputed serving/work signatures; nutrient totals and approvals are unchanged. The transaction was rolled back and the recovery baseline retained its original counts/audits.
- Full backend: 975 passed, zero failed, one existing TODO. Focused recipe/rice tests: 43 passed. Backend application/test TypeScript, build and changed-file ESLint pass.
- Frontend: 42 affected title/photo/card tests pass; TypeScript, changed-file ESLint and production build pass. Formatting, whitespace, architecture limits and API route inventory pass (1,158 source files, 306 route declarations, 238 calls, zero unmatched static paths).
- Four isolated Chromium scenarios cover dashboard desktop/mobile in both themes with three daily meals, the shortened title, neutral missing-photo symbol, no page errors and no horizontal overflow. These fixtures have synthetic accounts/contracts and intentionally no photos; they do not prove provider image availability or clinical suitability.
- Fresh live custom backup: 13,866,522 bytes, SHA-256 `5ad908fd94c6df37edaf7862fe6d086669a9642944aacd741d37062ce8beb57b`, captured 2026-10-11 20:45:09 UTC. Archive listing verifies core account, meal, component, document and migration tables. The live guarded preview finds exactly 15 eligible servings and 105 completed migrations.

## Recovery boundaries

The earlier consistency audit compared all seven retained reference/rule tables with the prepared recovery source using full-row fingerprints: 15,072 food records, 81 aliases, 1,967 source recipes, 2,027 library recipes, 16 clinical sources, nine ingredient rules and ten nutrient rules. The stored catalogue corrections were carried over. All 105 current migrations are applied. The original blocked Neon project and backup remain intact.

This proves transfer of the verified recovered data, not reconstruction of changes made only on the original hosted database after the October 10 backup. Those unavailable changes remain the recorded recovery omission. The retirement of ENNS consumption data is intentional.

## Release and rollback

At 2026-10-11 20:47:47 UTC, the owner-approved live repair refreshed exactly 15 records. Read-back confirms zero stale rice components in the target cycle, all 21 meal IDs retained, identical ingredients/nutrients/decisions/logs and exactly 15 new maintenance audits. Other accounts remain unchanged. All 105 migrations remain applied.

Tested implementation `1789a06c` was integrated as `8def2a0872e71b37c408b8d6d0e5f75235d40fa0` with an identical Git tree, pushed to development and promoted to demo. Foreign shared-checkout edits were preserved. The compatible API was deployed first (CLI deployment `37ef2e50-c006-4ace-b229-9479bad9addb`, SUCCESS, `/ready` 200), then the production branch was promoted.

| Component | Final deployment | Verified commit |
| --- | --- | --- |
| Railway API | `a4a01519-303c-4b1e-9509-86a92a980634` — SUCCESS | `8def2a0872e71b37c408b8d6d0e5f75235d40fa0` |
| Vercel frontend | `dpl_9mcxgbtKF5Dd3drFS3iJ9wfuXG8b` — READY; `www.kainara.site` and `kainara.site` | `8def2a0872e71b37c408b8d6d0e5f75235d40fa0` |

All 47 Railway variables compare unchanged. No migration, provider configuration or deployed secret changed. At 20:49:11 UTC, the actual backend clearance helper in a read-only live transaction returned 21 eligible IDs over seven dates, exactly three per day. This is authoritative server verification, not an authenticated browser check of the real member's private account.

The bounded ordinary-login public member/RND/admin smoke at 20:53:55 UTC checked Meals and both staff libraries: 32 API responses, no unexpected failures, page errors or overflow. The synthetic restricted member correctly receives one `422 CLINICAL_EVIDENCE_REQUIRED` on workspace retrieval; its existing clinical gate remains visible. The initial smoke assertion treated that expected response as a failure. The assertion was corrected to recognize only that exact status/code/path, and the bounded check passed without changing application safety behavior. No claims, profile edits, clinical decisions, AI calls or explicit generation requests were submitted. Private evidence is in `rice-live-smoke.json`, `rice-live-clearance.json`, final deployment metadata and role screenshots. There was no live load test or new transfer-budget measurement.

The preceding compatible release is `28838a8ad7beb75e9b64944e0d640e5bcca0efd2`, Railway `6bcb2228-0c9d-47da-81fe-4dfab817a877`, Vercel `dpl_BWPZbN9xjxjG3Z4XaqBC9hjM3KYv`. A code rollback can retain the refreshed evidence: it uses the same existing revision/signature schema. Never restore the full backup over newer member activity to undo this repair.
