import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { object, referencePlateFacts } from '@/domain/reusable-review-reference.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { assertMealReviewContext } from '@/domain/meal-review-context.policy';
import { currentReviewProfile } from './meal-review-context.service';
import { loadMealReviewContext, assertCurrentMealReviewContext } from './meal-case-context.service';
import { ReviewRoutingService } from './review-routing.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { recordedReviewConditionsSql } from '@/domain/recorded-review-conditions.sql';

export type RelatedReviewQuery = { condition: string; page: number; search?: string; expectedContextKey?: string };
type SavedReview = {
  id: string; reviewedAt: string; reviewerName: string | null; decision: 'APPROVE' | 'REJECT';
  mealName: string; currentStatus: string; requiresSafetyRevalidation: boolean;
  plateFacts: unknown; ingredients: unknown;
  conditionCodes: string[];
};

/** Condition-level learning references. Never grant access to another member's case or approval controls. */
export class RelatedConditionReviewsService {
  static async list(reviewerId: string, mealId: string, query: RelatedReviewQuery) {
    if (!(await currentReviewProfile(prisma, reviewerId)))
      throw new AppError('A currently eligible RND is required.', 403, 'NUTRITIONIST_INELIGIBLE');
    await ReviewRoutingService.assertMeal(reviewerId, mealId);
    const target = await prisma.mealPlan.findFirst({ relationLoadStrategy: 'join', where: { id: mealId }, select: {
      status: true, userId: true, user: { select: {
        healthConditions: true, allergies: true, safetyProfileEntries: true, userProfile: true,
      } },
    } });
    if (!target || target.status !== 'PENDING_REVIEW')
      throw new AppError('This meal is no longer awaiting review.', 409, 'MEAL_REVIEW_INACTIVE');
    const opened = await loadMealReviewContext(mealId);
    if (opened) {
      assertMealReviewContext(query.expectedContextKey, opened.contextKey);
      await assertCurrentMealReviewContext(mealId, opened.contextKey, prisma, reviewerId);
    } else {
      await ClinicalEvidenceService.assertReadyForMealPlanning(target.userId);
      await ClinicalProfileReviewService.assertReadyForMealPlanning(target.userId);
    }
    const restrictions = adaptUserSafetyRestrictions({
      healthConditions: target.user.healthConditions.map(item => item.condition),
      allergies: target.user.allergies.map(item => item.allergen),
      safetyEntries: target.user.safetyProfileEntries,
      otherConditions: target.user.userProfile?.otherConditions,
      otherAllergies: target.user.userProfile?.otherAllergies,
    });
    if (!restrictions.conditions.includes(query.condition) || query.condition === 'NONE')
      throw new AppError('Choose a condition recorded in the current case.', 400, 'RELATED_REVIEW_CONDITION_MISMATCH');
    const limit = 10;
    const search = query.search?.trim() ?? '';
    const savedConditions = recordedReviewConditionsSql(Prisma.sql`d."evidenceSnapshot"`);
    const matched = Prisma.sql`${savedConditions} @> ${JSON.stringify([query.condition])}::jsonb`;
    // Project only meal evidence in SQL: full private clinical snapshots never leave the database for this list.
    const result = await prisma.$queryRaw<Array<{ total: bigint; rows: SavedReview[] }>>(Prisma.sql`
      WITH completed AS (
        SELECT d.id, d."submittedAt" AS "reviewedAt", d.decision, ${savedConditions} AS "conditionCodes",
          d."evidenceSnapshot"->'reviewedBy'->>'name' AS "reviewerName",
          COALESCE(d."evidenceSnapshot"->'effective'->>'mealName', d."evidenceSnapshot"->>'mealName',
            d."evidenceSnapshot"->'original'->>'mealName', d."evidenceSnapshot"->'reviewContext'->'meal'->>'mealName') AS "mealName",
          p.status AS "currentStatus", p."requiresSafetyRevalidation",
          COALESCE(d."evidenceSnapshot"->'effective', d."evidenceSnapshot"->'original',
            d."evidenceSnapshot"->'reviewContext'->'meal', d."evidenceSnapshot") AS "plateFacts",
          COALESCE(d."evidenceSnapshot"->'effective'->'ingredients', d."evidenceSnapshot"->'original'->'ingredients',
            d."evidenceSnapshot"->'reviewContext'->'meal'->'ingredients', '[]'::jsonb) AS ingredients
        FROM "MealPlanReviewDecision" d JOIN "MealPlan" p ON p.id = d."mealPlanId"
        WHERE d."mealPlanId" <> ${mealId} AND d.decision IN ('APPROVE', 'REJECT') AND ${matched}
          AND NOT EXISTS (SELECT 1 FROM "MealPlanReviewDecision" newer WHERE newer."mealPlanId" = d."mealPlanId"
            AND (newer."submittedAt", newer.id) > (d."submittedAt", d.id))
      ), filtered AS (
        SELECT * FROM completed WHERE "mealName" IS NOT NULL AND strpos(lower("mealName"), lower(${search})) > 0
      ), paged AS (
        SELECT id, "reviewedAt", decision, "reviewerName", "mealName", "currentStatus", "requiresSafetyRevalidation", "conditionCodes",
          jsonb_build_object('calories', "plateFacts"->'calories', 'proteinG', "plateFacts"->'proteinG',
            'carbsG', "plateFacts"->'carbsG', 'fatG', "plateFacts"->'fatG') AS "plateFacts",
          COALESCE((SELECT jsonb_agg(jsonb_build_object('name', COALESCE(i->'ingredientName', i->'name'),
            'quantity', i->'quantity', 'unit', i->'unit', 'source', i->'dataSource'))
            FROM (SELECT value AS i FROM jsonb_array_elements(CASE WHEN jsonb_typeof(ingredients) = 'array'
              THEN ingredients ELSE '[]'::jsonb END) LIMIT 100) items), '[]'::jsonb) AS ingredients
        FROM (SELECT * FROM filtered ORDER BY "reviewedAt" DESC, id DESC LIMIT ${limit} OFFSET ${(query.page - 1) * limit}) page_sources
      )
      SELECT (SELECT count(*) FROM filtered) AS total,
        COALESCE((SELECT json_agg(paged ORDER BY "reviewedAt" DESC, id DESC) FROM paged), '[]'::json) AS rows
    `);
    if (opened) await assertCurrentMealReviewContext(mealId, opened.contextKey, prisma, reviewerId);
    const total = Number(result[0]?.total ?? 0);
    return { condition: query.condition, page: query.page, limit, total, totalPages: Math.ceil(total / limit),
      rows: (result[0]?.rows ?? []).map(row => ({
        id: row.id, reviewedAt: /(?:Z|[+-]\d{2}:\d{2})$/i.test(row.reviewedAt) ? row.reviewedAt : `${row.reviewedAt}Z`,
        reviewerName: row.reviewerName, decision: row.decision, mealName: row.mealName, conditionCodes: row.conditionCodes,
        needsReview: row.currentStatus !== 'APPROVED' || row.requiresSafetyRevalidation,
        plateFacts: referencePlateFacts({ meal: row.plateFacts }),
        ingredients: (Array.isArray(row.ingredients) ? row.ingredients : []).flatMap(value => {
          const item = object(value);
          return typeof item.name === 'string' ? [{ name: item.name,
            quantity: typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : null,
            unit: typeof item.unit === 'string' ? item.unit : null,
            source: typeof item.source === 'string' ? item.source : 'Not recorded',
          }] : [];
        }),
      })),
    };
  }
}
