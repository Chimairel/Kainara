# Capstone recipe review fixtures — October 16, 2026

## Meaning and scope

The owner clarified that KAINARA is an academic demonstration and the team acts out the Nutritionist role. The owner authorized simulated review records under the existing `nutritionist@gmail.com` demo account, Chimairel Pacaldo. These fixtures demonstrate recipe publication and attribution. They are not evidence of professional review, clinical validation or member-specific condition/allergy clearance.

`backend/scripts/seed-capstone-recipe-reviews.mjs` is a standalone, explicitly invoked operator tool. It is not part of application startup, registration or the ordinary RND review API. It requires `capstone-demo` mode, no clinical-policy approval, a named private environment file, a matching database confirmation token and the preview candidate count before writes. Remote connections require SSL. It preserves already verified/rejected records and active claims, excludes flagged/unavailable source recipes and changes no recipe ingredients, quantities or nutrition values.

Each seeded row contains `CAPSTONE_SIMULATION_V1` in its rationale. A separate `CAPSTONE_RECIPE_REVIEWS_SEEDED` audit event identifies the fixture seeder as actor, links the demonstration account, and explicitly records `professionalReviewPerformed: false` and `patientApprovalsCreated: 0`. Existing PRC/license fields and historical decisions are not modified or newly asserted. Member cards use the existing recipe-scope attribution. Anyone presenting these records should explain that the team is demonstrating the RND role with seeded data.

The simulation intentionally exercises publication even when an original source has incomplete structured evidence. The ordinary authenticated batch-review completeness checks remain unchanged. This seed does not fill unknown evidence or establish that an incomplete recipe is clinically suitable. Existing member restriction, flag and planning checks still apply, so a member's compatible results can be fewer than the full catalogue.

## Applied data and verification

Applied in sequence on October 16, UTC+8:

| Environment | Available sources | Seeded records | Result |
| --- | ---: | ---: | --- |
| Local isolated PostgreSQL | 1,958 | 1,958 | Transaction rehearsal rolled back, real seed committed, repeat preview has zero remaining |
| Separate staging Neon | 1,958 | 1,958 | Catalogue service returns 1,958 entries and six on page one for an unrestricted member |
| Final demo `kainara_demo` | 1,958 | 1,958 | Authorized seed transaction committed at 23:16:42, with in-transaction count verification |

Local and staging reviewer resolution returns Chimairel Pacaldo. A staging HTTP check uses an isolated instance of deployed archive `7c5fa1ae` connected to staging Neon: authenticated catalogue 200 with total 1,958/page size six, anonymous request 401. This is not a fresh Vercel/browser check. The first staging service probe selected a member without completed planning prerequisites and failed; selecting an existing member with an acknowledged planning basis passed. No member setup or health declarations were changed to pass this check.

Three operator-policy tests and 21 existing batch-review/presentation regressions pass. No application source, API contract, schema, dependency, feature flag or hosting deployment changes are required. No Gemini calls, demo test login, demo app request or general demo functional SQL tests were performed. Demo SQL was limited to the authorized seed preview, transaction and its integrity count. Runtime application parity remains the preceding released tree.

Staging's older demo Nutritionist display name was initialized as Chimairel Pacaldo, retaining a private before snapshot and explicit fixture audit event. This changes no login credential, license or verification eligibility.

## Backups and recovery

Each environment retains a private before snapshot under ignored `backend/.local/capstone-seed-20261016/`. It identifies the target, inserted record IDs, any previous updated rows and the seed audit ID. The operator writes that snapshot before any mutation and retains its SHA-256 in the audit event. A rollback must verify that each row still belongs to this seed and has not received a later genuine decision before removing/restoring only those fixture rows. Preserve the simulation audit history and record the rollback separately. Do not restore an entire database or remove later member activity.

Run IDs: local `00d39641-412f-4667-973f-2f4ffb882cfa`, staging `ed7612f2-467a-4b4d-baca-421784ea994d`, demo `7b1175ef-7709-4f15-94ee-14db49e9739b`. No earlier review rows existed for these candidate revisions, so all three runs inserted records without replacing reviews.

Before converting an environment to public use, remove these simulated verifications through a reviewed target-specific cleanup and perform actual evidence review. Do not treat the fixture audit as a clinical sign-off.

## Other laptop

If its backend points to this same demo or staging Neon database, these records are already shared and require only refreshing the page. Git does not copy database data. An independent local PostgreSQL database requires its own explicit fixture run after pulling `development`:

```powershell
node backend/scripts/seed-capstone-recipe-reviews.mjs --env-file PATH_TO_PRIVATE_CAPSTONE_ENV
```

Review the printed target/count first. Repeat with `--apply --confirm-target TOKEN --expect-count COUNT --backup-dir backend/.local/capstone-seed-20261016/device-backups` only for the intended capstone database. The supplied private file must explicitly contain `NUTRIMIND_DEPLOYMENT_MODE=capstone-demo`. Keep all credentials and before snapshots out of Git. No Prisma generation/migration or application rebuild is required for this data-only operation.

## Requested demo-branch promotion

At the owner's subsequent explicit request, push completed commit `9faec90c` to `codex/staging` and then `demo`; `development` already contains it. This adds only operator scripts, tests, documentation and ignored-path rules. The deployed frontend/backend application source, schema and dependencies remain unchanged. The seeded database records were already committed and are not rerun during deployment.

At **23:25:25 UTC+8**, Railway deployment `6524531c-680f-4294-aedd-3d2027db1027` reports **SUCCESS** at `9faec90c`. Non-platform settings match the retained baseline and the database remains `kainara_demo`. The actual `kainara.site` alias resolves Vercel deployment `dpl_UtAKXJPaxVNdCZ43F4ruYmD5p2DG`, **READY** at `7c5fa1ae`, whose complete frontend tree is identical to `9faec90c`. Component application parity passes without claiming identical provider SHA labels. Verification uses provider/configuration metadata only, with zero demo functional requests or test SQL. A private metadata receipt remains in the ignored fixture directory.
