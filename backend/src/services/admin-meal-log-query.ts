import { Prisma } from '@prisma/client';
import { getManilaDateKey } from '@/domain/meal-plan-cycle.policy';
import type { MealLogFilters } from '@/validation/admin-meal-log.schemas';

export function mealLogWindow(filters: MealLogFilters, at = new Date()) {
  const to = filters.to ?? getManilaDateKey(at);
  const from = filters.from ?? getManilaDateKey(new Date(new Date(`${to}T00:00:00+08:00`).getTime() - 29 * 86400000));
  return {
    from,
    to,
    start: new Date(`${from}T00:00:00+08:00`),
    end: new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86400000),
  };
}

export const syntheticAccount = Prisma.sql`EXISTS (SELECT 1 FROM "AuditEvent" a WHERE a.action = 'SYNTHETIC_DEV_ACCOUNT_CREATED'
  AND a."entityType" = 'User' AND a."entityId" = u.id AND a.metadata->>'synthetic' = 'true')`;

export function mealLogWhere(filters: MealLogFilters, popularity = false) {
  const window = mealLogWindow(filters);
  const clauses = [
    Prisma.sql`u.role = 'USER'`,
    Prisma.sql`(r.snapshot->>'mealDate')::timestamp >= ${window.start}::timestamp`,
    Prisma.sql`(r.snapshot->>'mealDate')::timestamp < ${window.end}::timestamp`,
  ];
  if (popularity || !filters.includeTests) clauses.push(Prisma.sql`NOT (${syntheticAccount})`);
  if (filters.member)
    clauses.push(
      Prisma.sql`(u.name ILIKE ${'%' + filters.member + '%'} OR u.email ILIKE ${'%' + filters.member + '%'})`
    );
  if (filters.ageGroup) clauses.push(Prisma.sql`r."ageGroup" = ${filters.ageGroup}`);
  if (filters.membership) clauses.push(Prisma.sql`r.membership = ${filters.membership}`);
  if (filters.mealType) clauses.push(Prisma.sql`r.snapshot->>'mealType' = ${filters.mealType}`);
  if (filters.source === 'OUTSIDE') clauses.push(Prisma.sql`r.snapshot->>'source' = 'USER_LOGGED'`);
  if (filters.source === 'PLANNED') clauses.push(Prisma.sql`r.snapshot->>'source' <> 'USER_LOGGED'`);
  if (filters.status === 'REMOVED') clauses.push(Prisma.sql`(r.deleted OR r.snapshot->>'status' = 'VOIDED')`);
  else if (filters.status) clauses.push(Prisma.sql`NOT r.deleted AND r.snapshot->>'status' = ${filters.status}`);
  if (filters.recipeKey)
    clauses.push(Prisma.sql`(r.snapshot->>'recipeKey' = ${filters.recipeKey} OR EXISTS(
    SELECT 1 FROM "OutsideMealLogItem" i WHERE i."mealLogId" = r."logId" AND
    COALESCE(meal_log_recipe_key(i."mealLibraryId"), 'food:' || i."foodItemId") = ${filters.recipeKey}))`);
  return Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
}

/** One occurrence per log and canonical dish, regardless of variants or repeated outside items. */
export function mealPopularityFacts(filters: MealLogFilters) {
  const where = mealLogWhere(filters, true);
  return Prisma.sql`WITH base AS (
    SELECT r.* FROM "MealLogAuditRecord" r JOIN "User" u ON u.id = r."userId" ${where}
      AND NOT r.deleted AND r.snapshot->>'voidedAt' IS NULL AND r.snapshot->>'status' IN ('DONE','SKIPPED')
  ), facts AS (
    SELECT "logId", "userId", snapshot->>'recipeKey' AS key, snapshot->>'mealName' AS name, snapshot->>'status' AS status
      FROM base WHERE snapshot->>'source' <> 'USER_LOGGED'
    UNION ALL
    SELECT b."logId", b."userId", COALESCE(meal_log_recipe_key(i."mealLibraryId"), 'food:' || i."foodItemId"),
      i.name, 'DONE' FROM base b JOIN "OutsideMealLogItem" i ON i."mealLogId" = b."logId"
      WHERE b.snapshot->>'source' = 'USER_LOGGED' AND b.snapshot->>'status' = 'DONE' AND i."nutritionStatus" <> 'VOIDED'
    UNION ALL
    SELECT b."logId",b."userId",NULL,b.snapshot->>'mealName','DONE' FROM base b
      WHERE b.snapshot->>'source'='USER_LOGGED' AND b.snapshot->>'status'='DONE'
        AND NOT EXISTS(SELECT 1 FROM "OutsideMealLogItem" i WHERE i."mealLogId"=b."logId")
  ), occasions AS (
    SELECT "logId", "userId", key, min(name) AS name, status FROM facts GROUP BY "logId", "userId", key, status
  ), users_per_recipe AS (
    SELECT key, "userId", count(*) FILTER(WHERE status = 'DONE') AS eaten FROM occasions WHERE key IS NOT NULL GROUP BY key, "userId"
  ), ranked AS (
    SELECT o.key, min(o.name) AS name, count(*) FILTER(WHERE status = 'DONE')::int AS eaten,
      count(*) FILTER(WHERE status = 'SKIPPED')::int AS skipped,
      count(DISTINCT o."userId") FILTER(WHERE status = 'DONE')::int AS members,
      (SELECT count(*)::int FROM users_per_recipe x WHERE x.key = o.key AND x.eaten > 1) AS "repeatEaters"
    FROM occasions o WHERE o.key IS NOT NULL GROUP BY o.key
    ${filters.ageGroup || filters.membership ? Prisma.sql`HAVING count(DISTINCT o."userId") FILTER(WHERE status = 'DONE') >= 5` : Prisma.empty}
  )`;
}
