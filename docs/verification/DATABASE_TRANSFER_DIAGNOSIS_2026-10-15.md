# Database transfer investigation — October 15, 2026

## Scope and conclusion

Read-only investigation of Neon project `nameless-dust-38810716`, branch `br-round-art-b355gp02`, database `neondb`, after the 50% operating-budget warning. The scheduled readings rose from 1,568,598,976 to 2,949,398,280 bytes: **1,380,799,304 additional reported transfer bytes**. Counters may be delayed, and the project's transfer allowance remains unconfirmed; 5,000,000,000 bytes is the existing conservative operating budget.

**The new member assistant is excluded as the hosted cause.** The latest successful Railway deployment is `29fd71f6-3063-4e94-9450-1e9a3c6d5ae4`, from `demo` commit `6212344e9f203e98afe06cd1f4ebeb2a581b1079`. It does not contain the assistant implementation (`6032211d` on its separate branch). Railway's 24-hour HTTP metrics report zero requests to `/api/user/assistant/messages`. Assistant acceptance/browser tests used the separate loopback database, as recorded in `../MEMBER_ASSISTANT.md`.

The investigation confirms existing traffic and several avoidable retrieval patterns, but **does not establish an exact byte breakdown or prove one query caused the entire increase**.

## Observations

The live database reports **121,323,520 bytes of database size** at the diagnostic read. This includes PostgreSQL database objects and is separate from transfer usage. No storage-full finding was established.

Railway reported the following HTTP totals over its rolling 24-hour window during the investigation:

| Request | Count |
| --- | ---: |
| All requests | 3,100 |
| `/api/user/profile` | 297 |
| `/api/nutritionist/review-work-counts` | 186 |
| `/api/nutritionist/queue` | 124 |
| `/api/user/meals/current` | 83 |
| `/api/user/assistant/messages` | 0 |

The aggregate window contained 2,934 successful responses, 112 client errors and 54 server errors. A bounded earlier sample contained 50 meal-verification errors; the existing unified verification record describes that earlier relation-filter failure and its subsequent correction. These counts alone do not measure database bytes. HTTP samples are bounded and are not a complete request ledger. Railway's network samples use their own time buckets and include traffic beyond Neon; they were not substituted for Neon's reported transfer counter.

### Confirmed sources and code paths

1. **Normal localhost shares Neon.** Earlier RND swap/regression and unified meal-verification checks explicitly used the defense database, even though their browser URL was localhost. These are documented in `RND_SWAP_WORKSPACE_2026-10-15.md`, `TODAY_REGRESSION_2026-10-15.md` and `UNIFIED_MEAL_VERIFICATION_2026-10-15.md`. This differs from the isolated assistant tests.
2. **Two full backups were downloaded within the comparison period.** Private archives exist for October 14 nutrient work (13,991,343 compressed bytes, completed 10:17:58 UTC) and October 15 cleanup (14,499,624 compressed bytes, completed approximately 07:50:35 UTC). The backup command performs compression in the local `pg_dump` process, so archive sizes do not measure database-to-client transfer and cannot be used to quantify their share.
3. **Background refreshes fan out.** `frontend/src/components/shared/LiveUpdates.tsx` refreshes session/profile every 60 seconds. Notifications, membership, review counts and active queues add their own refreshes; shared visible polling also responds to focus and live mutation events. Hidden-page polling pauses. Mutation events are broad role-level invalidations, so one action may refresh several mounted resources.
4. **RND replacement searches rescan the source pool.** `backend/src/services/review-source-search.service.ts` retrieves every applicable source page in chunks of up to 600, including ingredients and published nutrition, and only then applies the typed name/ingredient search. It also prepares ingredient compositions for candidate plates before returning 24 results. No persistent source-pool cache is used on this path. This is a concrete avoidable retrieval pattern; it is not a measured attribution of the full increase.
5. **Other reads remain wider than their visible results.** `queryEligibleLibraryPage` scans chunks with ingredient and reviewer/clearance relations to compute authoritative counts. Review badge counts rebuild queues/profile readiness, and current-plan clearance recomputes ingredient/review context. These preserve safety but repeatedly retrieve supporting data. They should be optimized using narrow projections, request-scoped reuse and revision-aware stable-data caching, without caching away current claims, suspension, flags or clinical eligibility.

Live table statistics showed 6,277 sequential scans / 23,585,449 tuples examined for `MealIngredient`, 1,001 / 2,033,268 for `MealLibrary`, and 980 / 1,926,740 for `RawRecipeCandidate`. **These are internal examination counters, not returned row or egress-byte counts**, and their observation window is not the same as the billing interval. Aggregates found 1,967 raw candidates with about 5.77 MB of stored row data, and 2,036 library entries with about 3.27 MB. Actual selected/protocol payload sizes differ.

## Limits and recommended work

`pg_stat_statements` is not installed. No extension was installed, no counters were reset, and no replay/load test or app mutation was run. Pooled connections expose proxy addresses, so the available activity snapshot cannot split historical usage between Railway and localhost. Exact historical per-query byte attribution is unavailable from these observations.

Priorities: keep repeated acceptance/browser rehearsals on the explicitly isolated local database; optimize stable recipe/food retrieval and search predicates while retaining complete result coverage; narrow count/status projections and deduplicate refresh fan-out. Verify database-to-API byte changes on a disposable local workload before a separately authorized deployment. No code, schema, secrets, deployment or running process was changed during this investigation.
