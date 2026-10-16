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
