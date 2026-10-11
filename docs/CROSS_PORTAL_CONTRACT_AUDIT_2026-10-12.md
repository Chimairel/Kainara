# Cross-portal contract audit — October 12, 2026

Status: **Deployed and bounded live smoke verified**, following the owner's publication request. No application-data repair is part of this audit.

## Request and execution plan

The owner requested a codebase audit for inconsistent calls, fields and shared behavior after a recipe photograph appeared for members but was missing from an RND canvas. The earlier canvas fix is already deployed and is recorded separately in [the recovery consistency audit](DEFENSE_CONSISTENCY_AUDIT_2026-10-12.md).

This audit used four gates:

1. Inventory frontend API calls and mounted backend routes; trace variable endpoints and response projections across roles.
2. Reproduce concrete disagreements before changing code. Separate intentional permission/history differences from defects.
3. Reuse authoritative presentation and policy helpers, with regression tests for photos, verification, request ownership, dates and error recovery.
4. Run complete automated suites, production builds, disposable PostgreSQL acceptance and bounded browser checks; record limits and publish a reviewable development commit.

Work started from `cda5c13b6ac8c256886e4751d831bfb6044a44df` in an isolated checkout. Other tools' unfinished shared-checkout work was excluded.

## Confirmed findings and corrections

| ID | Reproduced mismatch | Correction | Evidence |
| --- | --- | --- | --- |
| CONTRACT-01 | Staff library list/detail constructed photographs separately, losing server-selected source fallback, representative provenance and video fallback. RND replacement options returned only assigned image assets, omitting available recipe-source photos. | Serialize `PublicMealImage` through `resolvePlanImage` and bounded `resolveLibraryRecipeImages`; use the returned image directly in staff cards/details. | Backend list/detail image regressions and admin/RND rendering tests; actual SQL/HTTP replacement-photo assertion failed before correction and passes afterward. |
| CONTRACT-02 | The library list could label a retired, unsigned or held recipe Verified while detail withheld that status; generated-recipe verification was omitted from the list query. | Use `admittedLibraryBaseIds` for both list and detail, preserving exact revision checks and source/status requirements. | Four regression cases cover generated, retired-source, unsigned-source and held-certified recipes. This aligns a display label with existing policy; it does not grant new clinical clearance. |
| CONTRACT-03 | Progress/Health/Food & planning could render or cache the previous account's profile under the new owner. A late save could update the new session or open its modal. | Reusable `useRequestScope` fences late completions; reset owner-bound data/drafts before rendering, and guard state, session and cache writes. | Three failed-before/passed-after tests cover new-owner loading, old initial reads and old saves. Existing draft-preservation tests remain passing. |
| CONTRACT-04 | Quickly opening two library recipes could let the slower first response replace the newer selection. Closing a pending detail could reopen it. | Scope detail reads to the account/role and a request sequence; closing or changing owner invalidates pending results. | Three failed-before/passed-after selection, close and account-switch regressions. |
| CONTRACT-05 | Printed plans and some progress/staff dates used the device timezone while plan dates use Asia/Manila. Weight observations straddling Philippine Sunday/month/year boundaries grouped differently on UTC devices. | Share `groupMealsByManilaDate` between plan presentation and print export. Use Philippine calendar arithmetic and `formatManilaDate` in affected displays; use calendar-key arithmetic for the day after a starter plan; explicitly set the business timezone in guidance PDFs. | UTC execution reproduced the weight-boundary failures. New week/month/year, cross-midnight plan and starter/daylight-saving tests pass; existing plan/progress tests and production builds pass. The browser checks use America/Los_Angeles. |
| CONTRACT-06 | Shared error recovery recognized `errorCode`, but older controllers return `code` for the same stale-context errors. | Accept both public envelopes, preferring a valid `errorCode`; reject malformed values. | Existing safe-error tests retained, with a new compatibility/precedence regression. |
| CONTRACT-07 | Historical logs with no saved meal type were labeled Lunch. | Preserve an unknown type and display Meal; shared card presentation accepts the absent type. | Failed-before/passed-after history-card regression and production TypeScript verification. No historical row was changed. |

The interface work followed Impeccable hardening guidance and reused the existing palette, typography, cards and image component. It adds no explanatory card text or new banners.

Two old expectations in the SQL rehearsal were also corrected: disputes no longer contribute to active work counts and retired endpoints return `410 MEAL_DISPUTES_RETIRED`; the synthetic historical audit now explicitly links its recorded review decision. The current admin service intentionally refuses to guess an unlinked decision snapshot. These changes update fixtures to existing behavior; they do not revive disputes or alter historical attribution rules.

## Coverage and intentional differences

| Area traced | Contract/boundary inspected |
| --- | --- |
| Authentication and onboarding | Confirmed account profile, owner-scoped cache, token refresh, route guards and onboarding-specific evidence endpoints. |
| Member profile, reports and clarification | Owner-bound drafts/reads/mutations, acknowledgment, report revisions and member/RND form endpoints. |
| Current/upcoming meals and library | Actionable vs preview projections, shared images, recipe identity, base admission, exact-context references and clinical eligibility. |
| Staff case/profile canvases | Status revisions, claims, stale-context recovery, public recipe presentation and protected document access. |
| Replacement and generation | Existing source/allergy/calorie/portion eligibility, context/claim guards, pending replacement state, worker continuation and saved recipe variety. |
| Outside-food logging/review | AI estimate acceptance vs optional RND review, explicit review request, recorded nutrition and private image access. |
| Groceries, progress and export | Plan availability, historical purchases, nutrition-eligible totals, weight observations and Philippine calendar identity. |
| Membership and notifications | Server-derived allowances/reset periods, separate admin/member history endpoints, notifications and owner-scoped reads. |
| Admin governance, credentials and reference data | Shared staff library, PRC maintenance vs review eligibility, audit snapshot linkage, catalogue permissions and retired ENNS/dispute/routing routes. |

Different projections are sometimes required. Staff see recipe/evidence history that members cannot use as a cleared meal. Admin image-management endpoints describe the managed asset, rather than silently substituting a source photo. Immutable meal/audit history does not acquire today's mutable recipe/profile data. An expired RND can maintain credentials while clinical actions remain blocked. These differences were retained.

### Repeatable API inventory

Run `npm run audit:contracts`. Optionally write the inventory to a chosen local path with `node scripts/audit-api-contracts.cjs <output.json>`.

The final scan inspected **1,156 source files**, **306 route declarations** through **17 root/38 traversed router mounts**, and **238 frontend API call sites** with a reconstructable path. It found **zero unmatched static paths** and **11 variable URL call sites** requiring manual tracing:

- Read-only RND vs writable admin food catalogue.
- Profile vs selected-meal clarification publication.
- Member vs selected-member admin membership history.
- Recipe flag vs claim/confirm/release/archive actions.
- Role-specific recipe coverage.
- Pending vs historical profile-document access.
- Four onboarding vs ordinary clinical-evidence reads/downloads.
- Shared authenticated PDF download, supplied by report/grocery callers.

This is a conservative inventory, not a runtime API validator: conditional router factories are combined, aliases/variable segments can match more than one route, and indirect wrappers/native fetch/external URLs need separate inspection. It does not prove response types, authentication, clinical policy or provider behavior merely because paths match. Payloads/helpers and those variable callers were reviewed separately; regression/acceptance tests provide the evidence above.

## Verification

| Gate | Result |
| --- | --- |
| Complete backend tests | **956 passed**, zero failures, one existing TODO (957 total). |
| Complete frontend tests under `TZ=UTC` | **991 passed** in 205 files; eight additional Node dependency/notification-worker checks passed. |
| Final affected owner/detail/history tests | **11 passed** after the small cleanup/type corrections. |
| Actual PostgreSQL + Express rehearsal | **18 scenarios passed** on disposable PostgreSQL 17 at `127.0.0.1:55488/kainara_rnd_canvas`, after applying all 105 migrations to an empty fixture database. Includes photograph lookup, concurrent/tampered swaps, stale source/member/evidence context, expired claims/RNDs, holds, active queue counts, retired endpoints and retained audit history. |
| Builds | Backend and frontend production builds passed. |
| Lint/format/architecture | Both application lint commands passed; touched files pass Prettier and diff whitespace checks; source limits and all 25 entry-point budgets pass. |
| Browser | Five synthetic scenarios: RND library light/dark, admin library light, member Progress mobile light/dark. Card and detail photos loaded; no page errors or horizontal overflow. Screenshots were inspected in a batched pass. |

Local logs and screenshots are retained under ignored `backend/.local/defense-audit-20261012/`. The browser fixture supplies synthetic contracts and local photography; it does not test a hosted image provider or professional approval. The SQL rehearsal disables external providers and does not use normal localhost or Neon data. No new live load/transfer measurement was performed.

## Release limits and next action

- This audit fixes confirmed inconsistencies; it cannot establish that every future input, provider outage or concurrent workflow is defect-free.
- No migration, live restore, credential change, quota change or application-data repair is required by these source changes.
- Tested development implementation `28838a8ad7beb75e9b64944e0d640e5bcca0efd2` was subsequently published on the owner's explicit request. Deployment evidence is below.
- Roll back this development unit as a whole if needed. Both frontend and backend changes belong together because staff UI now consumes the public `image` field supplied by the backend.

## Hosted publication — October 12, 2026

The owner requested “push it live.” Authenticated official CLIs confirmed the existing Railway project/service/production environment and Vercel team/project under `chimairelp@gmail.com`. The clean checkout contained the tested source only. Development commit `28838a8a` has the same complete tree as tested isolated commit `885a13cf`; `demo` was fast-forwarded to that exact implementation.

| Component | Current verified deployment | Application commit |
| --- | --- | --- |
| Railway API | `6bcb2228-0c9d-47da-81fe-4dfab817a877` — SUCCESS, `/ready` 200 | `28838a8ad7beb75e9b64944e0d640e5bcca0efd2` |
| Vercel frontend | `dpl_BWPZbN9xjxjG3Z4XaqBC9hjM3KYv` — READY, `www.kainara.site` and `kainara.site` assigned | `28838a8ad7beb75e9b64944e0d640e5bcca0efd2` |

The compatible API was deployed first using the CLI from the clean checkout (`c805faa6-d1fb-42f4-93c7-828ed3aac7e4`, successful readiness), then the branch promotion produced the final Git-tracked Railway/Vercel pair above. All **47 Railway variables** compare unchanged before/after, and the existing connection still targets defense Neon `nameless-dust-38810716` / `br-round-art-b355gp02` / `neondb`. No secrets, migrations, database restores or application records were changed by the release operation.

One ordinary-login public smoke completed at **04:21:18 Philippine/Singapore time on October 12** (October 11, 20:21:18 UTC). Member mobile Progress/Food & planning, RND library and admin library passed, with **47 API responses all HTTP 200**, no page errors or horizontal overflow. Both staff library card/detail photographs loaded and their public image objects and base-verification labels matched. No profile saves, claims, review decisions or generation requests were submitted. The browser sessions were closed. Screenshots and results: ignored `backend/.local/defense-audit-20261012/contract-live-*` and `contract-live-smoke.json`.

One post-smoke Neon project reading at **04:21:57 local time** reported `data_transfer_bytes=719641932`, `compute_time_seconds=9412`, `data_storage_bytes_hour=0`, `written_data_bytes=0`, `cpu_used_sec=0`, and billing period October 1–November 1 UTC. Main-branch metadata reports **136,552,448 logical bytes**, ready. The project counters may lag; zero counters are reported values, not proof of no usage. The API reports a 1,073,741,824-byte branch size limit but no transfer allowance. Reported transfer is approximately **14.39% of the existing conservative 5,000,000,000-byte operating budget**, below its 50% warning threshold; this does not independently confirm the account's current transfer allowance. Free consumption history was not requested. Capacity monitoring remains in the recovery record.

**Compatible rollback pair:** application `72bd64d86fded47d132fc0801ed93abb31a66d7b`, Railway `e9d4ef23-3c66-4992-848a-c95e106ba2ef`, Vercel `dpl_4kYDKdTSWSm3r5En8FsFpeyFoewn`. Restore that application pair or publish a reviewed source revert if needed; preserve the existing database and deployed keys. Code rollback requires no database restore. Deployment records identify the immutable application commit; a subsequent documentation-only development commit does not change the deployed application.
