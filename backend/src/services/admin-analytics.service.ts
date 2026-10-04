import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';

/** Counts are operational records, never evidence of clinical eligibility. */
export class AdminAnalyticsService {
  static async getSnapshot(now = new Date(), client: Pick<PrismaClient, '$queryRaw'> = prisma) {
    const today = getStartOfManilaBusinessDay(now);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const claimCutoff = new Date(now.getTime() - 30 * 60 * 1000);
    const waitingCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const jobCutoff = new Date(now.getTime() - 20 * 60 * 1000);
    const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    // A single statement supplies one PostgreSQL snapshot and avoids a long interactive transaction.
    const [row] = await client.$queryRaw<Array<{ snapshot: Record<string, unknown> }>>(Prisma.sql`
      WITH members AS (
        SELECT id FROM "User" WHERE role = 'USER' AND NOT "isSuspended"
      ), professionals AS (
        SELECT p.*, u."isSuspended" FROM "NutritionistProfile" p
        JOIN "User" u ON u.id = p."userId" WHERE u.role = 'NUTRITIONIST'
      ), eligible_reviewers AS (
        SELECT id FROM professionals WHERE "isVerified" AND NOT "isSuspended"
          AND ("prcLicenseExpiry" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date
            >= (${now}::timestamptz AT TIME ZONE 'Asia/Manila')::date
      ), cycles AS (
        SELECT c.* FROM "MealPlanCycle" c JOIN members u ON u.id = c."userId"
        WHERE c.status NOT IN ('SUPERSEDED', 'COMPLETED') AND c."supersededById" IS NULL
          AND c."endDate" >= ${today}
      ), current_cycles AS (
        SELECT DISTINCT ON ("userId") id FROM cycles WHERE "startDate" <= ${today}
        ORDER BY "userId", "startDate" DESC, "cycleRevision" DESC
      ), slots AS (
        SELECT p.* FROM "MealPlan" p JOIN members u ON u.id = p."userId"
        LEFT JOIN "MealPlanCycle" c ON c.id = p."planGroupId"
        WHERE p."scheduledDate" >= ${today} AND p."supersededByMealPlanId" IS NULL
          AND (c.id IS NULL OR (c.status NOT IN ('SUPERSEDED', 'COMPLETED')
            AND c."supersededById" IS NULL AND c."endDate" >= ${today}))
      ), ai_groups AS (
        SELECT operation, COALESCE(purpose, 'UNSPECIFIED') AS purpose, status, count(*)::int AS count
        FROM "AiUsageEvent" WHERE "createdAt" >= ${monthAgo}
        GROUP BY operation, purpose, status
      ), candidate_groups AS (
        SELECT "candidateProvenance" AS provenance, count(*)::int AS count FROM "MealPlan"
        WHERE "createdAt" >= ${monthAgo} GROUP BY "candidateProvenance"
      ), clearances AS (
        SELECT * FROM "MealConditionClearance" WHERE state = 'ACTIVE'
          AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
      ), clearance_groups AS (
        SELECT condition, "assuranceTier", provenance, count(*)::int AS count FROM clearances
        GROUP BY condition, "assuranceTier", provenance
      )
      SELECT jsonb_build_object(
        'generatedAt', ${now.toISOString()}::text,
        'totalUsers', (SELECT count(*) FROM "User" WHERE role = 'USER'),
        'totalNutritionists', (SELECT count(*) FROM professionals),
        'verifiedNutritionists', (SELECT count(*) FROM eligible_reviewers),
        'activeMealPlans', (SELECT count(*) FROM current_cycles),
        'approvedUpcomingMealSlots', (SELECT count(*) FROM slots WHERE status = 'APPROVED' AND NOT "requiresSafetyRevalidation"),
        'pendingReviews', (SELECT count(*) FROM slots WHERE status = 'PENDING_REVIEW'),
        'libraryCount', (SELECT count(*) FROM "MealLibrary"),
        'totalMealLogs', (SELECT count(*) FROM "MealLog" WHERE status = 'DONE'),
        'totalFoodItems', (SELECT count(*) FROM "FoodItem" WHERE source = 'FNRI'),
        'usdaFoodItems', (SELECT count(*) FROM "FoodItem" WHERE source = 'USDA_FDC'),
        'totalAliases', (SELECT count(*) FROM "FoodAlias"),
        'overdueReviews', (SELECT count(*) FROM slots WHERE status = 'PENDING_REVIEW' AND "createdAt" < ${waitingCutoff}),
        'activeReviewClaims', (SELECT count(*) FROM slots WHERE status = 'PENDING_REVIEW'
          AND "claimedAt" >= ${claimCutoff} AND "claimedByNutritionistId" IN (SELECT id FROM eligible_reviewers)),
        'expiredVerifiedNutritionists', (SELECT count(*) FROM professionals WHERE "isVerified"
          AND ("prcLicenseExpiry" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date
            < (${now}::timestamptz AT TIME ZONE 'Asia/Manila')::date),
        'completeLibraryEvidence', (SELECT count(*) FROM "MealLibrary" WHERE "safetyEvidenceStatus" = 'COMPLETE'),
        'incompleteLibraryEvidence', (SELECT count(*) FROM "MealLibrary" WHERE "safetyEvidenceStatus" = 'INCOMPLETE'),
        'staleLibraryEvidence', (SELECT count(*) FROM "MealLibrary" WHERE "safetyEvidenceStatus" = 'STALE'),
        'failedGenerationJobs24h', (SELECT count(*) FROM "MealPlanGenerationJob" WHERE status = 'FAILED' AND "updatedAt" >= ${dayAgo}),
        'stuckGenerationJobs', (SELECT count(*) FROM "MealPlanGenerationJob"
          WHERE status IN ('GENERATING', 'PROCESSING_AI') AND "updatedAt" < ${jobCutoff}),
        'aiSuccess24h', (SELECT count(*) FROM "AiUsageEvent" WHERE status = 'SUCCESS' AND "createdAt" >= ${dayAgo}),
        'aiFailures24h', (SELECT count(*) FROM "AiUsageEvent" WHERE status = 'FAILED' AND "createdAt" >= ${dayAgo}),
        'adaptationReviews30d', (SELECT count(*) FROM "WeeklyCheckin" WHERE "adaptationState" = 'REVIEW_RECOMMENDED' AND "createdAt" >= ${monthAgo}),
        'pendingPlansStartingSoon', (SELECT count(*) FROM slots WHERE status = 'PENDING_REVIEW' AND "scheduledDate" <= ${soon}),
        'activeConditionClearances', (SELECT count(*) FROM clearances),
        'rawRecipeCandidates', (SELECT count(*) FROM "RawRecipeCandidate" WHERE status = 'AVAILABLE'),
        'planningAiOperations30d', (SELECT COALESCE(sum(count), 0) FROM ai_groups WHERE operation IN ('MEAL_PLAN_CORPUS_LOOKUP', 'MEAL_PLAN_GENERATION')),
        'activeClearancesByCondition', (SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY condition, "assuranceTier", provenance), '[]'::jsonb) FROM clearance_groups g),
        'aiUsageByOperation30d', (SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY operation, purpose, status), '[]'::jsonb) FROM ai_groups g),
        'planSelectionsByProvenance30d', (SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY provenance), '[]'::jsonb) FROM candidate_groups g)
      ) AS snapshot
    `);
    if (!row) throw new Error('Platform metrics could not be loaded.');
    const candidates = row.snapshot.planSelectionsByProvenance30d as Array<{ provenance: string; count: number }>;
    const total = candidates.reduce((sum, candidate) => sum + candidate.count, 0);
    const fromScratch = candidates.find((candidate) => candidate.provenance === 'AI_FROM_SCRATCH')?.count ?? 0;
    return {
      ...row.snapshot,
      // Compatibility fields for older clients; these are record ratios, not efficiency measures.
      geminiFromScratchSelectionRate30d: total ? Math.round((fromScratch / total) * 10000) / 100 : 0,
      geminiPlanningInvocationsPer100Selections30d: total
        ? Math.round((Number(row.snapshot.planningAiOperations30d) / total) * 10000) / 100
        : 0,
    };
  }
}
