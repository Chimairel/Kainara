# Local actor MVP and adversarial testing — October 12, 2026

## Scope

The owner requested keeping the release local and testing actual member, RND and admin journeys in a browser before publication. All implementation remains in `C:/Users/chima/Desktop/Nutrimind`. Use localhost API/frontend and `kainara_local_development@127.0.0.1:55432`, preserve a fresh backup, and create marked synthetic accounts through the existing admin test-account feature. Never mutate hosted data, impersonate a real clinician, reset the shared local database or include credentials/clinical snapshots in Git.

## Actors and journeys

| Actor/case | Required journey and evidence |
| --- | --- |
| Admin | Ordinary login; preview/create synthetic accounts with target confirmation; inspect account/credential states; audit actions, immutable snapshots and related read-only canvas; deny clinical approval actions |
| Unrestricted member | Acknowledged guidance → starter/full preparation → meal identities, variety, three expected slots per eligible day → logging/groceries/progress; retry/account isolation |
| Diabetes + milk allergy | Complete saved health details; member-queue confirmation; current guidance acknowledgment; generation and ingredient/allergen checks; pending review → claimed RND decision |
| Hypertension + nuts | Independent profile/context, nutrient evidence and planning outcomes; no inherited permission or broad clinical approval |
| Kidney condition + gluten | Document/detail requirements and evidence gaps must remain visible; a correct hold is not automatically a defect |
| Heart condition + shellfish | Clarification questions, answer history and unsupported-condition handling; manual decisions stay attributable |
| Matching and nearby member cases | Same measured plate/current context exposes recorded numeric review references; a changed allergy, portion, profile or evidence cannot silently reuse clinical clearance |
| RND A and RND B | A claims and sends a form → releases → member answers → B claims and sees the same form and submitted inputs → resolves with notes; concurrent claims, stale submissions and claim expiration fail safely |
| Ineligible RND | Expired/unverified credentials cannot review; own credential maintenance remains available |

## Execution and bug handling

1. Verify API/frontend/local database routing and preserve the local backup. Start only missing servers in the shared checkout.
2. Use ordinary browser login and admin account creation, not mocked authorization. Keep account identifiers and screenshots private except synthetic, reviewed deliverables.
3. Exercise the actual UI → API → PostgreSQL → response flow. Record browser errors, response codes, persisted results and timestamps. External AI/email/payment behavior is labeled separately from catalogue/service behavior; do not invent provider success.
4. Test the clarification handoff and exact/near-context reference journeys in separate browser contexts. Cover member mobile and staff desktop as appropriate.
5. Investigate adversarial cases: duplicate sends/retries, ownership switching, simultaneous claims, altered context, ingredient contraindications, pending-meal actionability, failed preparation and audited history.
6. For each defect: reproduce, identify cause, implement a reusable fix, add a meaningful regression, and rerun the affected journey and neighboring guards. Do not weaken safety or permission checks to get a passing scenario.
7. Deliver an evidence-backed actor MVP report with pass/fail/blocked/simulated distinctions, exact fixes, remaining limitations and screenshots. No live publication in this phase.

## Initial follow-up finding

Read-only investigation of the remaining hosted hold at `2026-10-12T03:38:12.710Z` found current profile/guidance, no saved review decisions, and 21 pending current-date review candidates. The approval path does not explicitly check stale saved rice revisions although member clearance does. This is a candidate approval/availability mismatch, not permission to clear those records. Reproduce it locally before deciding the repair.

## Completed execution

See [the local actor MVP report](LOCAL_ACTOR_MVP_TEST_REPORT_2026-10-12.md) and its sanitized verification JSON. Five reproduced defects were fixed locally. The owner deferred hosted publication; none of this phase's fixes have been deployed.
