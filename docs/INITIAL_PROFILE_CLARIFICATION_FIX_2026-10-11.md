# Initial-profile clarification fix — October 11

Status: reproduced on live; fix verified locally; hosted activation pending target confirmation.

## Cause

`UserProfile.revision` starts at **0**. The clarification context validator required a revision of at least 1, and PostgreSQL constraints independently required positive revisions for clarification forms and profile proposals. Normal newly onboarded and unchanged restored members therefore could not receive questions or correction proposals in their actual initial context. The live browser reproduced a valid, claimed test-member submission failing with `Too small: expected number to be >=1`.

## Correction

- Accept nonnegative integer profile revisions in the shared clarification/proposal context schema.
- Add migration `202610110002_initial_profile_clarification_context`, which changes only the two revision check constraints. Existing records, profile revisions, credentials, claims and clinical decisions are preserved. Negative revisions remain prohibited.
- Keep exact revision/scope comparisons, ownership, eligible RND credentials, active claims, member acknowledgment and immutable historical evidence authoritative.
- Change isolated acceptance fixtures to use the actual default revision 0; derive subsequent revision expectations from the saved profile instead of assuming every profile starts at 1.

## Evidence

The new regression failed before the API change and passes afterward. Ten focused policy tests, backend production build and script typechecking pass. Three fresh disposable PostgreSQL acceptance suites pass: 13 profile-clarification groups, 19 profile-proposal groups, and 13 meal-clarification/repair groups. Coverage includes revision-0 publication/answers/resolution, handoff, duplicate retries, current credentials, cross-role/member denial, concurrent answers, stale-context withdrawal, correction acknowledgment, audit access and preserved historical meals/purchases. These checks do not establish clinical approval.

Private evidence: `backend/.local/defense-recovery/1791696253565/revision-zero/`, including the reproduced live screenshot and isolated SQL logs. Repeated tests remain local.

## Hosted activation

Confirm the existing defense target before migration: Neon project `nameless-dust-38810716` (`kainara-defense-20261016`), branch `br-round-art-b355gp02` / main, database `neondb`, Singapore. Back up current live records and verify the archive/checksum first. Use a clean release based on live `20899735` with only this fix; it does not include the separate undeployed license-update migration or unrelated frontend changes. Apply this migration, deploy the compatible Railway backend, check readiness, then repeat one bounded real RND-to-member browser send/answer check. The current frontend is API-compatible.

Rollback: retain the previous Railway deployment. The relaxed nonnegative constraints are compatible with that code, but old API validation would again block revision-0 requests. Do not restore an older archive over new live activity or increment member revisions to mask the defect.
