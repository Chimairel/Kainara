# RND replacement search timeout — October 14, 2026

## Report and cause

The owner repeatedly refreshed a failed Swap meal search for Ginataang Monggo with Tofu and Malunggay. The request displayed a generic load/save error and zero options. The review details and active claim were valid.

The Axios read-budget matcher covered queue details and condition references but omitted `/nutritionist/queue/:id/swap-options`. That read therefore stopped at the ordinary 30-second budget. The exhaustive source search needed longer under the observed shared database latency. The API logs showed OPTIONS requests without finished GET responses for the owner's cancelled searches, not a server rejection or an empty match pool.

## Fix

- Swap-option reads receive the existing 90-second review-read budget. Explicit request-specific timeouts remain intact. Mutation retries, auth, claim and version policies are unchanged.
- The trusted internal RND scan reads bounded chunks of up to 600 records instead of 120. Ordinary provider pagination stays capped at 120 and exact selected-source revalidation uses the ordinary bound. This reduces round trips without caching clinical decisions, truncating the pool, removing exclusions or changing match criteria.
- Search errors distinguish a timeout or unreachable server and direct the reviewer to Refresh options. Save/version errors retain their existing handling and rationale preservation. Cancelled and stale results remain ignored.

## Verification

Five backend search tests and 19 frontend HTTP/hook tests pass, including scanning beyond the larger batch, full counts, missing values, allergies/holds, non-first identity revalidation, default page bounds, explicit timeouts, cancellation and clean retry after timeout. Scoped lint and both production builds pass.

Two bounded read-only service checks used the owner's exact case:

| Reading | Before | After |
| --- | ---: | ---: |
| Eligible source candidates | 687 | 687 |
| Displayed candidates | 24 | 24 |
| Source-provider queries | 11 | 3 |
| Source search elapsed | 37,598 ms | 17,454 ms |
| Context + library + source elapsed | 55,543 ms | 36,750 ms |

These observations include database/network latency and are not general latency guarantees. There are zero certified-library choices for this case; source candidates remain pending RND approval.

The normal shared API was restarted with the built fix after checking the owned process and defense database target. The already-authenticated RND browser opened the exact case using the owner's existing active claim; it did not claim, release, swap or decide a real member meal. The actual fixed API returned HTTP 200 after **43,521 ms**, past the old timeout. The UI displayed **24 of 687 available** and enabled normal candidate browsing instead of the error. Screenshot: ignored `codex_outputs/rnd-swap-search-fixed-20261014.png`.

Shared source facts, member profiles, claims and approval state were not edited. No provider AI request, schema migration, load test or hosted deployment was performed. Private diagnosis/logs remain under backend/.local.
