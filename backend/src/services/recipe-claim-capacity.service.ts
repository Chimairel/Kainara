import type { Prisma, MealVerificationTargetKind } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { getReviewClaimCutoff } from '@/domain/nutritionist-review.policy';

/** One active recipe review across new and flagged recipes, including concurrent tabs. */
export async function assertRecipeClaimCapacity(
  tx: Prisma.TransactionClient,
  reviewerId: string,
  target: { kind: MealVerificationTargetKind | 'FLAGGED_RECIPE'; id: string },
) {
  await tx.$queryRaw`SELECT id FROM "NutritionistProfile" WHERE id = ${reviewerId} FOR UPDATE`;
  const claimedAt = { gte: getReviewClaimCutoff(new Date()) };
  const base = await tx.mealBaseVerification.findFirst({
    where: { claimedByNutritionistId: reviewerId, claimedAt, status: { in: ['PENDING', 'REJECTED'] },
      ...(target.kind !== 'FLAGGED_RECIPE' ? { NOT: { targetKind: target.kind, targetId: target.id } } : {}) },
    select: { id: true },
  });
  const incident = await tx.mealReviewIncident.findFirst({
    where: { claimedByNutritionistId: reviewerId, claimedAt, closedAt: null, state: 'PENDING_REREVIEW',
      ...(target.kind === 'FLAGGED_RECIPE' ? { lineage: { meals: { none: { id: target.id } } } } : {}) },
    select: { id: true },
  });
  if (base || incident) throw new AppError('Finish your claimed recipe review first.', 409, 'REVIEW_CLAIM_LIMIT');
}
