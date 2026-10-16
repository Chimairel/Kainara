# Local, staging and demo alignment — October 16, 2026

## Owner's required workflow

**Local changes → local tests → online staging → demo promotion.** `origin/development` must contain completed local work. Feature branches are temporary working branches, `codex/staging` runs the online testing candidate, and `demo` runs the presentation site. Promote the same application tree after staging verification; never silently combine later edits into a release.

The owner explicitly prohibited functional testing against demo live to conserve Neon transfer. This supersedes older production-smoke requirements. Hosted test requests and test SQL target staging only. Demo verification uses hosting deployment SHA/state/configuration metadata and retained migration receipts. Future authorized backups/migrations remain separate scoped operations.

## Initial audit and local restoration

- Both live hosting platforms reported `7b96e8b5` ready/successful; its complete tree equals tested `c8675a14`. At the audit's start, staging remained `c8675a14`.
- The shared Desktop checkout was ahead with the requested, unreleased food-logging interface (`7b3ee168`). Its backend source and schema files already matched the release. Three unrelated dirty application files remained: `PublicHeader.tsx` formatting and two sleeping mascot SVGs; an untracked window-frame asset also remains. Prototype deletions and other audit work are unrelated. These edits are preserved and excluded from releases. The working checkout is therefore not claimed byte-identical to a clean Git tree.
- Docker/local servers were stopped. Started the existing Docker runtime and the normal local API/frontend, retaining `kainara_local_development@127.0.0.1:55432`, API 5000 and frontend 3000. Local password login, free help and consent-only AI preflight passed without credit loss. No local database restore, seed or reset.
- Integrated production ancestry without changing the candidate tree, then normally fast-forwarded remote `development`. No dirty checkout files, forced push, branch switch or old worktree reset was used. The older `development` checkout attached to another worktree is not the normal shared runtime and was not modified.
- Added `npm run release:parity`. It compares selected application/schema/reference/configuration files between Git refs and reports dirty/untracked application files. `--assert` rejects committed drift; `--assert-checkout` additionally rejects checkout drift. It makes no network/database calls and cannot prove runtime or environment/data equality. Actual hosting identities must still be checked separately.

## Database and configuration comparison

Local and staging each have **112 ledger rows: 111 successful and one historical rolled-back attempt**, with no unresolved failure. Successful migration names/checksums match each other and the retained demo cutover ledger. An initial checksum alert incorrectly included the rolled-back attempt; comparing successful entries resolves that alert without a ledger write.

Compared 2,875 schema entries for local and staging: columns/types/defaults/nullability, constraints, indexes and enum members. Three raw text differences are equivalent PostgreSQL array-cast deparsing in the profile proposal status constraint, license MIME constraint and active-profile-proposal unique index. Reviewed their identical values, casts and predicates; no unexplained difference remains. No schema or migration-history correction was necessary.

Membership, clinical clarification and Nara flags agree; resolved weekly Nara caps are **5/15/30**. Local uses code defaults and hosted settings are explicit. Database records, signing credentials, transport origins, provider budgets and outbound email/payment/push behavior remain environment-owned. Staging keeps its conservative 10 global / four chat attempts per day and blocked outbound integrations. Do not synchronize live member records with local/staging fixtures.

A metadata-only Neon project reading reported **14,298,725 transfer bytes**, approximately **0.286% of the existing 5 GB operating budget**, for the new final project. This is a laggable provider counter, not a guarantee of future capacity. No demo SQL/query or live application request was made for this audit after the owner's restriction.

## Defect found from existing hosting logs

An existing `POST /api/user/meals/generate` returned 500 at **11:43 UTC+8**, with a final `DEFINITE_CONFLICT: ALLERGEN_SHELLFISH` error. An earlier unique-generation-job conflict was logged and recovered through the existing path; it is not established as the final cause.

Local reproduction found a concrete classifier defect: FNRI's broad **Fish & Shellfish** category was itself matched as shellfish evidence after ingredient hydration. Ordinary tuna could pass source-name screening and then fail generation once the broad category was attached. The log does not identify its exact ingredient, so this remains a reproduced cause consistent with the live error, not proof of the original member's precise recipe.

Classifier V5 interprets that exact mixed category as seafood evidence without treating it as shellfish presence. Explicit source and composition identities still detect shrimp, prawns, crab, squid and oyster sauce. Unidentified ingredients supported only by the mixed group remain NEEDS_REVIEW. Fish remains nonvegetarian; no personal suitability, approval or allergen-free declaration is granted. New classifier-generated records carry V5. Existing saved declarations/reviews are not silently rewritten or reapproved, so historical conservative classifications may persist until normal review.

Unit/hydration regressions and actual local FNRI tuna/shrimp preparation checks verify the correction, with no saved plan, provider call or patient mutation. This is a code correction, not a clinical validation or an assertion that all possible generation failures are fixed.

## Candidate verification and remaining limits

- Full backend suite: **1,156 pass, zero fail, one existing TODO**, including four added classifier/hydration regressions; backend build and test TypeScript pass.
- Affected dashboard/Nara/progress/RND frontend suite: **327 pass across 54 files**. Frontend production build/TypeScript and scoped lint previously passed for the food form; later source formatting does not alter its behavior. The complete staging build is a separate release gate.
- An older source-text test depended on previous UI wording. Updated it to assert current source disclosure and normalize whitespace; its first retry exposed formatting-sensitive line wrapping, which was corrected before the final full run.
- Browser tests/fresh desktop/mobile visuals remain unverified under the prior browser access-policy limitation. No alternate driver bypass was attempted. Hosted functional checks use short-lived server-issued tokens; ordinary local password login is separate evidence. Staging OAuth and real Gemini answers are not established.
- Online staging and final promotion evidence will be appended after the pinned candidate completes those gates. Demo receives no functional tests.
