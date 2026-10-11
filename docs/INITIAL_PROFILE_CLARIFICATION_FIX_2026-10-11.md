# Initial-profile clarification fix — October 11

Status: deployed and end-to-end tested on live October 11 after owner-confirmed backup and migration.

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

The owner confirmed Neon project `nameless-dust-38810716` (`kainara-defense-20261016`), branch `br-round-art-b355gp02` / main, database `neondb`, Singapore. A fresh custom-format live backup was verified before applying the migration: 13,826,070 bytes, SHA-256 `f0ff7016a12a1c3e726867c208c17c0211ffd9d5e0117e66aa98ce28dc5fd53f`. Before/after checks retained 52 accounts and password hashes, all 22 professional records, 286 meal rows, 15,072 foods and the encrypted document. The migration changed only the two revision constraints.

The Windows Prisma engine connection was unreliable. The verified PostgreSQL client executed the checked-in migration SQL and recorded its original checksum in `_prisma_migrations` in the same transaction, with exit-on-error and bounded lock/statement timeouts. Both nonnegative checks and 104 applied migrations were verified afterward. This does not activate the separate license-update migration. No deployed secrets were changed.

The clean release based on `20899735` contains only this fix, at `5a9c025fe97a1d2848a6f40a9ff32578061111a4` on `demo`. Railway deployment `24a6ce5f-4554-4b3c-a9aa-d20aebd9d880` is SUCCESS; the persisted backend root is `/backend`, and `/ready` and `/health` pass. Vercel production deployment `dpl_3jjfgEqLLkTCBciRfZR86May5Pbf` is READY and promoted for the same commit. The existing frontend is API-compatible; this patch contains no frontend changes.

One bounded ordinary live-browser journey verified Reviewer A claiming the synthetic revision-0 member, publishing the formerly failing question, releasing the claim, the member receiving and answering it in Health details, and Reviewer B claiming, seeing the saved response and resolving it after handoff. The profile remained at revision 0 and was not clinically approved. The test claim was released. Screenshots and timestamps are retained privately in `revision-zero/live-browser-verification.json`, `live-member-answered.jpg` and `live-rnd-resolved.jpg` beneath the evidence directory above. This verifies the reported live defect and its connected journey; it is not an exhaustive live-system or clinical certification.

The normal localhost database has not received this migration in this activation; apply it to an explicitly confirmed local target before testing initial-profile forms there.

Rollback: retain the previous Railway deployment. The relaxed nonnegative constraints are compatible with that code, but old API validation would again block revision-0 requests. Do not restore an older archive over new live activity or increment member revisions to mask the defect.
