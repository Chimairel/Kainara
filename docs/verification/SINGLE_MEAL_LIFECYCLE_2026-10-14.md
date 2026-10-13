# One-meal lifecycle acceptance — October 14, 2026

## Result

PASS against real Express routes, fresh PostgreSQL records, and Chromium UI using localhost:3000. Final successful run: **2026-10-13T16:52:04Z UTC / October 14, 00:52 PHT**.

The isolated fixture contains exactly one MealLibrary recipe, created through the admin API. Six fictional accounts cover admin, original verifier, flagger, independent reviewer, competing reviewer and member. Sessions use the real JWT signer and authenticated middleware; account registration/login and external provider delivery are outside this test.

## Boundary evidence

| Step | Evidence |
| --- | --- |
| Admin creates a meal | POST `/api/admin/meals` returns 201; SQL MealLibrary count is 1; Verified catalogue excludes the draft. |
| RND A verifies | Actual claim and decision routes return 200; current revision appears in staff Verified and the member verified-recipe endpoint. |
| RND B flags | Browser submits the flag modal through the real API; structured fields are saved. Meal disappears from both catalogues and enters only PENDING_REREVIEW. |
| A and B excluded | Both claim requests return 403 `REVIEWER_INVOLVED`; original verifier's browser claim control is disabled and explains the independent-review requirement. |
| RND C claims | Browser claim returns 200, SQL/API show ownership; competing RND returns 409 `REVIEW_CLAIM_CONFLICT`. C sees measured ingredients, B's identity and all exact flag notes. |
| C resolves and re-verifies | Browser records a per-concern resolution, marks it resolved, writes overall findings, acknowledges evidence and submits. SQL stores C's resolution and immutable snapshot. |
| Meal returns | Staff Verified and member verified-recipe endpoint contain the same recipe ID; member `/meals` Library visibly shows it. Pending queue is empty. |
| Flag again | Actual flag route creates incident 2, QUARANTINED; Verified excludes the meal, pending queue is empty, Quarantined browser table contains it. RND claim returns 409 `QUARANTINE_ADMIN_REQUIRED`. |
| Audit | SQL and staff audit API contain creation, verification, withholding/flags, independent claim, confirmation and re-verification. Admin Audit → RND history → resolution Details renders the saved per-concern response and original flag. |

### Fixes discovered

- Re-review claims previously changed ownership without writing audit. Claim ownership and `MEAL_REVIEW_CLAIMED` now commit in the same transaction, including immutable actor and recipe/version snapshots.
- Server exclusion worked, but the original verifier's claim button was enabled. Detail now reports involvement and disables that control; server checks remain authoritative.
- Individual resolutions were stored but absent from the audit timeline presentation. The selected confirmation now displays its saved resolutions beside the corresponding concerns. Other decisions do not display those responses.
- Audit labels now describe claim, withholding, flag, confirmation and re-verification in ordinary language; a claim outcome reads “In review”.

## Isolation and scope

- Owned Docker container `kainara-local-postgres` was checked for compose ownership and binding exclusively to `127.0.0.1:55432` before creating each fresh database.
- Successful fixture: `kainara_single_meal_d464dc2f`; recipe `cmv6x4p16000m6j0dgqzpvd3g`.
- Database URLs and JWT keys are set before importing the app/Prisma; external email, AI, payment and Google credentials are unset. No credential is printed or committed.
- Every browser API request is forwarded to the real isolated loopback Express listener. No API payload is mocked; live event streaming is aborted. Normal localhost:5000 and hosted Neon are not mutated. No release deployed.
- Account/profile/accepted-report and composition fixtures are provisioned directly in the isolated database; admin creation, verification, flags, ownership and resolution use guarded HTTP endpoints. Browser performs first flag, independent claim/resolution, member Library browse, quarantine browse and audit inspection. Initial base verification and second flag are performed through authenticated HTTP.
- “Returns to the meal page” is verified as member Library browsing. This admin-authored recipe still displays **Serving evidence pending**. Base verification does not grant portion/health-context approval or automatically release old member plan holds. Planning eligibility and case-specific approvals remain separate gates.
- This run checks desktop Chromium in the existing light theme. Responsive/theme regression checks belong to the preceding library UI record; they are not claimed as new evidence here.

## Reproduce

Use the shared Desktop checkout with its existing frontend on localhost:3000 and owned local PostgreSQL container running:

```powershell
cd C:\Users\chima\Desktop\Nutrimind\backend
npx tsx scripts/single-meal-lifecycle-local-acceptance.ts
```

The script creates a fresh isolated database every run, leaves it for inspection, and closes its temporary Express listener/browser. It refuses a container with different ownership/binding. Never adapt it to the hosted database.

Local evidence (not committed): `backend/.local/single-meal-lifecycle/kainara_single_meal_d464dc2f/` contains `report.json` and screenshots `00-excluded-verifier`, `01-claimed-review`, `02-republished-meal`, `02-member-library`, `03-quarantined`, `04-rnd-audit`, `05-admin-resolution-audit`. Earlier harness iterations stopped at their failure; only the final run is acceptance evidence.

## Checks

- 9 focused frontend tests pass (review controls and immutable timeline).
- 6 focused backend tests pass (submission validation, administrative release boundaries, audit attribution/timestamps).
- Scoped backend/frontend ESLint passes without findings.
- Backend TypeScript build and frontend production build pass.
