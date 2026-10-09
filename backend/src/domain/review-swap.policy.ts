import { createHash } from 'node:crypto';
import { AppError } from '@/errors/AppError';
import { getReviewClaimCutoff } from './nutritionist-review.policy';

/** A selected replacement awaits an explicit decision, even after its claim expires. */
export function requiresExplicitReplacementReview(plan: { status: string; selectionEvidence: unknown }) {
  const evidence = plan.selectionEvidence;
  return (
    plan.status === 'PENDING_REVIEW' &&
    Boolean(
      evidence &&
      typeof evidence === 'object' &&
      !Array.isArray(evidence) &&
      'fallbackReasonCode' in evidence &&
      evidence.fallbackReasonCode === 'RND_SELECTED_REPLACEMENT'
    )
  );
}

export function reviewSwapVersion(
  plan: {
    id: string;
    status: string;
    mealName: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    libraryMealId: string | null;
    baseRecipeSignature: string | null;
    composedServingSignature: string | null;
    supersededByMealPlanId: string | null;
  },
  profile: { revision: number; safetyRevision: number }
) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        plan.id,
        plan.status,
        plan.mealName,
        plan.calories,
        plan.proteinG,
        plan.carbsG,
        plan.fatG,
        plan.libraryMealId,
        plan.baseRecipeSignature,
        plan.composedServingSignature,
        plan.supersededByMealPlanId,
        profile.revision,
        profile.safetyRevision,
      ])
    )
    .digest('hex');
}

export function assertReviewSwapClaim(
  plan: {
    status: string;
    claimedByNutritionistId: string | null;
    claimedAt: Date | null;
    supersededByMealPlanId: string | null;
  },
  profileId: string,
  now = new Date()
) {
  if (
    plan.status !== 'PENDING_REVIEW' ||
    plan.supersededByMealPlanId ||
    plan.claimedByNutritionistId !== profileId ||
    !plan.claimedAt ||
    plan.claimedAt < getReviewClaimCutoff(now)
  )
    throw new AppError('Hold an active claim on this pending meal before swapping.', 409, 'REVIEW_CLAIM_REQUIRED');
}
