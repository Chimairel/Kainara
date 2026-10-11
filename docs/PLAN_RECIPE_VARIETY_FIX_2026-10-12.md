# Progressive meal-plan recipe variety — October 12, 2026

## Cause and correction

The owner reported a live weekly plan repeating Hotsilog, Easy Pasta Salad and Beef Stroganoff every day after profile confirmation. The affected cycle contained 21 pending previews but only three distinct source recipes. Its original, subsequently cancelled generation had 21 distinct recipes; repetition was introduced by the background continuation.

The persistent worker prepares one missing calendar day per turn. Its saved-plan projection previously carried nutrition totals without the source recipe identities or content signatures. Each call therefore started with empty recipe-use tracking and could select the same highest-ranked trio again.

The worker now passes the identities, content signatures, meal types and day numbers of retained active recipes to raw recipe selection. Initial selection and macro refinement exclude recipes already used in that cycle. If the eligible pool is exhausted, the existing fallback carries usage counts and the previous recipe of each meal type across turns. Allergy, dietary, source eligibility, portion and review checks remain authoritative. This improves variety within the available eligible pool; it does not promise 21 different recipes for every restricted profile.

The additional database projection contains only recipe identity/signature fields. No full nutrient catalogue reads, clinical approval, external provider calls, new schema or environment changes were introduced.

## Verification

- Full deterministic backend suite: **949 passed, zero failures, one existing TODO**, 950 total.
- Focused selection, day-macro matching, generation continuation and macro-target suites: **31 passed** in development and the isolated release checkout.
- New regressions cover seven successive one-day selection calls producing 21 distinct eligible recipes, saved identity/signature exclusion, macro refinement preserving those exclusions, and pool-exhaustion fallback retaining usage counts and allergy rejection.
- Actual disposable PostgreSQL acceptance ran the worker across successive turns and produced **21 distinct recipes**. Existing cancelled history, RND allergy holds, source eligibility, blocked cycles and grocery invalidation checks passed. The test refused external provider access and used its separate loopback database on port 55487; normal localhost data was unchanged. The task-owned acceptance container was stopped afterward.
- Backend production build, runtime/test/script TypeScript checks, targeted lint, formatting and architecture budgets passed. This is engineering verification, not clinical approval or a new measured transfer-budget rehearsal.

## Live release

| Component | Commit | Deployment |
| --- | --- | --- |
| Development implementation | `e9e1b4ad9796740bc7b9cd81ad1555b56ebd5320` | Pushed to `origin/development` |
| Railway API | `2176ccd285a828ff978b7a8f068a3a9984eeba84` | `150c4c83-0e3c-4ded-9f7f-14682e196158`, SUCCESS |
| Vercel frontend | Same narrow release commit | `dpl_E72E7eTKpV5Wf9oRXsB6uxbdwiF1`, READY with both public aliases |

The release changes five backend implementation/test/acceptance files. Frontend source is unchanged and retains the earlier confirmation-refresh and profile UI fixes. Public API `/ready` returned 200 after deployment. Deployment metadata and the Vercel commit/aliases were verified. No deployed secrets were replaced.

## Approved saved-plan repair

The owner explicitly approved a full backup and withdrawal of only the 18 untouched duplicate previews for the affected member. Exact target: Neon project `nameless-dust-38810716` (`kainara-defense-20261016`), main branch `br-round-art-b355gp02`, database `neondb`. The original blocked Neon project and local development database were not modified.

The custom-format PostgreSQL backup is 13,848,371 bytes, with SHA-256 `0b9f261a2546d5f318fbb20a363b014973386b7e6002ecd71163488cef979018`. Its archive header, listing and required tables were checked before repair. The ignored private archive and manifest are under `backend/.local/worker-variety-repair/`.

The repair used a serializable transaction with user/cycle locks and guards for current profile/safety revision, unfrozen active cycle, exactly 21 unclaimed pending previews, no reviews/logs/clarifications/pins/purchases and a completed inactive job. It marked only the 18 later duplicate previews CANCELLED, retained their rows and all previous history, preserved the first day's three previews, requeued the normal worker and recorded a genuinely dated audit event. Replacements remain pending RND review. An initial guard referenced the wrong clarification column; PostgreSQL aborted before any changes. Correcting that private helper to the schema's `sourceMealPlanId` allowed the guarded transaction to commit.

After the owner asked to avoid the idle wait, the existing Railway deployment was restarted through the official CLI without rebuilding or changing its configuration. Startup immediately woke the normal worker. It completed the six replacement-day turns by **01:44:51 Philippine time on October 12**. Final verification at **01:45:57** confirmed:

| Saved-plan check | Result |
| --- | ---: |
| Active meals for October 12–18 | 21 |
| Distinct source recipe IDs | 21 |
| Distinct source content signatures | 21 |
| Pending RND review | 21 |
| Original first-day previews preserved | 3 |
| Withdrawn duplicate rows retained as cancelled history | 18 |
| Total rows including pre-existing cancelled history | 60 |

The job is COMPLETED with no recorded error, and each scheduled day has breakfast, lunch and dinner. The API remained ready after restart. SQL verification converts Prisma's UTC timestamp values to Philippine calendar dates before grouping. No load rehearsal or repeated generation was launched against live.

Normal generation completion with missing slots and explicit failed/completed-cycle retries already call `MealAiQueueService.triggerNonBlocking()`. RND confirmation starts the preparation service when current guidance is acknowledged. The scheduler's existing deterministic wake test verifies that new work interrupts its idle wait and subsequent turns continue every 30 seconds. Direct database maintenance does not emit that in-process signal; future maintenance should arrange an explicit backend wake rather than assuming a database write wakes an idle process. The empty-queue backoff remains to protect Neon usage.

## Rollback and evidence boundaries

Prior Railway deployment metadata identified `c2bb20c0-a886-46bc-89eb-84b82bf068a7` at `e57e630eae00f1d87f368724638da1e6f5fc4a0d`; prior frontend was `dpl_Cw6k6yPpJAKsjdbbmabgJ9J79ivz` at that same commit. Reverting the backend reintroduces the day-continuation diversity bug. The existing schema supports this patch without a migration.

Never restore the pre-repair archive over subsequent member activity. Withdrawn rows remain historical records; any later repair must reassess claims, reviews, logs, purchases and profile state. Private receipts contain the exact cycle, withdrawn IDs, audit result and worker counts. Credentials and connection strings remain untracked.
