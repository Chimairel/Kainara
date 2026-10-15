import { matchesReviewMealSearch } from '@/domain/review-meal-search.policy';
import jwt from 'jsonwebtoken';
import { createHmac } from 'node:crypto';
import { Prisma, type FoodItem } from '@prisma/client';
import prisma from '@/lib/prisma';
import { env } from '@/config/env';
import { AppError } from '@/errors/AppError';
import {
  plateNutrients,
  evaluateNutrientFilters,
  replacementServingKey,
  type ReviewNutrientFilters,
} from '@/domain/review-nutrient-filter.policy';
import { resolveReplacementServing } from './meal-swap-serving.service';
import { type CertifiedLibraryMeal, queryEligibleLibraryPage } from './meal-library-candidate-query.service';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { rejectedSlotRecipes } from './rejected-slot-recipes.service';
import { reviewSourceNutrients } from '@/domain/review-nutrient-estimate.policy';

export type ReplacementSearchSummary = {
  schemaVersion: 1;
  mealPlanId: string;
  reviewerProfileId: string;
  contextKey: string;
  filters: ReviewNutrientFilters;
  search?: string;
  matchedCount: number;
  unknownExcludedCount: number;
  searchedAt: string;
  scope: 'CURRENT_ELIGIBLE_CERTIFIED_LIBRARY' | 'RND_PENDING_REPLACEMENT_CANDIDATES';
};
const audience = 'rnd-replacement-search';
const receiptSecret = () => {
  if (!env.JWT_SECRET) throw new Error('Replacement search requires the configured signing secret.');
  return createHmac('sha256', env.JWT_SECRET).update(audience).digest('hex');
};
export function signReplacementSearch(summary: ReplacementSearchSummary) {
  return jwt.sign(summary, receiptSecret(), { algorithm: 'HS256', audience, expiresIn: '30m' });
}
export function readReplacementSearch(
  receipt: string,
  profileId: string,
  mealPlanId: string,
  contextKey?: string
): ReplacementSearchSummary {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED)
    throw new AppError('Replacement outcomes are not enabled.', 409, 'REVIEW_FILTERS_DISABLED');
  try {
    const saved = jwt.verify(receipt, receiptSecret(), { algorithms: ['HS256'], audience }) as ReplacementSearchSummary;
    if (
      saved.schemaVersion !== 1 ||
      saved.reviewerProfileId !== profileId ||
      saved.mealPlanId !== mealPlanId ||
      saved.contextKey !== contextKey
    )
      throw new Error('Search belongs to a different review context.');
    return {
      schemaVersion: 1,
      mealPlanId: saved.mealPlanId,
      reviewerProfileId: saved.reviewerProfileId,
      contextKey: saved.contextKey,
      filters: saved.filters,
      ...(saved.search ? { search: saved.search } : {}),
      matchedCount: saved.matchedCount,
      unknownExcludedCount: saved.unknownExcludedCount,
      searchedAt: saved.searchedAt,
      scope: saved.scope,
    };
  } catch {
    throw new AppError('Refresh the replacement search before recording this outcome.', 409, 'REVIEW_SEARCH_CHANGED');
  }
}
export async function loadReviewRice(client: Prisma.TransactionClient = prisma, includeEstimates=false): Promise<(FoodItem & {estimatedNutrientKeys?: import('@/domain/review-nutrient-filter.policy').ReviewNutrient[]}) | null> {
  const rice = await client.foodItem.findFirst({
    where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
    orderBy: { id: 'asc' },
  });
  if (!rice || !includeEstimates) return rice;
  const evidence = rice.sourceNutrientEvidence as Record<string, unknown> | null;
  const review = reviewSourceNutrients(
    {
      sodiumMg: rice.sodium,
      sugarG: rice.sugar,
      fiberG: rice.fiber,
      potassiumMg: rice.potassium,
      phosphorusMg: rice.phosphorus,
      saturatedFatG: rice.saturatedFat,
      extendedNutritionEstimates: evidence?.reviewNutrientEstimates,
    },
    { ...rice, ingredients: [] },
    true
  );
  return {
    ...rice,
    potassium: review.values.potassiumMg ?? rice.potassium,
    phosphorus: review.values.phosphorusMg ?? rice.phosphorus,
    sugar: review.values.sugarG ?? rice.sugar,
    sodium: review.values.sodiumMg ?? rice.sodium,
    fiber: review.values.fiberG ?? rice.fiber,
    saturatedFat: review.values.saturatedFatG ?? rice.saturatedFat,
    estimatedNutrientKeys: review.estimatedKeys,
  };
}
export function reviewReplacementPlate(
  meal: CertifiedLibraryMeal,
  plan: { mealType: CertifiedLibraryMeal['mealType'] },
  snapshot: {
    dailyCalorieTarget: number;
    ricePreference: Parameters<typeof resolveReplacementServing>[0]['ricePreference'];
  },
  rice: Awaited<ReturnType<typeof loadReviewRice>>,
  hasConditions: boolean
) {
  const serving = resolveReplacementServing({
    meal,
    mealType: plan.mealType,
    dailyTarget: snapshot.dailyCalorieTarget,
    ricePreference: snapshot.ricePreference,
    riceFood: rice,
    hasConditions,
    allowPendingCaseReview: true,
  });
  if (!serving) return null;
  const nutrients = plateNutrients(
    meal,
    rice
      ? {
          ...rice,
          sodiumMg: rice.sodium,
          sugarG: rice.sugar,
          fiberG: rice.fiber,
          potassiumMg: rice.potassium,
          phosphorusMg: rice.phosphorus,
          saturatedFatG: rice.saturatedFat,
        }
      : null,
    serving.pairedRiceG
  );
  return {
    ...serving,
    nutrients,
    riceFoodId: serving.pairedRiceG ? rice!.id : null,
    servingKey: replacementServingKey({
      recipeSignature: meal.recipeSignature,
      evidenceRevision: meal.safetyEvidenceRevision,
      nutrients,
      riceFoodId: serving.pairedRiceG ? rice!.id : null,
      riceRevision: serving.pairedRiceG ? rice!.compositionRevision : null,
      pairedRiceG: serving.pairedRiceG,
    }),
  };
}
/** Full catalog scan applies the same admission policies as the member library; filters do not confer clinical clearance. */
export async function searchReviewReplacements(input: {
  plan: {
    id: string;
    userId: string;
    mealType: CertifiedLibraryMeal['mealType'];
    libraryMealId: string | null;
    planGroupId: string;
    scheduledDate: Date;
    baseRecipeSignature: string | null;
    sourceRawRecipeCandidateId: string | null;
  };
  snapshot: {
    dailyCalorieTarget: number;
    ricePreference: Parameters<typeof resolveReplacementServing>[0]['ricePreference'];
  };
  context: Awaited<ReturnType<typeof loadPlanningNutritionContext>>;
  filters: ReviewNutrientFilters;
  cursor?: string;
  search?: string;
}) {
  const { plan, context, snapshot, filters } = input;
  const rejected = await rejectedSlotRecipes(prisma, plan),
    rice = await loadReviewRice();
  let unknownExcludedCount = 0;
  const plateFor = (meal: CertifiedLibraryMeal) =>
    reviewReplacementPlate(
      meal,
      plan,
      snapshot,
      rice,
      context.conditions.some((value) => value !== 'NONE')
    );
  const page = await queryEligibleLibraryPage({
    userId: plan.userId,
    mealType: plan.mealType,
    userConditions: context.conditions,
    userAllergens: context.allergens,
    profile: { ...context.profile, userId: plan.userId, safetyEntries: context.user.safetyProfileEntries },
    includeProfileApproved: true,
    includeUnapprovedCaseCandidates: true,
    limit: 60,
    cursor: input.cursor,
    accept: (meal) => {
      if (!matchesReviewMealSearch(input.search, meal.mealName, meal.ingredients.map(item => item.ingredientName))) return false;
      if (
        meal.id === plan.libraryMealId ||
        rejected.includes({
          libraryMealId: meal.id,
          sourceRawRecipeCandidateId: meal.sourceRawRecipeCandidateId,
          baseRecipeSignature: meal.recipeSignature,
        })
      )
        return false;
      const plate = plateFor(meal);
      if (!plate) return false;
      const result = evaluateNutrientFilters(plate.nutrients, filters);
      if (result.unknown.length) unknownExcludedCount++;
      return result.matches;
    },
  });
  return { ...page, unknownExcludedCount, items: page.items.map((meal) => ({ meal, plate: plateFor(meal)! })) };
}
