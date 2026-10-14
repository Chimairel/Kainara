import type { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { getReviewClaimCutoff } from '@/domain/nutritionist-review.policy';
import { getNutritionistReviewableMealPlanWhere } from '@/domain/meal-actionability.policy';

/** Serialize claims from separate tabs before checking one active case per RND. */
export async function assertCaseClaimCapacity(tx: Prisma.TransactionClient, reviewerId: string, planId: string, now = new Date()) {
  await tx.$queryRaw`SELECT id FROM "NutritionistProfile" WHERE id = ${reviewerId} FOR UPDATE`;
  const existing = await tx.mealPlan.findFirst({
    where: { ...getNutritionistReviewableMealPlanWhere(now), id: { not: planId },
      claimedByNutritionistId: reviewerId, claimedAt: { gte: getReviewClaimCutoff(now) } },
    select: { id: true },
  });
  if (existing) throw new AppError('Finish your claimed review before claiming another case.', 409, 'REVIEW_CLAIM_LIMIT');
}
