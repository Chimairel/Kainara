# Capstone rehearsal and evaluation

Use this checklist against the exact development commit being demonstrated. Keep demonstrations on marked synthetic accounts. Record the commit, date, configuration, expected result and actual result for each rehearsal; preparation is not evidence that an entire journey has passed.

## Before presenting

1. Start the normal frontend/API and check `/health` and `/ready`.
2. Sign in to the marked member, two eligible RNDs and an admin in **separate browser profiles**, or take turns signing out. Tabs in the same browser profile share one login; they are useful for session testing, not different roles.
3. Confirm the test plan covers current Philippine dates. Past pending requests are intentionally absent from the active queue, while their audit history remains.
4. Confirm the guidance and profile acknowledgment state. A resolved clarification alone does not certify a profile.
5. Prepare a complete, eligible catalogue-based weekly plan for the stable demonstration. Show live AI generation separately only after checking availability; do not describe a saved plan as a newly generated one.
6. Keep a verified local backup and the restore drill result. Never restore over the shared database.

## Demonstration sequence

| Step | Role / action | Required visible result |
| --- | --- | --- |
| 1 | Member opens Health details | Saved declarations, separate forms and any outstanding RND questions are visible; no misleading empty-state illustration. |
| 2 | RND opens Profile queue, claims the member and publishes a question | The form appears on its own canvas sheet; the profile is unchanged. |
| 3 | Member submits an answer | Response is retained; answering alone does not ask for a new acknowledgment. |
| 4 | RND resolves the form; if a correction is needed, proposes it with rationale | Original values and proposed changes are visible. The member may request correction instead of accepting. |
| 5 | Member acknowledges a correction, then RND confirms the current profile and member acknowledges current guidance | Old context cannot authorize new meals. Generation starts only after the applicable gates are satisfied. |
| 6 | Member prepares the current week | Earlier days arrive first; all expected eligible slots eventually fill, or an explicit retry/blocked state explains why they cannot. Pending candidates cannot be logged as approved meals. |
| 7 | RND claims a meal and opens evidence | Member context and complete plate facts appear on canvas sheets. Exact prior references show anonymous numeric evidence; they do not automatically approve a restricted case. |
| 8 | RND swaps, then approves or rejects separately | Swap stays pending. Decisions bind to the inspected version and retain the rationale. |
| 9 | Member opens an approved meal and logs it | Recorded RND attribution is shown where it exists; logging updates the member view and admin log audit. |
| 10 | Admin opens that decision in Audit | Shared read-only canvas shows saved context, chronological decisions and recorded changes. Admin viewing does not perform clinical certification. |
| 11 | Independent RND flags a published recipe, another eligible reviewer re-verifies, then it is flagged again | First incident returns it to pending re-review; second incident quarantines it. A recipe-wide hold differs from an approval-specific hold. |
| 12 | Independent confirmations and admin release | Release stays blocked before two valid confirmations of the same corrected version and concern resolution. Existing member slots still require current eligibility checks. |

Use separate marked recipes for governance examples; do not flag public recipes merely to produce a demonstration. Retain the audit history instead of deleting completed demonstrations. Reruns need fresh marked cases or a documented safe fixture preparation; never reset the shared database.

## Recovery demonstrations

- **Provider unavailable:** show the real retry/blocked message and retained work. A transport outage does not approve a meal. A deterministic prepared scenario can be shown next, with its source stated correctly.
- **Temporary read failure:** retain the saved work, show recovery and retry the read. Do not replay a timed-out decision or import blindly; inspect the recorded result and reuse its existing retry mechanism where supported.
- **Claim expires:** a second eligible reviewer can claim; the previous owner cannot decide. Forms and responses survive the handoff.
- **Member changes profile during review:** the old canvas closes to the queue/idle panel with a notice, and stale decisions fail server-side. Saved historical evidence remains available to the admin.
- **Two tabs reach session expiry:** both tabs stay on the same account after rotation. Logout must prevent stale session restoration. This differs from simultaneous cross-tab account switching, which remains a separately tracked race.

## Repeatable engineering commands

Run from `backend`. These scripts print aggregate results and keep local artifacts under ignored `.local/`; they never export account passwords or clinical content in the evaluation report.

```powershell
# Read-only aggregate statistics; use explicit dates/prefix for the evaluation cohort.
npx tsx scripts/capstone-evaluation.ts --email-prefix=qa-rollout1010- --from=2026-10-03T00:00:00Z --to=2026-10-11T00:00:00Z

# Bounded normal-localhost reads on existing marked accounts, with session cleanup.
npx tsx scripts/capstone-read-benchmark.ts --accounts=.local/dev-test-accounts/ACCOUNT_FILE.json --email-prefix=qa-rollout1010- --member-id=devfixture_rollout1010_member-heart --samples=3 --concurrency=2

# Creates fresh local databases, runs real HTTP/SQL concurrency/reference scenarios,
# then stops its own Docker container while retaining its data for inspection.
node scripts/capstone-concurrency-drill.mjs

# Restores an existing local backup into a fresh container, checks history and
# integrity, applies current migrations only to the copy, and tests the current API.
node scripts/capstone-restore-drill.mjs --archive=.local/backups/BACKUP.dump --manifest=.local/backups/MANIFEST.json --application-smoke=true
```

The restore command verifies the recorded SHA-256 before restoring. The concurrency command reserves loopback port 55488 and refuses downstream target names outside its fresh databases. Do not repurpose these scripts for hosted targets. They stop their own containers; retained Docker data uses local disk, not Neon storage. Remove retained drill containers manually after preserving needed evidence.

## Evaluation definitions

- **Generation elapsed:** `completedAt - startedAt` for completed jobs; includes queue waiting, provider retries and interruptions. Report unfinished/failed jobs alongside it.
- **Review elapsed:** decision submission minus candidate creation. This is queue elapsed, **not active RND work time**. For human workload evaluation, time the actual inspection separately and report participant/sample counts.
- **Rejection percentage:** rejected decisions / all recorded decisions in the interval. Repeat and staged decisions are included; it is not a unique-meal rejection rate.
- **Reference records:** immutable exact-context evidence produced by approval. Current storage does not establish how often someone viewed or relied on it; do not present this count as a measured reuse benefit.
- **Read latency:** total authenticated HTTP elapsed, including database work. State concurrency and sample size. Three samples are a smoke measurement, not a production performance study.

For the defense, report success/failure counts, p50/p95 where samples permit, mismatch controls and recovery outcomes. Separate fixture, normal development and live-provider results. Record unavailable information explicitly. Software acceptance does not establish clinical validity.

## Current evidence

See [October 10 reliability follow-up](CAPSTONE_RELIABILITY_FOLLOWUP_2026-10-10.md), [polishing gates](CAPSTONE_POLISHING_GATES_2026-10-10.md), and [exact-context browser QA](EXACT_REUSE_BROWSER_QA_2026-10-10.md). Demo promotion remains a separate step.
