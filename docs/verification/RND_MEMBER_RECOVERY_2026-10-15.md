# RND/member clarification and account access recovery — October 15, 2026

## Scope and release status

The owner confirmed that the deployed meal swap works, then authorized these repairs. Demo frontend and API now run narrow release `efdc6923c300dde0a1f25b1eb0a2dbb52c74b03f`, derived from implementation `c6a9136f`. See the promotion evidence and remaining live verification gate below. Assistant and water precision changes remain unreleased.

The investigation covered the reported profile clarification, meal/profile question handoff, linked Google account deletion, and related concurrent plan recovery. This is a bounded regression investigation, not evidence that every system journey is defect-free.

## Confirmed findings

| Finding | Evidence and correction | State |
| --- | --- | --- |
| Meal questions reopen the profile and disappear from Case approval | The existing publisher always rotates the profile review episode and releases all pending meal claims. Introduced explicit Meal question / Profile question choices. Only a profile question retains that handoff. | Fixed locally; additive migration required |
| Answered profile form has no resolution field on its canvas paper or inside Profile decision | Papers rendered the shared form without an `onResolve` callback. Resolution existed in the separate Questions tool. Added claim-gated resolution beside the answer and in the decision dialog; retained the final profile decision gate. | Fixed locally; browser save verified |
| Google-linked member is forced to use a password for deletion | One bounded read-only check of the exact defense database found two accounts matching the screenshot's display name; the Google-linked record has `passwordLoginEnabled=true`. This is evidence of its current capability, not proof that its password is stale or that it was originally Google-only. Added a verified linked-Google alternative for accounts with both methods; preserved password verification for password-only accounts and the existing Google-only session/typed-confirmation path. | Fixed locally; provider verification mocked in tests |
| Concurrent membership reads crash the Prisma engine | The real-engine cross-role test reproduced the same `Option::unwrap()` panic at `MembershipService.state` under the existing explicit relation query strategy. Changed the primary-key predicate to `findFirst` without altering its conditions or entitlement checks. | Fixed locally; real-engine test passes |
| Concurrent current-plan recovery crashes the Prisma engine | After repairing membership reads, the same test reproduced the panic in `current-plan-preparation.service`'s account read. Repaired the same query shape. | Fixed locally; concurrent recovery test passes |
| New document-review icon incorrectly depends on a profile claim | Full frontend regression caught the local icon change disabling a document-only task. Document access already acquires its own claim. Removed the unrelated profile-claim dependency; backend document claim authorization remains in place. | Caught and fixed before release |

No real member was deleted, answered, resolved, approved, or rejected during this investigation. Initial hosted inspection was read-only. The subsequently authorized promotion applied only the additive question-purpose migration; credentials, identity capabilities and configuration were preserved. Workflow mutations used synthetic loopback fixtures.

## Question semantics

- New **Meal question** forms bind to one member, meal and evidence version. They release only that meal's claim and remain in Case approval. The approved profile and other reviewers' claims stay intact.
- Members answer through **RND meal questions** on Meals, including a notification link. The reply is reviewed by an eligible RND holding the current meal claim. Resolution does not approve or reject the meal.
- Approval and replacement paths block until current meal questions are resolved. Automatic certified fallback is also gated. A changed profile, meal or superseded cycle invalidates old answers. Meal-specific answers are excluded from reuse as another member's approval evidence.
- New **Profile question** forms explicitly reopen profile review and send the member to Health details. Existing records retain this original meaning. An old question requested from a meal is not silently reclassified or erased: review and resolve its answer, then separately confirm the profile when appropriate.
- Separate meal/profile question drafts survive canvas changes and inactive-review handoff notices. Success feedback identifies the question handoff rather than implying approval or rejection.

## Schema and release requirements

Migration: `20261015153000_meal_question_scope`.

SHA-256: `5e95ac4033ed384a943b90196ddae5e4bfaf7f1befb7ba6e1c843cfeabfa4b92`.

Adds `ClarificationPurpose` (`PROFILE`, `MEAL`), a `PROFILE` default preserving existing forms, a meal-source integrity check, and an index on meal/purpose/creation date. Rehearsed on isolated localhost/disposable databases, then applied to the confirmed defense target during authorized promotion. No backfill changes a saved decision or clinical history.

For demo promotion, follow `docs/DEMO_RELEASE_PARITY.md`: prepare a narrow reviewed release excluding unreleased assistant changes, apply the compatible additive migration to the exact confirmed defense target, deploy API and frontend together, verify actual commits/checksums and clarification feature settings, and perform bounded authenticated member/RND checks. Password-only and Google-only clients remain compatible; old question clients default to the historical profile handoff. No catalogue import or database restore is required.

## Verification

- Backend build and test TypeScript pass. Backend suite: **1,123 passed, zero failed, one existing TODO**. Account-deletion HTTP tests validate typed confirmation, current-user ownership, invalid/unlinked Google proof rejection, valid linked subject, password fallback, role restrictions and atomic deletion audit. No real Google account was deleted.
- Real Prisma/Postgres HTTP acceptance on a fresh task-owned loopback database: **14 scenarios passed**. Covers member/RND/admin boundaries, simultaneous publication replay, all 21 claim handoffs, old profile flow, new meal flow, foreign ownership, stale recipes/answers, response resolution, concurrent membership receipt creation and current-plan recovery, retained logs/purchases/admission, and synthetic account deletion.
- Initial full frontend run: **1,249 passed / 2 failed across 241 files**. Both failures were investigated: document-only icon gating above, and a claim test that clicked the new visible-but-disabled icon before the asynchronous claim completed. The corrected integration file and canvas tests pass (**16 tests**). New separate meal/profile menu submission tests pass in the case document suite (**6 tests**). New member answer/account-switch tests pass. Scoped clarification/profile/review/account tests and ESLint pass.
- Frontend production build passes. React component quality review and scoped Impeccable detector pass; existing design tokens, accessible icon names, claim-disabled controls, shared modal/form/card primitives and owner-scoped memory caching are retained.
- Browser: a new synthetic local RND opened an answered profile, found **Resolution notes** in **Record profile decision**, submitted a rationale, saw **Clarification resolved**, and the clarification blocker disappeared. The separate profile decision remained unsubmitted. The prior claim/unclaimed and member ownership paths are additionally covered by component/HTTP tests. Physical-device and real Google deletion testing were not performed.
- The normal API was restarted with its isolated loopback database. Repeated checks did not use Neon. The only additional hosted read was the bounded sign-in-capability check described above.
- After verification, removed the four specifically owned synthetic browser accounts (including the two from an interrupted fixture setup) and three specifically owned disposable acceptance databases. No unrelated fixture or member was removed. The browser proof remains in ignored local artifacts.

## Remaining limits

- Existing affected profile forms need their normal resolution/decision; deleting and recreating the account is unnecessary. Their historical profile meaning is preserved.
- Other `findUnique` call sites exist under Prisma 5's explicit relation query strategy. The observed failing paths are repaired; the presence of another call is a review candidate, not proof of another live failure.
- The acceptance fixture logs a nonfatal grocery-projection warning after a synthetic approval whose cycle is deliberately expired. Its saved decision is preserved. This fixture warning does not establish a current live grocery failure.
- Automated checks are engineering evidence, not clinical validation. Pending review, claim, eligibility and audit requirements remain authoritative.

## Authorized demo promotion — October 15 UTC / October 16 local

| Gate | Evidence |
| --- | --- |
| Source | `efdc6923c300dde0a1f25b1eb0a2dbb52c74b03f`, parent `9f16e4af`, implementation `c6a9136f`; 47 reviewed files. Excludes assistant runtime/migration and water precision migration. |
| API | Railway `6fcbc98e-13cd-4b94-a2c8-48fb7997f4d2`, SUCCESS, exact release SHA; public `/ready` returned 200 at `2026-10-15T16:03:05.559Z`. |
| Frontend | Vercel `dpl_J94qPJzuvYq7vT4TZBkpTjVZEsNw`, READY, exact release SHA; URL `nutrimindv1-29nsorw4a-chimairels-projects.vercel.app`, aliases `www.kainara.site` and `kainara.site`. |
| Schema | Only `20261015153000_meal_question_scope` deployed, from exact release migrations, against `nameless-dust-38810716/br-round-art-b355gp02/neondb`. Stored checksum matches the SHA-256 above. Non-null PROFILE default, validated source constraint and composite index verified. Hosted 110 ledger rows/local 112; no active failed or required pending migrations. |
| Configuration | Privately verified exact defense host/database and `CLINICAL_CLARIFICATIONS_ENABLED=true`. Assistant flag remains unset. No settings or secrets changed. |
| Data | No catalogue import. Migration retained 31 accounts, 443 meals and 3 forms. Ordered form-content fingerprint excluding the new purpose field is identical before/after; all retained forms default to PROFILE. |
| Exact release rehearsal | Clean archived source with isolated lockfile installs: both production builds pass; 1,087 backend tests pass, zero fail, one existing TODO; 202 affected frontend tests pass across 43 files; 14 real Postgres/HTTP scenarios pass. Initial clean unit run lacked fixture JWT/provider settings; synthetic unit settings fixed the invocation. No real provider request. |
| Live RND | Ordinary public sign-in and both queues loaded. The reported answered profile opens with Resolution notes and Resolve clarification visible on its paper, correctly disabled before Claim profile. Icon toolbar and claim gating load. No real claim, resolution or clinical decision submitted. |
| Live member | Pending authenticated check. Google sign-in in the Codex browser displayed Popup may be blocked and opened no member session. User sign-in requested in the open demo tab, without requesting credentials in chat or weakening browser settings. Member meal-question and Google-linked deletion controls still need this bounded live check. |
| Local preservation | Isolated localhost `/ready` remains 200. Removed only the owned disposable database `kainara_meal_questions_20261015_36301c62`; no hosted test account seeded or deleted. |

**History provenance correction:** The previous broad “no checksum drift” statement was inaccurate. Eight raw differences match normalized/historical line-ending deliveries. Two inherited unmatched hashes (`20260925210000_versioned_clinical_evidence_registry`, `20261007100000_meal_reminders_web_push`) match localhost and the verified October 11 recovery manifest exactly. This remains the documented PARITY-03 provenance limitation; no new drift or ledger rewrite. Preflight classified these explicitly instead of treating an empty migration inventory as a valid comparison.

**Recovery:** Prior pair: `9f16e4af`, Railway `2b03e3ae-c0d8-4815-a256-53d0c0e9901b`, Vercel `nutrimindv1-31los7i5t-chimairels-projects.vercel.app`. Preserve the additive migration and post-release activity. The old API interprets all questions as profile questions, so do not blanket-roll back after MEAL forms exist; prefer a forward repair or review all readers/new records first. Never restore an old archive over current activity.

**Budget:** One provider read around `2026-10-15T15:46Z` reported 3,024,908,350 transfer bytes, 96,627 `compute_time_seconds`, 365,580 `active_time_seconds`, and zero `data_storage_bytes_hour`, `synthetic_storage_size`, `written_data_bytes` and `cpu_used_sec`. These are reported counters; delayed/zero values do not prove zero use. Transfer is 60.50% of the documented conservative 5,000,000,000-byte operating budget, below the 70% stop threshold. Metadata identifies Free v3 and a 1,073,741,824-byte branch size limit, but does not independently confirm the account transfer allowance. Existing recovery-plan allowance evidence/limitation still applies. No consumption-history call or hosted load test.

Private evidence is under `backend/.local/`: `question-release.json`, `question-parity-before.json`, `question-parity-after.json`, `question-host-config.json`, `question-migration-preservation.json`, `question-release-final-checks.json`, `question-vercel-ready.json`, and separate release build/test/acceptance logs. Deployment is complete; final release verification remains incomplete until the live member gate passes.
