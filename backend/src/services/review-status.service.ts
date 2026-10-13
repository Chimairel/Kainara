import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { env } from '@/config/env';
import { AppError } from '@/errors/AppError';
import { getNutritionistReviewableMealPlanWhere } from '@/domain/meal-actionability.policy';
import { isReviewClaimActive } from '@/domain/nutritionist-review.policy';
import { ReviewRoutingService } from './review-routing.service';
import { NutritionistProfileWorkService } from './nutritionist-profile-work.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { ClinicalEvidenceService } from './clinical-evidence.service';

/** Hash metadata in PostgreSQL: answers, snapshots, report contents and document bytes never cross the wire. */
async function memberRevision(userId: string) {
  const clarification = env.CLINICAL_CLARIFICATIONS_ENABLED
    ? Prisma.sql`
    ,(SELECT string_agg(concat_ws(':', f.id, r.id, r.version, x.id), '|' ORDER BY f.id,r.id)
      FROM "ClinicalClarificationForm" f LEFT JOIN "ClinicalClarificationResponse" r ON r."formId"=f.id
      LEFT JOIN "ClinicalClarificationResolution" x ON x."formId"=f.id WHERE f."userId"=${userId})
    ,(SELECT string_agg(concat_ws(':',id,status,"respondedAt"), '|' ORDER BY id) FROM "ClinicalProfileProposal" WHERE "userId"=${userId})
    ,(SELECT key FROM "ClinicalProfileReviewEpoch" WHERE "userId"=${userId})`
    : Prisma.empty;
  const [row] = await prisma.$queryRaw<{ revision: string }[]>(Prisma.sql`
    SELECT md5(concat_ws('|',
      (SELECT "updatedAt" FROM "User" WHERE id=${userId}),
      (SELECT concat_ws(':',revision,"safetyRevision","updatedAt") FROM "UserProfile" WHERE "userId"=${userId}),
      (SELECT string_agg(concat_ws(':',id,"updatedAt"), '|' ORDER BY id) FROM "SafetyProfileEntry" WHERE "userId"=${userId}),
      (SELECT string_agg(concat_ws(':',id,revision,"updatedAt"), '|' ORDER BY id) FROM "ClinicalContextResponse" WHERE "userId"=${userId}),
      (SELECT string_agg(concat_ws(':',id,revision,status,"updatedAt","validUntil"), '|' ORDER BY id) FROM "ClinicalDocument" WHERE "userId"=${userId}),
      (SELECT string_agg(concat_ws(':',id,"updatedAt"), '|' ORDER BY id) FROM "ClinicalFact" WHERE "userId"=${userId}),
      (SELECT string_agg(concat_ws(':',id,status,"claimedAt","claimedByNutritionistId","reviewedAt"), '|' ORDER BY id) FROM "ClinicalProfileReview" WHERE "userId"=${userId}),
      (SELECT concat_ws(':',version,"isStale","acknowledgedAt","generatedAt") FROM "NutritionReport" WHERE "userId"=${userId}),
      (SELECT string_agg(concat_ws(':',id,version,"acknowledgedAt"), '|' ORDER BY id) FROM "NutritionReportVersion" WHERE "userId"=${userId})
      ${clarification}
    )) AS revision`);
  return row.revision;
}

async function mealRevision(mealId: string) {
  const [row] = await prisma.$queryRaw<{ revision: string }[]>`
    SELECT md5(concat_ws('|', to_jsonb(m)::text,
      (SELECT jsonb_agg(jsonb_build_array(to_jsonb(i), to_jsonb(f)) ORDER BY i.id)::text
        FROM "MealIngredient" i LEFT JOIN "FoodItem" f ON f.id=i."foodItemId" WHERE i."mealPlanId"=m.id),
      (SELECT jsonb_agg(jsonb_build_array(to_jsonb(c), to_jsonb(f)) ORDER BY c.id)::text
        FROM "MealPlanServingComponent" c LEFT JOIN "FoodItem" f ON f.id=c."foodItemId" WHERE c."mealPlanId"=m.id),
      (SELECT to_jsonb(c)::text FROM "MealPlanCycle" c WHERE c.id=m."planGroupId"),
      (SELECT to_jsonb(s)::text FROM "MealPlanCycleSnapshot" s WHERE s."planGroupId"=m."planGroupId"),
      (SELECT to_jsonb(l)::text FROM "MealLibrary" l WHERE l.id=m."libraryMealId"),
      (SELECT to_jsonb(r)::text FROM "RawRecipeCandidate" r WHERE r.id=m."sourceRawRecipeCandidateId")
    )) AS revision FROM "MealPlan" m WHERE m.id=${mealId}`;
  return row.revision;
}

function status(
  revision: string,
  claim: { claimedAt: Date | null; claimedByNutritionistId: string | null },
  reviewerId: string
) {
  const active = isReviewClaimActive(claim);
  const claimState = !active ? 'AVAILABLE' : claim.claimedByNutritionistId === reviewerId ? 'OWNED' : 'OTHER';
  return {
    available: true,
    revision: createHash('sha256')
      .update(JSON.stringify([revision, claimState, claim.claimedAt]))
      .digest('hex'),
    claim: { state: claimState, claimedAt: claim.claimedAt },
  };
}

export class ReviewStatusService {
  static async meal(reviewerId: string, mealId: string) {
    await ReviewRoutingService.assertMeal(reviewerId, mealId);
    const meal = await prisma.mealPlan.findFirst({
      where: { id: mealId, ...getNutritionistReviewableMealPlanWhere() },
      select: { id: true, userId: true, claimedAt: true, claimedByNutritionistId: true },
    });
    if (!meal) throw new AppError('This meal is no longer awaiting review.', 409, 'MEAL_REVIEW_INACTIVE');
    await Promise.all([
      ClinicalProfileReviewService.assertReadyForMealPlanning(meal.userId),
      ClinicalEvidenceService.assertReadyForMealPlanning(meal.userId),
    ]);
    const [member, plate] = await Promise.all([memberRevision(meal.userId), mealRevision(meal.id)]);
    return status(`${member}:${plate}`, meal, reviewerId);
  }
  static async profile(reviewerId: string, userId: string) {
    await NutritionistProfileWorkService.assertQueued(userId, reviewerId);
    const claim = await prisma.clinicalProfileReview.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { claimedAt: true, claimedByNutritionistId: true },
    });
    return status(
      await memberRevision(userId),
      claim ?? { claimedAt: null, claimedByNutritionistId: null },
      reviewerId
    );
  }
}
