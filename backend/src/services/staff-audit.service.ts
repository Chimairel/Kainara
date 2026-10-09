import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { auditActionLabel, auditOutcomeLabel, nutritionistAuditActions } from '@/domain/audit-history.policy';
import { normalizePagination } from '@/policies/pagination.policy';

export type StaffAuditFilters = {
  view: 'admin' | 'nutritionist';
  page?: number;
  limit?: number;
  actor?: string;
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
  relatedTo?: string;
  recordId?: string;
  includeAdminMealFlags?: boolean;
};
type AuditRecord = {
  id: string;
  occurredAt: string;
  actor: string;
  actorId: string | null;
  role: string;
  actionCode: string;
  subject: string;
  targetType: string;
  targetId: string | null;
};

/** Only public staff summaries leave the database; metadata, reasons and health answers are excluded. */
export class StaffAuditService {
  static async history(filters: StaffAuditFilters, db = prisma) {
    const { page, limit } = normalizePagination(filters.page ?? 1, filters.limit ?? 20, 20);
    const roleWhere = filters.relatedTo
      ? Prisma.sql`(role IN ('ADMIN', 'NUTRITIONIST') OR "actionCode" = 'MEAL_REVIEW_REQUEST_WITHDRAWN')`
      : filters.view === 'admin'
        ? Prisma.sql`role = 'ADMIN'`
        : filters.includeAdminMealFlags
          ? Prisma.sql`(role = 'NUTRITIONIST' OR (role = 'ADMIN' AND "actionCode" = 'MEAL_BASE_FLAGGED'))`
          : Prisma.sql`role = 'NUTRITIONIST'`;
    const conditions = [roleWhere];
    if (filters.recordId) conditions.push(Prisma.sql`id = ${filters.recordId}`);
    if (filters.actorId) conditions.push(Prisma.sql`"actorId" = ${filters.actorId}`);
    if (filters.actor?.trim()) conditions.push(Prisma.sql`strpos(lower(actor), lower(${filters.actor.trim()})) > 0`);
    if (filters.action?.trim())
      conditions.push(
        Prisma.sql`strpos(lower("actionCode"), lower(${filters.action.trim().replace(/\s+/g, '_')})) > 0`
      );
    if (filters.from) conditions.push(Prisma.sql`"occurredAt" >= ${new Date(`${filters.from}T00:00:00+08:00`)}`);
    if (filters.to)
      conditions.push(
        Prisma.sql`"occurredAt" < ${new Date(new Date(`${filters.to}T00:00:00+08:00`).getTime() + 86_400_000)}`
      );
    if (filters.relatedTo)
      conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM records selected WHERE selected.id = ${filters.relatedTo}
      AND selected.role IN ('ADMIN', 'NUTRITIONIST') AND (
        (selected."targetId" IS NOT NULL AND selected."targetType" = records."targetType" AND selected."targetId" = records."targetId")
        OR selected.id = records.id))`);
    const result = await db.$queryRaw<Array<{ total: bigint; rows: AuditRecord[] }>>(Prisma.sql`
      WITH flag_origins AS (
        SELECT f.*, COALESCE(f."flaggedByAdminUserId", n."userId") AS "actorId",
          COALESCE(a.name, u.name, 'Former reviewer') AS actor,
          CASE WHEN f."flaggedByAdminUserId" IS NOT NULL THEN 'ADMIN' ELSE 'NUTRITIONIST' END AS role,
          CASE WHEN COALESCE(root."sourceRawRecipeCandidateId", m."sourceRawRecipeCandidateId") IS NOT NULL THEN 'RecipeSource' ELSE 'MealLibrary' END AS "targetType",
          COALESCE(root."sourceRawRecipeCandidateId", m."sourceRawRecipeCandidateId", m."recipeFamilyId", m.id) AS "targetId",
          COALESCE(root."mealName", m."mealName") AS subject
        FROM "MealLibraryFlag" f JOIN "MealLibrary" m ON m.id = f."mealLibraryId"
        LEFT JOIN "MealLibrary" root ON root.id = m."recipeFamilyId"
        LEFT JOIN "NutritionistProfile" n ON n.id = f."flaggedByNutritionistId"
        LEFT JOIN "User" u ON u.id = n."userId" LEFT JOIN "User" a ON a.id = f."flaggedByAdminUserId"
      ), events AS (
        SELECT e.id, e."createdAt" AS "occurredAt", COALESCE(e."actorUserId", legacy_profile."userId") AS "actorId",
          COALESCE(e."actorName", u.name, legacy_reviewer.name, 'Actor not recorded') AS actor,
          COALESCE(e."actorRole"::text,
            CASE WHEN e.action IN ('NUTRITIONIST_ACCOUNT_ACTIVATED', 'USER_SELF_DELETION', 'HEALTH_DETAILS_UPDATED', 'CLINICAL_DOCUMENT_UPLOADED', 'CLINICAL_DOCUMENT_WITHDRAWN') THEN 'USER'
            WHEN e.action IN ('MEAL_BASE_FLAGGED', 'MEAL_LIBRARY_FLAGGED') THEN (
              SELECT f.role FROM flag_origins f WHERE f."actorId" = e."actorUserId"
              AND (f."mealLibraryId" = e."entityId" OR e.metadata->'variantIds' ? f."mealLibraryId")
              AND abs(extract(epoch FROM f."createdAt" - e."createdAt")) <= 1 LIMIT 1
            ) WHEN e.action IN (${Prisma.join([...nutritionistAuditActions])}) THEN 'NUTRITIONIST'
            WHEN e.action ~ '^(ADMIN_|WEBSITE_|REFERENCE_DATA_|FOOD_CONSUMPTION_|NUTRITIONIST_APPLICATION_|NUTRITIONIST_ACCESS_|NUTRITIONIST_VERIFIED|NUTRITIONIST_CALL_|MEAL_IMAGE_|USER_SUSPENDED|USER_REINSTATED)' THEN 'ADMIN'
            END, u.role::text, 'UNKNOWN') AS role,
          CASE WHEN e.action = 'MEAL_LIBRARY_FLAGGED' THEN 'MEAL_BASE_FLAGGED' ELSE e.action END AS "actionCode",
          COALESCE(CASE WHEN e.action ~ '^(OUTSIDE_MEAL_|BASE_MEAL_)' THEN e.metadata->'food'->>'name' END,
            root."mealName", m."mealName", raw."recipeName",
            CASE e."entityType" WHEN 'ClinicalProfileReview' THEN 'Health profile' WHEN 'ClinicalDocument' THEN 'Clinical document'
              WHEN 'MealPlan' THEN 'Meal plan case' WHEN 'OutsideMealLogItem' THEN 'Outside food log'
              WHEN 'User' THEN 'Account' WHEN 'NutritionistProfile' THEN 'Nutritionist credentials'
              WHEN 'NutritionistApplication' THEN 'Nutritionist application' WHEN 'WebsiteContent' THEN 'Website media'
              ELSE regexp_replace(e."entityType", '([a-z])([A-Z])', chr(92) || '1 ' || chr(92) || '2', 'g') END) AS subject,
          CASE WHEN m.id IS NOT NULL THEN CASE WHEN COALESCE(root."sourceRawRecipeCandidateId", m."sourceRawRecipeCandidateId") IS NOT NULL THEN 'RecipeSource' ELSE 'MealLibrary' END WHEN raw.id IS NOT NULL THEN 'RecipeSource' ELSE e."entityType" END AS "targetType",
          COALESCE(root."sourceRawRecipeCandidateId", m."sourceRawRecipeCandidateId", m."recipeFamilyId", e."entityId") AS "targetId"
        FROM "AuditEvent" e LEFT JOIN "User" u ON u.id = e."actorUserId"
        LEFT JOIN "NutritionistProfile" legacy_profile ON legacy_profile.id = e.metadata->>'reviewerProfileId'
        LEFT JOIN "User" legacy_reviewer ON legacy_reviewer.id = legacy_profile."userId"
        LEFT JOIN "MealLibrary" m ON m.id = e."entityId" AND e."entityType" IN ('MealLibrary','LIBRARY_MEAL')
        LEFT JOIN "MealLibrary" root ON root.id = m."recipeFamilyId"
        LEFT JOIN "RawRecipeCandidate" raw ON raw.id = e."entityId" AND e."entityType" = 'RAW_RECIPE'
      ), legacy_flags AS (
        SELECT DISTINCT ON (f."targetType", f."targetId", f."actorId", f."createdAt", f.reason)
          'flag:' || f.id AS id, f."createdAt" AS "occurredAt", f."actorId", f.actor, f.role,
          'MEAL_BASE_FLAGGED' AS "actionCode", f.subject, f."targetType", f."targetId"
        FROM flag_origins f WHERE NOT EXISTS (
          SELECT 1 FROM events e WHERE e."actionCode" = 'MEAL_BASE_FLAGGED'
          AND e."actorId" IS NOT DISTINCT FROM f."actorId"
          AND e."targetType" = f."targetType" AND e."targetId" = f."targetId"
          AND abs(extract(epoch FROM e."occurredAt" - f."createdAt")) <= 1)
        ORDER BY f."targetType", f."targetId", f."actorId", f."createdAt", f.reason, f.id
      ), records AS (SELECT * FROM events UNION ALL SELECT * FROM legacy_flags), filtered AS (
        SELECT * FROM records WHERE ${Prisma.join(conditions, ' AND ')}
      ), paged AS (SELECT * FROM filtered ORDER BY "occurredAt" DESC, id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit})
      SELECT (SELECT count(*) FROM filtered) AS total, COALESCE((SELECT json_agg(paged ORDER BY "occurredAt" DESC, id DESC) FROM paged), '[]'::json) AS rows
    `);
    const total = Number(result[0]?.total ?? 0);
    const rows = (result[0]?.rows ?? []).map((row) => ({
      ...row,
      action: auditActionLabel(row.actionCode),
      outcome: auditOutcomeLabel(row.actionCode),
    }));
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
