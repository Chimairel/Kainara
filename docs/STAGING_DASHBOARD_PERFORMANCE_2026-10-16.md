# Staging dashboard latency — October 16, 2026

## Reproduction and cause

The owner's staging screenshot showed the dashboard waiting on loading skeletons. Retained laptop API logs at approximately 16:02 UTC+8 recorded 75.5 seconds for cycles, 88.1 seconds for current meals and 73.1 seconds for check-in status. Other authenticated reads also slowed. These durations were measured inside Express, so frontend rendering and the public proxy alone cannot explain them.

Profiling the existing release against the separate staging database found 85 queries for a current-cycle clearance read. Two active/upcoming cycles opened exact-approval-reuse transactions even though neither had a reuse candidate. Both transactions lock the same member row. This unnecessary serialization combines with sequential relation reads and variable laptop-to-database latency. A standalone warmed `SELECT 1` took 133–289 ms in the initial sample; that is not a guarantee for later requests.

## Correction

- Before opening approval reuse transactions, check the existing scoped candidate predicate with an ID-only query. Reuse the same predicate inside the locked transaction. Existing reused approvals remain candidates even if their reference disappeared, preserving invalidation.
- Use explicit relation joins on the profiled cycle lifecycle, clearance and summary reads, and the locked reuse profile read. Preserve the selected fields, filters, approval logic, transaction isolation and profile locks when there is work to reconcile. Do not enable joins globally.
- No schema, migration, provider budget, membership allowance or approval policy change.

## Verification

Against the same local member and retained local database, old/revised code returned identical 12 cleared meal IDs and the same current cycle. Queries fell from 82 to 15; measured duration was 295 ms versus 101 ms. Against the same staging member, both returned identical 21 cleared meal IDs and the same cycle; queries fell from 85 to 16, measured duration 46,204 ms versus 12,880 ms. Each comparison used the same records sequentially, not simultaneous load. Network/cache variability means these timings are samples, not a guaranteed percentage improvement or complete dashboard timing.

Full backend regressions: 1,159 pass, zero failures, one existing TODO. Three new regressions cover an empty candidate set and continued locked revalidation of existing reused approvals with/without a surviving reference. Backend compilation and test TypeScript pass. Local and staging records remain independent. No Gemini request or demo live functional/SQL test was used.

## Transport recovery and rollout status

During diagnosis, the laptop API and tunnel were no longer running. Their earlier logs were preserved before restarting them. The replacement quick tunnel has a different origin. The preview must be redeployed with its staging-only `INTERNAL_API_URL` updated before the usual staging alias can use it.

The saved Vercel CLI token and Vercel connector both returned 403 (not authorized for `chimairels-projects`). The owner was asked to sign in with the project owner account. Public preview recovery is pending that access; direct staging database measurements do not establish that the Vercel preview is restored. Demo deployment remains on the previously tested release and is not promoted as part of this investigation.

The laptop must remain running with its API/tunnel processes for online staging to work. This dependency is independent of the code performance correction.

## Candidate API checks

Committed candidate `7efa6c14` is integrated into remote `development` and `codex/member-assistant`. The staging backend was rebuilt from its clean Git archive and pinned to this candidate on port 5102. Its replacement public tunnel is `https://comes-outdoors-work-xbox.trycloudflare.com`. No uncommitted source or unrelated assets entered the candidate.

Ten authenticated GET checks passed: local current meals/cycles/check-in/water, the same four on the staging laptop API, and current meals/water through the new public tunnel. All returned 200/success. The local four-request batch completed in 258 ms. The staging API batch completed in 24,089 ms (current meals); the separate two-request public tunnel batch completed in 13,004 ms. A subsequent direct current-meals read took 19,512 ms: server timing attributed about 9.25 seconds to prerequisites, 7.85 to lifecycle/clearance and 2.38 to meal loading. This confirms residual latency rather than a complete performance resolution. No cached safety result or skipped gate was introduced to hide the delay.

The public **Vercel preview alias has not been restored/verified**: its branch and frontend deployment still identify the prior release until the tunnel override can be published with authorized Vercel access. The new API can be tested through its public tunnel, but that is not evidence for the full preview proxy path. Remote `demo` remains `8d4bd49f`; no demo deployment was requested. Local API serves the candidate against loopback PostgreSQL; its frontend source is unchanged from the existing clean release archive. This is an explicitly pending staging candidate, not a claim of completed release parity.
