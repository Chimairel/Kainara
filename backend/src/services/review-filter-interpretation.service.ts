import prisma from '@/lib/prisma';
import { generateGenerativeJSON } from '@/lib/gemini';
import { assertReviewSwapClaim } from '@/domain/review-swap.policy';
import { acceptedReviewFilterInterpretation, reviewFilterInterpretationSchema, REVIEW_FILTER_SYSTEM_INSTRUCTION } from '@/domain/review-filter-interpretation.policy';
import { ReviewRoutingService } from './review-routing.service';
import { assertCurrentMealReviewContext } from './meal-case-context.service';

export async function interpretReviewSwapFilter(profileId: string, mealPlanId: string, text: string, expectedContextKey?: string) {
  await ReviewRoutingService.assertMeal(profileId, mealPlanId);
  await assertCurrentMealReviewContext(mealPlanId, expectedContextKey);
  assertReviewSwapClaim(await prisma.mealPlan.findUniqueOrThrow({ where: { id: mealPlanId } }), profileId);
  // Send only the RND's search expression, never the member's clinical records.
  const parsed = await generateGenerativeJSON(JSON.stringify({ search: text }), REVIEW_FILTER_SYSTEM_INSTRUCTION,
    reviewFilterInterpretationSchema, { operation: 'OTHER', purpose: 'RND_SWAP_NUTRIENT_FILTER' });
  const filters = acceptedReviewFilterInterpretation(parsed);
  await assertCurrentMealReviewContext(mealPlanId, expectedContextKey);
  assertReviewSwapClaim(await prisma.mealPlan.findUniqueOrThrow({ where: { id: mealPlanId } }), profileId);
  return { filters };
}
