# Recognized declarations and meal preparation

## Requested behavior

Recognized condition/allergy choices proceed to meal preparation without routine RND profile verification. A typed entry resolving to a known catalogue alias behaves the same way. A mixed declaration containing an unrecognized entry still requires profile review. Incomplete declarations still require the member to complete intake.

This implements the earlier suggestion that CHG-20261016-12 explicitly recorded as discussed but unimplemented. It is a planning prerequisite change, not a bulk profile approval or condition-relevance assessment.

## Boundaries

- Keep condition and allergy declarations, support states, screening, Health membership eligibility and meal-specific review requirements. A recognized unsupported condition remains unsupported by automated therapeutic rules.
- Keep current unresolved profile questions, correction proposals, explicit declines and reopened review episodes. Do not erase an existing RND request because its condition has a known name.
- A meal question holds that meal, without reopening profile review. Report acknowledgment, current planning guidance, evidence requirements and cycle eligibility still apply.
- Automatic profile-queue admission and single/batch planning gates use the same recognition policy. RND profile inspection and explicit clarification remain available for restricted cases.
- No migration, fabricated approval, historical review rewrite, provider call or change to recipe verification is required.
- Existing saved recognized declarations benefit when the API is updated and status refreshes. An account with an actual outstanding RND request must still resolve it. The second laptop must pull the released branch and restart its API; its database URL remains separately configured.

## Verification on October 17, 2026 (UTC+8)

- Backend unit suite and test TypeScript: **1,169 passing, zero failing, one existing TODO**. Coverage includes every catalogue domain/choice, recognized custom aliases, mixed unknown entries, preserved restrictions, status/queue/batch gate agreement and current declines.
- Real HTTP/SQL acceptance in disposable loopback PostgreSQL database `kainara_recognized_profile_acceptance`: recognized diabetes/kidney/allergy/alias profiles skip routine review; an unknown condition alone enters the profile queue; actual generation persists three diabetes candidates with `PENDING_REVIEW` and no reviewer attribution; no profile approval is invented; profile questions and declines remain holds, while meal questions do not reopen profile review. **Zero Gemini calls.** Synthetic fixtures never target shared local, staging or demo accounts.
- Backend production build and scoped ESLint pass. The acceptance script is included in test TypeScript compilation. Initial fixture setup needed a current acknowledged report version and an eligible dietary tag; corrected the fixture without relaxing application guards. The meal-question fixture also retains its required source scope.
- Frontend assistant tests: **87 passing**; frontend TypeScript, scoped ESLint and production build pass. The only frontend source change is the generated Nara guide. No new layout or browser/device verification is claimed.
- Canonical prepared English/Tagalog explanations and generated frontend guide describe recognition versus meal clearance. Guide parity remains checked.

## Reproduce the database acceptance

Use a fresh disposable loopback PostgreSQL database named exactly `kainara_recognized_profile_acceptance` on `127.0.0.1:55432`, apply existing migrations, and set both Prisma URLs to that database. Set `NODE_ENV=test`, `CLINICAL_CLARIFICATIONS_ENABLED=true`, `MEMBERSHIP_ENABLED=false`, `WEB_PUSH_ENABLED=false` and synthetic signing keys. Clear external provider credentials. Run `npx tsx scripts/recognized-profile-local-acceptance.ts` from `backend`. The script refuses any other host/port/database, a populated user table or a configured Gemini key; outbound fetch is restricted to loopback. Fixture records remain only in this disposable database for inspection. Do not run it against a real member database.

## Release

Local verification is complete. Staging rollout and its observed results are recorded below when executed. Demo promotion is separate; no demo functional tests or data rewrites are authorized by this change.

### Staging complete at 00:22 UTC+8

- Commit `4e652f3ebd9849571c15535e8866368022811db8` is pushed to development and `codex/staging`. Build and repeat the full backend suite from a clean committed archive, excluding unrelated shared-checkout edits. The clean frontend build also succeeds; Windows emits a standalone trace-copy symlink permission warning because dependencies are junctions. This is not a verified portable standalone Windows package. The hosted Vercel build succeeds separately.
- An additional 15 frontend profile-gate/dashboard/preparation tests pass from the clean archive (102 affected frontend tests in total).
- Restart only the isolated staging API using that archive and the existing separate staging Neon database; retain its configuration. No database migration or restore. Refresh only the staging preview's tunnel override. Production branch tracking remains `demo`.
- Vercel deployment `dpl_9JXhzq5bCneuCmfqYPhZrnS5Jbzt` is **READY**, reports the exact candidate SHA and attaches the existing staging alias. Its API proxy and the public staging tunnel both verify recognized diabetes `required=false` / planning permitted (`REQUEST_ALLOWED_REVIEW_EXPECTED`), and unknown custom input `required=true` / `BLOCKED_PROFILE_REVIEW`. Anonymous status access returns 401.
- Staging checks create only synthetic accounts and remove them with their temporary guidance records afterward. No profile approvals or plans are seeded on staging. Provider usage-event delta is zero. Initial hosted readiness fixture lacked acknowledged guidance and correctly returned 409; corrected the fixture, retaining the application acknowledgment requirement.
- Demo branch remains `9faec90cbfb7ca42a95cd8ca9264ee9a6f49deda`. No demo release, SQL test or app request is performed. Browser login, visual checks and actual-model quality are not claimed by these authenticated HTTP checks.

### Subsequent authorized demo release

The owner then requests deployment together with the report/Home/saved-food feedback work. On October 17 at 01:29 UTC+8, both demo hosts report exact staging-tested descendant `f178d40e`: Railway `644e4dc7-bfcd-443c-9dfc-379a017f7196` SUCCESS and Vercel `dpl_YdEMoz4MEmXtpcLLZwsEW7yV9FBW` READY behind `kainara.site`. Recognized-profile admission is included without a database rewrite or settings change. Production continues tracking `demo`; committed local application parity passes. Verification is provider metadata only, with zero demo functional requests or SQL tests. [Combined release evidence and limits](REPORT_AND_FOOD_FEEDBACK_2026-10-17.md#authorized-demo-promotion-at-0129-utc8).
