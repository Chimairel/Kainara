import { AssuranceTier, DietaryPreference, MealType, type RicePreference } from '@prisma/client';
import {
  getMealSlotCalorieRange,
  isPrimaryMealType,
  type PrimaryMealType,
} from '@/domain/meal-calorie-allocation.policy';
import { splitCustomRestrictions, validateGeneratedMealCandidate } from '@/domain/generated-meal-validation.policy';
import { getMaximumAssuranceTier } from '@/domain/assurance-tier.policy';
import { scorePreparationCandidate, type PreparationRankingReasonCode } from '@/domain/upcoming-preparation.policy';
import { databaseRecipeCandidateProvider } from './panlasang-recipe-candidate.provider';
import type { RecipeCandidateProjection } from './recipe-candidate-provider';
import { SOURCE_SERVING_MAX_SCALE, SOURCE_SERVING_MIN_SCALE } from '@/domain/source-serving-adjustment.policy';
import { rawRecipeServing } from './raw-recipe-serving.service';
import type { SwapRiceFood } from './meal-swap-serving.service';
import {
  mealMacroBudget,
  nutritionFitScore,
  type PlanningMacroTargets,
  type NutritionVector,
} from '@/domain/meal-macro-target.policy';

export interface RawCandidateSlot {
  dayNumber: number;
  mealType: MealType;
  scheduledDate: Date;
}

export interface SourcedRawRecipeMeal {
  dayNumber: number;
  mealType: MealType;
  rawCandidateId: string;
  mealName: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: Array<{ foodItemId: string | null; name: string; quantity?: number; unit?: string }>;
  candidateRank: number;
  rankingScore: number;
  rankingReasonCodes: PreparationRankingReasonCode[];
  servingScale: number;
  pairedRiceG?: number | null;
}

type RankedCandidate = RecipeCandidateProjection & {
  _original?: RecipeCandidateProjection;
  _ranking: ReturnType<typeof scorePreparationCandidate>;
  servingScale?: number;
  pairedRiceG?: number | null;
};

type MacroSelectionInput = {
  planningTargets?: PlanningMacroTargets | null;
  existingNutrition?: readonly (NutritionVector & { dayNumber: number; mealType: string })[];
  dailyCalorieTarget?: number;
  ricePreference?: RicePreference;
  riceFood?: SwapRiceFood | null;
};

function macroPool(
  input: MacroSelectionInput,
  slot: RawCandidateSlot,
  pool: readonly RankedCandidate[],
  selected: readonly SourcedRawRecipeMeal[]
) {
  if (!input.planningTargets) return [...pool];
  const whole = (meal: SourcedRawRecipeMeal) => ({
    ...meal,
    calories: meal.calories + ((input.riceFood?.calories ?? 0) * (meal.pairedRiceG ?? 0)) / 100,
    proteinG: meal.proteinG + ((input.riceFood?.proteinG ?? 0) * (meal.pairedRiceG ?? 0)) / 100,
    carbsG: meal.carbsG + ((input.riceFood?.carbsG ?? 0) * (meal.pairedRiceG ?? 0)) / 100,
    fatG: meal.fatG + ((input.riceFood?.fatG ?? 0) * (meal.pairedRiceG ?? 0)) / 100,
  });
  const other = [...(input.existingNutrition ?? []), ...selected.map(whole)].filter(
    (m) => m.dayNumber === slot.dayNumber
  );
  const budget = mealMacroBudget(input.planningTargets, slot.mealType, other);
  if (!budget) return [...pool];
  const score = (candidate: RankedCandidate) => {
    const n = candidate.nutrition!;
    const g = candidate.pairedRiceG ?? 0;
    const r = input.riceFood;
    return nutritionFitScore(
      {
        calories: n.calories + ((r?.calories ?? 0) * g) / 100,
        proteinG: n.proteinG + ((r?.proteinG ?? 0) * g) / 100,
        carbsG: n.carbsG + ((r?.carbsG ?? 0) * g) / 100,
        fatG: n.fatG + ((r?.fatG ?? 0) * g) / 100,
      },
      budget
    );
  };
  return pool
    .flatMap((candidate) => {
      if (!candidate._original) return [candidate];
      const plate = rawRecipeServing({
        candidate: candidate._original,
        mealType: slot.mealType,
        dailyCalorieTarget: input.dailyCalorieTarget ?? input.planningTargets!.calories,
        ricePreference: input.ricePreference,
        riceFood: input.riceFood,
        macroTarget: budget,
      });
      return plate ? [{ ...candidate, ...plate }] : [];
    })
    .sort((a, b) => score(a) - score(b) || b._ranking.score - a._ranking.score || a.id.localeCompare(b.id));
}

function sourceServingDescription(candidate: RankedCandidate): string {
  const description = candidate.description ?? 'Existing recipe from the broader recipe corpus.';
  return candidate.servingScale && candidate.servingScale !== 1
    ? `${description} Serving size: ${candidate.servingScale}× the recorded recipe serving.`
    : description;
}

export function normalizeRawRecipeQuantity(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Corpus origin supplies a recipe, never a clinical clearance. */
export function selectRawRecipeCandidates(
  input: MacroSelectionInput & {
    slots: readonly RawCandidateSlot[];
    candidatesByType: ReadonlyMap<MealType, readonly RankedCandidate[]>;
    dietaryPreference: DietaryPreference;
    allergens: readonly string[];
    otherAllergies?: string | null;
    reviewFreeBaseOnly?: boolean;
    recentCandidateIds?: readonly string[];
  }
): { meals: SourcedRawRecipeMeal[]; remainingSlots: RawCandidateSlot[] } {
  const meals: SourcedRawRecipeMeal[] = [];
  const usedIds = new Set<string>();
  const usedSignatures = new Set<string>();
  const remainingSlots: RawCandidateSlot[] = [];
  const customAllergies = splitCustomRestrictions(input.otherAllergies);
  const recentIds = new Set(input.recentCandidateIds ?? []);

  for (const slot of input.slots) {
    const candidates = macroPool(input, slot, input.candidatesByType.get(slot.mealType) ?? [], meals);
    const eligible = (candidate: RankedCandidate) => {
      if (usedIds.has(candidate.id) || usedSignatures.has(candidate.contentSignature)) return false;
      if (!candidate.applicableMealTypes.includes(slot.mealType)) return false;
      if (!candidate.dietaryTags.includes(input.dietaryPreference)) return false;
      if (!candidate.nutrition || candidate.ingredients.length === 0) return false;
      if (input.reviewFreeBaseOnly && !candidate.reviewFreeBaseEligible) return false;
      // Reject definite conflicts; unknown facts stay pending for RND review.
      return validateGeneratedMealCandidate({
        ingredients: candidate.ingredients,
        dietaryPreference: input.dietaryPreference,
        allergens: input.allergens,
        customAllergies,
      }).accepted;
    };
    const freshIndex = candidates.findIndex((candidate) => !recentIds.has(candidate.id) && eligible(candidate));
    const index = freshIndex >= 0 ? freshIndex : candidates.findIndex(eligible);
    if (index < 0) {
      remainingSlots.push(slot);
      continue;
    }
    const candidate = candidates[index];
    usedIds.add(candidate.id);
    usedSignatures.add(candidate.contentSignature);
    meals.push({
      dayNumber: slot.dayNumber,
      mealType: slot.mealType,
      rawCandidateId: candidate.id,
      mealName: candidate.displayName,
      description: sourceServingDescription(candidate),
      calories: candidate.nutrition!.calories,
      proteinG: candidate.nutrition!.proteinG,
      carbsG: candidate.nutrition!.carbsG,
      fatG: candidate.nutrition!.fatG,
      ingredients: candidate.ingredients.map((ingredient) => ({
        ...ingredient,
        foodItemId: ingredient.foodItemId ?? null,
      })),
      candidateRank: index + 1,
      rankingScore: candidate._ranking.score,
      rankingReasonCodes: candidate._ranking.reasonCodes,
      servingScale: candidate.servingScale ?? 1,
      pairedRiceG: candidate.pairedRiceG ?? null,
    });
  }
  return { meals, remainingSlots };
}

/** Fill only after all corpus pages have been checked for distinct recipes. */
export function fillRepeatedRawRecipeSlots(
  input: MacroSelectionInput & {
    slots: readonly RawCandidateSlot[];
    candidatesByType: ReadonlyMap<MealType, readonly RankedCandidate[]>;
    selected: readonly SourcedRawRecipeMeal[];
    dietaryPreference: DietaryPreference;
    allergens: readonly string[];
    otherAllergies?: string | null;
    reviewFreeBaseOnly?: boolean;
    recentCandidateIds?: readonly string[];
  }
): { meals: SourcedRawRecipeMeal[]; remainingSlots: RawCandidateSlot[] } {
  const meals: SourcedRawRecipeMeal[] = [];
  const remainingSlots: RawCandidateSlot[] = [];
  const counts = new Map<string, number>();
  for (const meal of input.selected) counts.set(meal.rawCandidateId, (counts.get(meal.rawCandidateId) ?? 0) + 1);
  const recent = new Set(input.recentCandidateIds ?? []);
  const customAllergies = splitCustomRestrictions(input.otherAllergies);
  const lastByType = new Map<MealType, string>();
  for (const meal of input.selected) lastByType.set(meal.mealType, meal.rawCandidateId);
  for (const slot of input.slots) {
    const pool = macroPool(input, slot, input.candidatesByType.get(slot.mealType) ?? [], [...input.selected, ...meals]);
    const eligible = pool
      .map((candidate, index) => ({ candidate, index }))
      .filter(
        ({ candidate }) =>
          candidate.applicableMealTypes.includes(slot.mealType) &&
          candidate.dietaryTags.includes(input.dietaryPreference) &&
          Boolean(candidate.nutrition && candidate.ingredients.length) &&
          (!input.reviewFreeBaseOnly || candidate.reviewFreeBaseEligible) &&
          validateGeneratedMealCandidate({
            ingredients: candidate.ingredients,
            dietaryPreference: input.dietaryPreference,
            allergens: input.allergens,
            customAllergies,
          }).accepted
      );
    eligible.sort(
      (a, b) =>
        (counts.get(a.candidate.id) ?? 0) - (counts.get(b.candidate.id) ?? 0) ||
        Number(lastByType.get(slot.mealType) === a.candidate.id) -
          Number(lastByType.get(slot.mealType) === b.candidate.id) ||
        Number(recent.has(a.candidate.id)) - Number(recent.has(b.candidate.id)) ||
        a.index - b.index
    );
    const chosen = eligible[0];
    if (!chosen) {
      remainingSlots.push(slot);
      continue;
    }
    const { candidate, index } = chosen;
    counts.set(candidate.id, (counts.get(candidate.id) ?? 0) + 1);
    lastByType.set(slot.mealType, candidate.id);
    meals.push({
      dayNumber: slot.dayNumber,
      mealType: slot.mealType,
      rawCandidateId: candidate.id,
      mealName: candidate.displayName,
      description: sourceServingDescription(candidate),
      calories: candidate.nutrition!.calories,
      proteinG: candidate.nutrition!.proteinG,
      carbsG: candidate.nutrition!.carbsG,
      fatG: candidate.nutrition!.fatG,
      ingredients: candidate.ingredients.map((ingredient) => ({
        ...ingredient,
        foodItemId: ingredient.foodItemId ?? null,
      })),
      candidateRank: index + 1,
      rankingScore: candidate._ranking.score,
      rankingReasonCodes: candidate._ranking.reasonCodes,
      servingScale: candidate.servingScale ?? 1,
      pairedRiceG: candidate.pairedRiceG ?? null,
    });
  }
  return { meals, remainingSlots };
}

export async function sourceRawRecipeCandidates(
  input: MacroSelectionInput & {
    slots: readonly RawCandidateSlot[];
    dailyCalorieTarget: number;
    dietaryPreference: DietaryPreference;
    conditions: readonly string[];
    allergens: readonly string[];
    otherConditions?: string | null;
    otherAllergies?: string | null;
    reviewFreeBaseOnly?: boolean;
    excludeCandidateIds?: readonly string[];
    ricePreference?: RicePreference;
    riceFood?: SwapRiceFood | null;
    recentCandidateIds?: readonly string[];
  }
): Promise<{ meals: SourcedRawRecipeMeal[]; remainingSlots: RawCandidateSlot[] }> {
  if (input.slots.length === 0) return { meals: [], remainingSlots: [] };
  const assuranceTier = getMaximumAssuranceTier(input.conditions);
  const mealTypes = [...new Set(input.slots.map((slot) => slot.mealType))];
  const sources = input.reviewFreeBaseOnly
    ? (['PANLASANG_PINOY'] as const)
    : (['PANLASANG_PINOY', 'USER_OBSERVED'] as const);
  const candidatePools = new Map<MealType, RankedCandidate[]>(mealTypes.map((mealType) => [mealType, []]));
  const nextCursor = new Map<string, string | null>();
  const pagesFetched = new Map<string, number>();
  const keyFor = (mealType: MealType, sourceKind: string) => `${mealType}:${sourceKind}`;
  const rank = (candidate: RecipeCandidateProjection, mealType: PrimaryMealType): RankedCandidate => {
    const range = getMealSlotCalorieRange(input.dailyCalorieTarget, mealType);
    const scaled = rawRecipeServing({
      candidate,
      mealType,
      dailyCalorieTarget: input.dailyCalorieTarget,
      ricePreference: input.ricePreference,
      riceFood: input.riceFood,
    })!;
    const ranking = scorePreparationCandidate({
      activeClearanceCoverage: false,
      allergenDeclarationsComplete: false,
      ingredientsResolved: scaled.ingredientsComplete,
      nutrientsComplete: scaled.nutrition !== null,
      dietCompatible: true,
      remainingReviews: assuranceTier === AssuranceTier.ENHANCED ? 2 : 1,
      calorieDeviationRatio: scaled.nutrition ? Math.abs(scaled.plateCalories - range.target) / range.target : 1,
      mealTypeMatch: candidate.applicableMealTypes.includes(mealType),
      riceRole: scaled.riceRole,
      ricePreference: input.ricePreference,
      riceRoleBasis: scaled.riceRole ? 'SAVED_CLASSIFICATION' : undefined,
      usedInRecentCycle: false,
    });
    return { ...scaled, _original: candidate, _ranking: ranking };
  };
  const sortPool = (mealType: MealType) =>
    candidatePools
      .get(mealType)
      ?.sort(
        (left, right) =>
          right._ranking.score - left._ranking.score ||
          left.displayName.localeCompare(right.displayName) ||
          left.id.localeCompare(right.id)
      );
  const loadPage = async (mealType: PrimaryMealType, sourceKind: (typeof sources)[number]) => {
    const key = keyFor(mealType, sourceKind);
    const range = getMealSlotCalorieRange(input.dailyCalorieTarget, mealType);
    const page = await databaseRecipeCandidateProvider.list({
      sourceKind,
      mealType,
      dietaryPreference: input.dietaryPreference,
      calorieMinimum:
        sourceKind === 'PANLASANG_PINOY'
          ? Math.max(0, range.minimum - ((input.riceFood?.calories ?? 0) * 225) / 100) / SOURCE_SERVING_MAX_SCALE
          : range.minimum,
      calorieMaximum: sourceKind === 'PANLASANG_PINOY' ? range.maximum / SOURCE_SERVING_MIN_SCALE : range.maximum,
      excludeIds: input.excludeCandidateIds,
      cursor: nextCursor.get(key) ?? undefined,
      limit: 120,
    });
    nextCursor.set(key, page.nextCursor);
    pagesFetched.set(key, (pagesFetched.get(key) ?? 0) + 1);
    candidatePools.get(mealType)?.push(
      ...page.items
        .filter(
          (candidate) =>
            candidate.dietaryTags.includes(input.dietaryPreference) &&
            rawRecipeServing({
              candidate,
              mealType,
              dailyCalorieTarget: input.dailyCalorieTarget,
              ricePreference: input.ricePreference,
              riceFood: input.riceFood,
            }) !== null
        )
        .map((candidate) => rank(candidate, mealType))
    );
    sortPool(mealType);
  };

  await Promise.all(
    mealTypes.flatMap((mealType) =>
      isPrimaryMealType(mealType) ? sources.map((sourceKind) => loadPage(mealType, sourceKind)) : []
    )
  );
  const select = () =>
    selectRawRecipeCandidates({
      ...input,
      slots: input.slots,
      candidatesByType: candidatePools,
      dietaryPreference: input.dietaryPreference,
      allergens: input.allergens,
      otherAllergies: input.otherAllergies,
      reviewFreeBaseOnly: input.reviewFreeBaseOnly,
      recentCandidateIds: input.recentCandidateIds,
    });
  let selected = select();
  // A bounded broader shortlist avoids selecting solely from the first alphabetical page.
  if (input.planningTargets) {
    for (let page = 1; page < 4; page++) {
      const requests = mealTypes.flatMap((mealType) =>
        isPrimaryMealType(mealType)
          ? sources
              .filter((source) => nextCursor.get(keyFor(mealType, source)))
              .map((source) => loadPage(mealType, source))
          : []
      );
      if (!requests.length) break;
      await Promise.all(requests);
    }
    selected = select();
  }
  // Read further bounded pages only when the first shortlist cannot fill a slot.
  // Current Panlasang corpus is under 2,000 records; twenty 120-row pages cover it.
  while (selected.remainingSlots.length > 0) {
    const remainingTypes = new Set(selected.remainingSlots.map((slot) => slot.mealType));
    const requests = [...remainingTypes].flatMap((mealType) =>
      isPrimaryMealType(mealType)
        ? sources
            .filter((sourceKind) => {
              const key = keyFor(mealType, sourceKind);
              return nextCursor.get(key) && (pagesFetched.get(key) ?? 0) < 20;
            })
            .map((sourceKind) => loadPage(mealType, sourceKind))
        : []
    );
    if (requests.length === 0) break;
    await Promise.all(requests);
    selected = select();
  }
  if (selected.remainingSlots.length === 0) return selected;
  const repeated = fillRepeatedRawRecipeSlots({
    ...input,
    slots: selected.remainingSlots,
    candidatesByType: candidatePools,
    selected: selected.meals,
  });
  return {
    meals: [...selected.meals, ...repeated.meals].sort(
      (a, b) =>
        a.dayNumber - b.dayNumber ||
        Object.values(MealType).indexOf(a.mealType) - Object.values(MealType).indexOf(b.mealType)
    ),
    remainingSlots: repeated.remainingSlots,
  };
}
