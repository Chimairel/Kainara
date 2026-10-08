# Admin meal logs and popularity

## Admin screens

- **Audit → Meal logs**: filter by member name/email, Philippine meal dates, planned/outside source, meal type, recorded age group, recorded membership and current log status. Details use the report paper and a change dropdown with before/after values, actor, timestamp and rationale. Details reads are recorded in Admin activity.
- **Overview → Meal popularity**: most/least eaten dishes, distinct eaters, repeat eaters, times skipped and eaten percentage. Each ranked dish links to its supporting logs with the same date/cohort/source filters. Popularity describes recorded use, not nutritional quality or clinical suitability.

The member logging screen is unchanged. All new endpoints require the current unsuspended ADMIN role and use private/no-store responses. Clinical profiles, uploaded image bytes and provider/account identifiers are not returned. Details can contain recorded log notes and correction rationale; they are separate from member clinical documents.

## Counting and filters

- Date windows default to the last 30 Philippine calendar days, with inclusive start/end dates and a maximum of 366 days. The filter uses the scheduled date for planned meals and logged-for date for outside meals, not the time an administrator opened the record.
- Only current DONE logs count as eaten. Removed/voided logs and marked development test accounts are excluded. Repeated writes and portion corrections do not create additional eating occasions. SKIPPED planned logs count separately. Pending decisions do not enter the ranking.
- Recipe lineage/family/root-library identity groups serving variants. Outside items use linked library or food reference identities; the same canonical dish appears once within an outside log. Different eating occasions can count separately. Names are never used as recipe identities. Unmatched dishes are counted separately and are not merged into named rankings.
- Eaten percentage is eaten / (eaten + skipped), not a nutritional score. Least eaten shows dishes with recorded decisions; it does not invent unused-library rows with zero decisions.
- Age/membership filters use the context captured when a new log was created. If a pending log was created through a swap, that creation is the context point. Later birthday/profile/subscription changes do not rewrite it. Age is stored as a group, not a copy of the whole profile. An unstarted trial, disabled membership policy and unavailable context remain distinct.
- Age or membership rankings require at least five distinct eaters per dish. Admin individual-log inspection remains available. Audit alone can explicitly include marked test accounts; popularity cannot override this exclusion.

## Evidence capture and retention

`202610090001_meal_log_audit` adds MealLogAuditRecord and MealLogAuditEvent, functions and triggers. Existing log columns, membership policy and clinical guards are unchanged. Triggers capture changes transactionally on MealLog and OutsideMealLogItem; application services set transaction-local actor/reason/context using a parameterized PostgreSQL setting. Direct maintenance writes without attribution are labeled System / unrecorded actor. No-op writes do not create events, and rollback removes both log changes and their events.

Existing logs receive only a baseline of their recorded log values and available recipe relationship. Their original creation time, earlier changes, age and subscription context are unavailable. The UI says so; it never fills them from the current member profile. New decisions retain immutable before/after snapshots. Current projection fields can change only through capture triggers; ordinary direct editing/deletion of audit evidence is rejected. PostgreSQL owners can still alter schema/disable triggers, so this is an application audit control, not cryptographic proof against database administrators.

Deleting an individual log retains its removed status and evidence for admin complaints. Account erasure cascades remove that member's private log evidence. Losing a plan relationship preserves the previously recorded recipe identity and meal date. The detail dropdown pages saved events newest first, twenty per page.

## API

| GET endpoint | Purpose |
| --- | --- |
| `/api/admin/meal-logs` | Bounded log list and count |
| `/api/admin/meal-logs/:logId?page=1` | Read-only log snapshots and paginated changes; audited access |
| `/api/admin/meal-logs/popularity` | Aggregated ranking and unmatched/legacy counts |

Lists use page/limit (default 20, maximum 50), from/to, source, mealType, ageGroup and membership. Audit additionally accepts member, status, recipeKey and includeTests. Popularity accepts order MOST_EATEN or LEAST_EATEN and rejects member selectors, status selectors, recipe selectors and test overrides. Arbitrary detail selectors are rejected; a log ID resolves its server-side member relationship.

## Rollout and verification

1. Confirm the intended database target and authorization, as required by README.md. Back it up before applying pending migrations. On the inspected shared development target, both `202610080002_meal_review_governance` and `202610090001_meal_log_audit` are pending. A normal deploy applies both; do not silently treat approval for one as approval for both.
2. Apply reviewed migrations, then generate Prisma Client while the local API is stopped and restart the API. Windows may lock its loaded Prisma engine DLL during generation. New admin queries require the new tables; existing member-model columns remain compatible before the migration.
3. Check audit baseline count against existing MealLog count, retained unknown legacy context, immutable-write rejection and a newly recorded member action. Older changes cannot be recovered by this rollout.
4. Reuse the normal localhost app for authorized inspection. Disposable destructive/concurrency acceptance uses only `127.0.0.1:55485/kainara_meal_log_audit_test`, test runtime and synthetic fixtures; preserve the separate owner's governance preview database on that container.

`npm --prefix backend run check:meal-log-audit` checks the guarded script. Its `--seed-legacy` phase runs against the previous migration set; the main phase runs after this migration. `npm --prefix backend run test:acceptance:meal-log-audit` then checks real SQL/service/HTTP behavior. The script rejects other database targets and does not call email, AI or payment providers. Browser fixtures in `frontend/e2e/admin-meal-logs.spec.ts` intercept synthetic APIs and check presentation separately; they do not represent live member database evidence.
