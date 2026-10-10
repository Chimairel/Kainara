# Reliability, evaluation and rehearsal follow-up — October 10, 2026

Change **CHG-20261010-19**, following [the polishing gates](CAPSTONE_POLISHING_GATES_2026-10-10.md). Development only; demo remains unpromoted.

## Responsiveness changes

The selected RND profile previously rebuilt the global member queue, fetched the member repeatedly, loaded the same evidence workspace twice and awaited several independent reads sequentially. Opening now:

- restricts both queue sources to the selected member;
- shares one freshly fetched, member-checked profile within that read request;
- shares the evidence workspace with the profile panel;
- fetches independent review, clarification, proposal, claim and workspace data concurrently.

The request-local object cannot be reused for another member or a staff role. Nothing is cached across requests. Approval/proposal/clarification writes retain their existing locks, live credentials, expected context checks and immutable evidence. Full queue reads retain the current membership rules; no expertise reservation is reintroduced.

### Normal localhost measurement

Existing marked rollout accounts; each final endpoint has **three samples**, concurrency **two**, all HTTP 200:

| Read | p50 | p95 / maximum |
| --- | ---: | ---: |
| Member meal workspace | 9,870 ms | 11,975 ms |
| RND selected profile | 7,325 ms | 11,886 ms |
| Admin RND audit list | 996 ms | 1,130 ms |

The earlier reported profile failure completed in 35,739 ms. Intermediate runs after initial changes measured 15,327 ms median at concurrency one, then 14,046 ms at concurrency two. These are small development smoke samples on the same host, not a controlled benchmark or a guarantee about the hosted demo. Remaining remote database latency is material, especially the member workspace. A private diagnostic before the final queue reuse counted 103 SQL events in the selected-profile read; relation/transaction round trips contributed to its delay. Database reads are not made safe by merely extending their timeout.

Local results: `backend/.local/capstone-evaluation/reads-1791637762845.json`. The benchmark revokes only its own refresh sessions. It does not clear other tabs' sessions or export tokens.

## Evaluation tooling

`capstone-evaluation.ts` reads recorded generation and review data for an explicit interval/cohort and emits aggregate JSON. It reports completion/unfinished states, elapsed distributions, rejection counts, plate provenance and exact-context reference records. Empty populations produce null rates, not invented success.

The marked development cohort returned **three historical generation jobs: two completed and one failed**. Completed elapsed values were 27,314 ms and 569,078 ms; the latter includes waiting/retries. Its 39 approved and 12 cancelled raw-corpus plates are recorded software fixtures. It had no RND meal decisions in this window, so review timing/rejection percentage were unavailable. A separate disposable acceptance cohort exercised the decision aggregation with a recorded approval. Neither cohort establishes real-user or clinical outcomes.

No active RND work-time or reference-view telemetry exists in the current schema. The report labels queue elapsed and evidence produced honestly; it does not call those active workload or measured reuse benefit. Human evaluation should separately time actual inspection and compare clearly stated samples/mismatch controls.

## Concurrency and recovery evidence

The repeatable Docker drill runs existing guarded HTTP/SQL scenarios in three fresh databases. The final run passed **33 checks**:

- 19 clarification/proposal checks, including concurrent answers/resolution, claim handoff, duplicate proposal/acknowledgment and retained correction requests;
- eight context checks, including 20 simultaneously claimed reviews being invalidated by a member revision, stale decision denial, serialization behind the profile lock and case-scoped admin access;
- six exact-reference checks, including exact matching, changed source context, serving/evidence revisions, quarantine, credential expiry and no reconstruction of missing legacy snapshots.

Selected-member workspace assertions were added to the proposal HTTP acceptance so the optimized read is exercised against real PostgreSQL while a clarification is pending. This retains matching profile revisions and the recorded form.

Chromium regression: **17 passed** across preparation-refresh and professional-workflow specifications. These exercise phone/desktop partial preparation, explicit failures and retries, temporary 503 recovery, pending preview holds, profile forms, staff controls and empty-state logic. These tests intercept server responses; they are browser/UI evidence, not substituted for live provider or shared-database acceptance.

Final backend regression: **907 passed, zero failed, one existing TODO (908 total)**. Backend build, relevant lint, test/scripts typechecks and architecture/all 25 entry-point budgets passed. Frontend source was unchanged in this unit.

## Normal browser session evidence

Two temporary synthetic member tabs were kept open on the normal localhost application. The access token reached its real 15-minute lifetime: the persisted refresh session issued at approximately 12:54:07 UTC was replaced at approximately 13:09:09 UTC. The total session count stayed six; unrelated existing sessions were preserved. Both tabs subsequently displayed their protected member pages. Logout returned both tabs to Account access and removed that browser's session, leaving five pre-existing sessions.

The run did not capture two deliberately synchronized 401 responses, so a forced simultaneous-refresh race is **not** claimed as passed. Simultaneous cross-tab account switching/HttpOnly response races remain a separate limit. During source editing, dev-server restarts produced transient network warnings; one outside-history 30-second timeout was also observed under concurrent work. Stable final sampled endpoints succeeded, but that history endpoint was not separately performance-qualified. The tabs were signed out and closed; their screenshot remains private under `backend/.local/capstone-browser/`.

## Backup restoration

The existing local archive SHA-256 was checked before restoration. Its full PostgreSQL copy restored in approximately **24 seconds** to a newly created Docker container. Retained: **36 accounts, 270 meal rows, one meal decision, two profile review rows, 608 audit events and 99 recorded migration rows**, across 109 tables. These are counts at the backup timestamp, not current development counts.

All foreign keys were validated; duplicate scheduled-meal logs and daily aggregates were zero. Current migrations were then applied **only to the restored copy**, followed by the current API smoke: health/readiness succeeded, anonymous audit access was denied, the historical profile snapshot loaded unchanged and sensitive access was recorded. No browser journey or encrypted-file decryption was tested on the restored copy. The historical audit smoke does not require real credentials or enable outbound providers.

Results: `backend/.local/capstone-restore/1791637276174/result.json`. The drill and concurrency containers were stopped and retained for inspection; they use local Docker disk, not Neon database storage. No shared migration, import, seed or restore was performed.

## Rehearsal and remaining gates

[Rehearsal runbook](CAPSTONE_REHEARSAL_RUNBOOK.md) provides the sequence, expected visible results, recovery examples and reproducible commands. It distinguishes prepared catalogue material from fresh/live generation and explains same-profile tab sessions versus separate role sessions.

Still required before an unqualified defense-ready claim:

- an uninterrupted fresh onboarding-to-member-use-to-admin journey on the exact demonstration deployment;
- full live-provider weekly generation/fallback completion;
- deliberately synchronized real refresh contention and cross-tab account-switch testing;
- deployment-specific latency measurements, including outside-history reads.

These remain explicit gates. This unit supplies repeatable tooling and measured evidence; it does not certify every possible condition or guarantee provider/network availability.
