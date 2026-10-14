import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { screenFoodExclusions } from '@/domain/food-exclusion.policy';
import { validateGeneratedMealCandidate, splitCustomRestrictions } from '@/domain/generated-meal-validation.policy';
import {
  evaluateNutrientFilters,
  plateNutrients,
  replacementServingKey,
  type ReviewNutrientFilters,
} from '@/domain/review-nutrient-filter.policy';
import { toPublicRawRecipeImage } from '@/domain/meal-image.policy';
import { isMealWithinSlotCalorieRange } from '@/domain/meal-calorie-allocation.policy';
import { scaledExtendedNutrients } from '@/domain/review-plate-nutrients.policy';
import {
  databaseRecipeCandidateProvider,
  hydrateCandidateIngredientIdentities,
} from './panlasang-recipe-candidate.provider';
import type { RecipeCandidateProjection } from './recipe-candidate-provider';
import { rawRecipeServing } from './raw-recipe-serving.service';
import { loadReviewRice } from './review-replacement-search.service';
import { swapMacroContext } from './meal-macro-context.service';
import { prepareGeneratedMealIngredients } from './meal-generation-ingredient-preparation.service';
import { rejectedSlotRecipes } from './rejected-slot-recipes.service';

type Plan = Prisma.MealPlanGetPayload<{ include: { cycle: { include: { snapshot: true } } } }>;
type Context = Awaited<ReturnType<typeof loadPlanningNutritionContext>>;
export const REVIEW_SOURCE_PREFIX = 'review-source:';
const CURSOR_PREFIX = 'review-source-page:';
export const isReviewSourceCursor = (cursor?: string) => Boolean(cursor?.startsWith(CURSOR_PREFIX));

/** Rank and page the complete source pool; pagination never truncates the match count. */
export function pageReviewSourceCandidates<T extends { option: { id: string }; score: number; recent: boolean }>(
  candidates: T[],
  scope: string,
  cursor?: string,
  limit = 24
) {
  const ranked = [...candidates].sort(
    (a, b) => Number(a.recent) - Number(b.recent) || a.score - b.score || a.option.id.localeCompare(b.option.id)
  );
  let start = 0;
  if (cursor) {
    try {
      if (!isReviewSourceCursor(cursor)) throw new Error();
      const saved = JSON.parse(Buffer.from(cursor.slice(CURSOR_PREFIX.length), 'base64url').toString('utf8'));
      if (saved.scope !== scope || typeof saved.after !== 'string') throw new Error();
      const index = ranked.findIndex((candidate) => candidate.option.id === saved.after);
      if (index < 0) throw new Error();
      start = index + 1;
    } catch {
      throw new AppError('Replacement search changed. Refresh the options.', 409, 'REVIEW_SWAP_CHANGED');
    }
  }
  const items = ranked.slice(start, start + limit);
  const nextCursor =
    start + items.length < ranked.length && items.length
      ? CURSOR_PREFIX +
        Buffer.from(JSON.stringify({ scope, after: items[items.length - 1].option.id })).toString('base64url')
      : null;
  return { items, total: ranked.length, nextCursor };
}

/** Source evidence can be proposed to an RND; it never grants member clearance. */
export async function searchReviewSourceSwaps(
  plan: Plan,
  context: Context,
  filters: ReviewNutrientFilters,
  cursor?: string,
  candidateId?: string
) {
  const snapshot = plan.cycle.snapshot;
  if (!snapshot) throw new AppError('Planning snapshot unavailable.', 409, 'REVIEW_SWAP_UNAVAILABLE');
  const [rice, macros, rejected, held] = await Promise.all([
    loadReviewRice(prisma, true),
    swapMacroContext(prisma, plan.userId, plan, context.planningTargets),
    rejectedSlotRecipes(prisma, plan),
    prisma.mealReviewLineage.findMany({
      where: { state: { not: 'PUBLISHED' }, key: { startsWith: 'source:' } },
      select: { key: true },
    }),
  ]);
  const restrictions = adaptUserSafetyRestrictions({
    healthConditions: context.conditions,
    allergies: context.allergens,
    otherConditions: context.otherConditions,
    otherAllergies: context.otherAllergies,
    safetyEntries: context.user.safetyProfileEntries,
  });
  const validation = {
    dietaryPreference: context.profile.dietaryPreference || ('OMNIVORE' as const),
    allergens: context.allergens,
    customAllergies: splitCustomRestrictions(context.otherAllergies),
  };
  const excludedIds = [
    ...held.map((row) => row.key.slice('source:'.length)),
    ...(plan.sourceRawRecipeCandidateId ? [plan.sourceRawRecipeCandidateId] : []),
  ];
  const recentIds = new Set(
    macros.dayMeals.flatMap((meal) => (meal.sourceRawRecipeCandidateId ? [meal.sourceRawRecipeCandidateId] : []))
  );
  const plateFor = (candidate: Parameters<typeof rawRecipeServing>[0]['candidate']) =>
    rawRecipeServing({
      candidate,
      mealType: plan.mealType,
      dailyCalorieTarget: snapshot.dailyCalorieTarget,
      ricePreference: snapshot.ricePreference,
      riceFood: rice,
      macroTarget: macros.budget,
      scoreNutrition: macros.scoreReplacement,
    });
  const nutrientsFor = (plate: NonNullable<ReturnType<typeof rawRecipeServing>>) =>
    plateNutrients(
      { ...plate.extendedNutrients, ...plate.nutrition! },
      rice
        ? {
            ...rice,
            sugarG: rice.sugar,
            sodiumMg: rice.sodium,
            fiberG: rice.fiber,
            potassiumMg: rice.potassium,
            phosphorusMg: rice.phosphorus,
            saturatedFatG: rice.saturatedFat,
          }
        : null,
      plate.pairedRiceG
    );
  type Match = {
    option: ReturnType<typeof makeOption>;
    meal: Awaited<ReturnType<typeof prepareGeneratedMealIngredients>>['preparedMeals'][number];
    rice: typeof rice;
    compositionRevisions: Map<string, number>;
    sourceRevisionKey?: string;
    score: number;
    recent: boolean;
  };
  const matches: Match[] = [];
  let unknownExcludedCount = 0;
  const signatures = new Set<string>();
  function makeOption(plate: NonNullable<ReturnType<typeof rawRecipeServing>>, meal: Match['meal']) {
    const unchanged = (['calories', 'proteinG', 'carbsG', 'fatG'] as const).every(
      (key) => Math.abs(meal[key] - plate.nutrition![key]) <= 0.011
    );
    const nutrients = nutrientsFor({
      ...plate,
      nutrition: meal,
      extendedNutrients: unchanged
        ? plate.extendedNutrients
        : scaledExtendedNutrients(plate.estimatedExtendedNutrients, meal.calories / plate.nutrition!.calories),
    });
    return {
      id: REVIEW_SOURCE_PREFIX + plate.id,
      mealName: meal.mealName,
      mealType: meal.mealType,
      description: meal.description,
      mealTypes: plate.applicableMealTypes,
      riceRole: plate.riceRole,
      calories: nutrients.calories!,
      proteinG: nutrients.proteinG!,
      carbsG: nutrients.carbsG!,
      fatG: nutrients.fatG!,
      nutritionFitScore: macros.scoreReplacement({
        calories: nutrients.calories!,
        proteinG: nutrients.proteinG!,
        carbsG: nutrients.carbsG!,
        fatG: nutrients.fatG!,
      }),
      nutrients,
      nutritionBasis: plate.nutritionBasis,
      estimatedNutrientKeys: [
        ...new Set([
          ...(unchanged
            ? (plate.estimatedNutrientKeys ?? [])
            : Object.entries(plate.estimatedExtendedNutrients ?? {})
                .filter(([, value]) => typeof value === 'number')
                .map(([key]) => key as keyof typeof nutrients)),
          ...(plate.pairedRiceG ? (rice?.estimatedNutrientKeys ?? []) : []),
        ]),
      ],
      pairedRiceG: plate.pairedRiceG,
      recipeSignature: plate.contentSignature,
      evidenceRevision: 1,
      servingKey: replacementServingKey({
        recipeSignature: plate.contentSignature,
        evidenceRevision: 1,
        nutrients,
        riceFoodId: plate.pairedRiceG ? (rice?.id ?? null) : null,
        riceRevision: plate.pairedRiceG ? (rice?.compositionRevision ?? null) : null,
        pairedRiceG: plate.pairedRiceG,
      }),
      requiresReview: true,
      verifier: null,
      verifiedBy: 'Recorded source recipe · not case approved',
      prcLicenseNumber: '',
      image: toPublicRawRecipeImage({
        recipeName: plate.displayName,
        sourceName: plate.provenance,
        sourceUrl: plate.sourceUrl,
        sourceImageUrl: plate.imageUrl,
        sourceVideoUrl: plate.videoUrl,
      }),
      ingredients: [
        ...meal.ingredientsData.map((item) => ({
          name: item.ingredientName,
          quantity: item.quantity,
          unit: item.unit,
          source: item.dataSource,
        })),
        ...(plate.pairedRiceG
          ? [{ name: 'Rice, well-milled, boiled', quantity: plate.pairedRiceG, unit: 'g', source: 'FNRI' as const }]
          : []),
      ],
    };
  }
  // Read bounded chunks until exhausted, including candidates after the old four-page shortlist.
  const candidates: RecipeCandidateProjection[] = [];
  for (const sourceKind of ['PANLASANG_PINOY', 'USER_OBSERVED'] as const) {
    let sourceCursor: string | undefined;
    do {
      const page = await databaseRecipeCandidateProvider.list({
        sourceKind,
        mealType: plan.mealType,
        dietaryPreference: validation.dietaryPreference,
        excludeIds: excludedIds,
        limit: candidateId ? 120 : 600,
        cursor: sourceCursor,
        candidateId,
        hydrateIngredients: false,
        includeEstimatedNutrients: true,
        reviewPoolScan: !candidateId,
      });
      candidates.push(...page.items);
      sourceCursor = page.nextCursor ?? undefined;
    } while (sourceCursor);
  }
  await hydrateCandidateIngredientIdentities(candidates);
  const plates = candidates.flatMap((candidate) => {
    if (
      rejected.includes({
        sourceRawRecipeCandidateId: candidate.id,
        libraryMealId: null,
        baseRecipeSignature: candidate.contentSignature,
      })
    )
      return [];
    const exclusion = screenFoodExclusions(candidate.ingredients, restrictions.foodExclusions);
    if (
      !exclusion.complete ||
      exclusion.conflicts.length ||
      !validateGeneratedMealCandidate({ ...validation, ingredients: candidate.ingredients }).accepted
    )
      return [];
    const plate = plateFor(candidate);
    return plate ? [plate] : [];
  });
  if (plates.length) {
    // Batch food hydration, then filter the actual prepared nutrition used when saving.
    const prepared = await prepareGeneratedMealIngredients({
      meals: plates.map((plate) => ({
        dayNumber: 1,
        mealType: plan.mealType,
        mealName: plate.displayName,
        description: plate.description ?? 'Recorded source recipe.',
        ...plate.nutrition!,
        rawCandidateId: plate.id,
        ingredients: plate.ingredients.map((item) => ({ ...item, foodItemId: item.foodItemId ?? null })),
        servingScale: plate.servingScale,
        pairedRiceG: plate.pairedRiceG,
        candidateProvenance: 'RAW_RECIPE_CORPUS',
      })),
      unmatchedSlots: [{ dayNumber: 1, mealType: plan.mealType, scheduledDate: plan.scheduledDate }],
      startDate: plan.scheduledDate,
      userHasConditions: context.conditions.some((value) => value !== 'NONE'),
      groundedFoodById: new Map(),
    });
    for (let index = 0; index < prepared.preparedMeals.length; index++) {
      const meal = prepared.preparedMeals[index],
        plate = plates[index];
      if (
        !validateGeneratedMealCandidate({
          ...validation,
          ingredients: meal.ingredientsData.map((item, i) => ({
            name: item.ingredientName,
            category: item.category,
            compositionFoodName: plate.ingredients[i]?.compositionFoodName,
          })),
        }).accepted
      )
        continue;
      const option = makeOption(plate, meal);
      if (
        !isMealWithinSlotCalorieRange({
          calories: option.calories,
          mealType: plan.mealType,
          dailyCalorieTarget: snapshot.dailyCalorieTarget,
        })
      )
        continue;
      const result = evaluateNutrientFilters(option.nutrients, filters);
      if (result.unknown.length) unknownExcludedCount++;
      if (!result.matches || signatures.has(plate.contentSignature)) continue;
      signatures.add(plate.contentSignature);
      matches.push({
        option,
        meal,
        rice,
        compositionRevisions: prepared.compositionRevisions,
        sourceRevisionKey: plate.sourceRevisionKey,
        score: macros.scoreReplacement(option),
        recent: recentIds.has(plate.id),
      });
    }
  }
  const scope = createHash('sha256')
    .update(JSON.stringify([plan.id, context.profile.revision, context.profile.safetyRevision, snapshot.id, filters]))
    .digest('hex');
  return { ...pageReviewSourceCandidates(matches, scope, cursor), unknownExcludedCount };
}
