# Automatic RND routing — scenario verification (2026-10-08)

Integration tested using real Express HTTP authorization and PostgreSQL reads/writes in a fresh task-owned loopback database, with all 94 migrations. Every account and clinical input was fictional. No fictional accounts were created in the shared development database, and its routing configuration was not changed.

## Fictional reviewers

| RND | Years | Admin-verified expertise | Experience verified? |
| --- | ---: | --- | --- |
| Alex | 30 | None | Yes |
| Bea | 18 | KIDNEY_DISEASE | Yes |
| Cora | 12 | HEART_CONDITION | Yes |
| Dani | 8 | HEART_CONDITION, DIABETES | Yes |
| Ella | 6 | DIABETES | Yes |
| Faye | 4 | HEART_CONDITION | Yes |
| Gio | 2 | HEART_CONDITION | Yes |
| Hana | 25 | HYPERTENSION | Yes |
| Iris | 40 | None verified | No; self-reported only |
| Jules | 30 | None | Yes |

All ten had current licensed-RND eligibility. Their legacy availability flags remained false, and no online-status gate was used. Iris was eligible for general reviews, but unverified expertise and self-reported 40 years could not grant priority.

## Actual first-access results

| Member case | Priority reason | RNDs with first access | Other RNDs |
| --- | --- | --- | --- |
| Heart condition | MATCHING_EXPERTISE | Cora, Dani, Faye, Gio | Hidden; direct detail HTTP 404 |
| Diabetes | MATCHING_EXPERTISE | Dani, Ella | Hidden; direct detail HTTP 404 |
| Heart condition and diabetes | MATCHING_EXPERTISE | Dani | Hidden; direct detail HTTP 404 |
| Kidney disease | MATCHING_EXPERTISE | Bea | Hidden; direct detail HTTP 404 |
| Hypertension | MATCHING_EXPERTISE | Hana | Hidden; direct detail HTTP 404 |
| Pregnancy (no expert) | EXPERIENCE_PRIORITY | Alex, Jules | Hidden; direct detail HTTP 404 |
| Diabetes and kidney disease (no complete expert) | EXPERIENCE_PRIORITY | Alex, Jules | Hidden; direct detail HTTP 404 |

For each case, profile and meal queue membership, direct detail HTTP authorization, a real profile claim/approval, the first dependent meal cycle sharing the same episode, and initial notification recipients passed. Every selected RND had HTTP 200 access; every other RND had HTTP 404 access before opening. The heart case includes four RNDs without a cap. The two fallback cases include both 30-year RNDs even though each has no condition tags. Partial expertise for separate conditions does not qualify as complete expertise for a combined case.

## Transition and safety checks

- An experience-priority claim survived repeated routing refreshes without fabricated specialist tags. Revoking its verified experience released the claim.
- Newly verifying Ella for pregnancy switched that case to her expertise pool, released the mismatched experience claim and kept the original beginning/opening times. Revoking that pregnancy tag restored the highest experience tier with the same deadline.
- After expiry, all ten eligible RNDs could access the heart case; both meals remained pending, with no automatic approval.
- After all priority qualifications were revoked in the disposable fixture, a new case opened immediately to the general eligible pool.
- The broader acceptance script passed encrypted private-document access, hidden counts and decisions, evidence/safety revisions, shared-clock limits, early deadlines, delayed observation, license/verification/suspension gates, member-specific decisions, notification deduplication and disabling.

## Limits and reproduction

Run `npm --prefix backend run test:acceptance:specialist-routing` only with its guarded fresh `127.0.0.1:55483/kainara_specialist_routing` test database and synthetic environment. It rejects other targets, existing users and external provider credentials. The matrix is in `backend/scripts/helpers/specialist-routing-scenarios.ts`.

These are software integration tests, not clinical validation, live notification delivery or real professional credential verification. Sparse synthetic meals trigger existing grocery/disabled-AI background warnings and do not verify those integrations. Shared development routing remains disabled pending deliberate operator activation; demo promotion is separate.
