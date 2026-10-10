# Capstone polishing gates — October 10, 2026

Change: **CHG-20261010-18**. These gates apply to the existing workflows. Passing software checks does not establish clinical validity or guarantee provider availability.

Later evidence: [CHG-20261010-19 reliability follow-up](CAPSTONE_RELIABILITY_FOLLOWUP_2026-10-10.md) adds selected-profile read improvements, aggregate evaluation, 33 concurrency/reference checks, full backup restoration with current API smoke, and ordinary expiry/logout with two browser tabs. It does not close the fresh complete-journey, live-provider or forced refresh-contention gates.

## Reliability changes

- New AI worker claims carry a versioned ownership token and a heartbeat every 20 seconds. A two-minute stale heartbeat permits recovery; the normal worker checks every 30 seconds. Unversioned legacy claims retain their 20-minute lease so a mixed deployment does not steal work from an older, live worker. A database outage can delay recovery beyond these intervals.
- Graceful shutdown stops admissions, aborts further preparation/fallback work, waits for the current provider request and owned turn to settle, and returns interrupted owned work to its queue. The installed Gemini SDK has no caller-signal support; its existing 15-second model timeout bounds the request rather than pretending to cancel transport. Reservations remain held until that request settles. Ownership/profile/cycle/evidence checks still gate persistence.
- Refresh rotation uses an exclusive same-origin Web Lock. The new access token is published before the lock is released; waiting tabs reuse it. Account-change/logout checks reject stale access-token publication. Queued lock waits are bounded at 60 seconds and refresh transport at 45 seconds. Browsers without Web Locks retain the existing single-client behavior. This is not a new backend replay allowance or a complete synchronization protocol for simultaneous login/logout across tabs.
- AI endpoint limits now use verified signed account identities: five requests per five minutes per account. Forged or expired tokens retain the anonymous IP allowance. Global provider capacity/token controls remain enforced.
- RND profile workspace reads now allow 90 seconds, preserving explicit caller overrides. Browser testing reproduced a false failure at the former 30-second limit; the normal API returned that saved case successfully in **35,739 ms**. Raising a deadline does not reduce database latency.
- Selecting a member shows progress and hides the previous canvas while opening the next case. Clearing selection invalidates its pending request; a late result cannot reopen the cleared member.
- Dashboard and meal-plan profile holds reuse one actionable notice linking to Health details. It directs the member to questions/corrections without incorrectly implying that only the RND has work remaining. Profile confirmation and meal approval remain separate gates.
- Admin clarification audit responses pair answers with immutable published question text. Duplicate labels remain separate, unanswered/unknown questions remain explicit, and internal form/response/reviewer/retry identifiers stay out of the presentation. Missing generic evidence no longer adds an unexplained “Not recorded” beneath a complete response or resolution.

## Release gates and evidence

| Gate | Evidence | Scope / remaining limit |
| --- | --- | --- |
| Progressive preparation reaches every eligible slot | Disposable PostgreSQL acceptance fills a seven-day, 21-slot general plan and two nine-slot scenarios, earliest missing day first; concurrent recovery, cancellations, unique slots, allergy holds and frozen/stale/expired/deadline gates pass. | Fixtures use a complete synthetic catalogue and no external provider. Due scheduling is advanced in this disposable test. |
| Current development plan is complete | Read-only normal development check: marked weekly member has **21 expected, 21 active, 21 distinct slots**, active cycle, completed generation job and no error. | This checks the saved plan; it is not fresh AI-backed weekly generation. Earlier partial-failure files are intermediate evidence. |
| Worker interruption cannot steal or duplicate work | PostgreSQL ownership/legacy recovery acceptance, lost-owner heartbeat and stale-owner completion denial; unit coverage for orderly drain, admission cancellation and no fallback after cancellation. | Hard process death is covered through expired persisted leases, not a new real process-kill browser run. |
| Session and request budgets are bounded | Cross-client coordination, account-switch/logout, request override and no uncertain-mutation replay tests pass. | Web Locks are simulated in component tests; a fresh real two-tab expiry race is not yet an acceptance pass. |
| Audit history is retained and restricted | Normal localhost API loads exact historical and newer cases; access is recorded; anonymous/member/RND admin-detail reads are denied. | Actual browser results are listed below; API evidence is not substituted for browser proof. |
| Member/RND/admin visible states agree | Browser testing uses existing marked synthetic accounts on the normal localhost app. | Only recorded steps below count as this run's browser evidence; prior broad reuse coverage stays separate. |
| Build and regression gates | Backend/frontend suites, builds, lint and architecture check. | Final results recorded in the engineering record after the last edits. One pre-existing backend TODO remains. |

## Browser acceptance record

- Member: sign-in, generation blocked pending RND profile approval, health details with a resolved clarification and complete saved context; no empty-health illustration beneath those forms.
- RND: shared queues and idle panel, selection loading state, successful current profile opening after the read-budget fix, claim, fullscreen, selected-sheet fit, previous saved guidance and resolved form alongside current profile. A new marked synthetic clarification was submitted through the canvas without altering the profile.
- Member: the new-question notification opened Health details. The member submitted response version 1; the RND queue subsequently showed “clarification answered.”
- RND: opened the same form in fullscreen, inspected the persisted response and resolved it with recorded rationale. The canvas showed RESOLVED while the current profile remained revision 1. Released the test claim; clarification resolution did not certify the profile or approve a meal.
- Admin: filtered the RND history to the marked reviewer and opened the newly resolved form's case in the shared read-only canvas. The changes dropdown retained response version 1 and resolution independently. Browser recheck confirmed the actual saved question/answer, resolution rationale/timestamp and no internal linkage IDs or clinical decision controls. This case-scoped read records sensitive access through the existing backend transaction.
- Screenshots are stored locally in `backend/.local/polish-browser/`; they contain marked synthetic context and are excluded from commits. Synthetic sessions were signed out and the temporary desktop viewport reset after acceptance. The task-owned disposable PostgreSQL container was stopped without removing its data.

## Regression results

- Backend: **903 passed**, zero failed, one existing TODO (904 total); build, lint and test typecheck passed.
- Frontend: final **891 Vitest tests in 189 files**, plus **eight Node checks**, passed; build and lint passed. **11 targeted admin checks** also passed, including a new clarification-mapping regression. The first unrestricted parallel run had one one-second asynchronous quarantine-UI assertion timeout under host contention. The same five-test file passed independently, and the complete suite passed with `--maxWorkers=4`; no product gate or assertion was weakened.
- Source architecture and all **25 composition/controller/service budgets** passed. Real PostgreSQL lease acceptance and seven-day progressive preparation passed. Normal localhost HTTP audit retention/access-denial checks passed.

## Defense readiness

The release gate stays open until an uninterrupted fresh member-to-RND-to-admin journey and required live-provider behavior are verified for the exact demonstration deployment. Prior [reuse browser acceptance](EXACT_REUSE_BROWSER_QA_2026-10-10.md) covers 16 exact-context pairs and four mismatch controls, but its prerequisites were seeded and its one-slot fixtures do not establish a complete onboarding/weekly-generation journey.

Use the existing deterministic catalogue path for a repeatable prepared demonstration. Verify live provider availability before demonstrating new AI fallback. Provider failure must retain saved work and a truthful retry/blocked state; neither fabricated successful generation nor bypassed RND approval is an acceptable recovery.

No demo promotion is included in this polishing change. Preserve historical records and real account credentials. Use disposable PostgreSQL for destructive fault tests and marked accounts for normal localhost browser acceptance.
