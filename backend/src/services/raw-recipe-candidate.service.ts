import { AssuranceTier, DietaryPreference, MealType } from '@prisma/client';
import {
  getMealSlotCalorieRange,
  isPrimaryMealType,
  type PrimaryMealType,
} from '@/domain/meal-calorie-allocation.policy';
import { classifyIngredientIntoEnnsFoodGroup, type EnnsFoodGroupCode } from '@/domain/enns-food-group.policy';
import { splitCustomRestrictions, validateGeneratedMealCandidate } from '@/domain/generated-meal-validation.policy';
import { getMaximumAssuranceTier } from '@/domain/assurance-tier.policy';
import { scorePreparationCandidate, type PreparationRankingReasonCode } from '@/domain/upcoming-preparation.policy';
import { databaseRecipeCandidateProvider } from './panlasang-recipe-candidate.provider';
import type { RecipeCandidateProjection } from './recipe-candidate-provider';

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
}

type RankedCandidate = RecipeCandidateProjection & {
  _ranking: ReturnType<typeof scorePreparationCandidate>;
};

export function normalizeRawRecipeQuantity(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function candidateLocalityScore(
  candidate: RecipeCandidateProjection,
  scores: ReadonlyMap<EnnsFoodGroupCode, number>
): number {
  const groups = new Set<EnnsFoodGroupCode>();
  for (const ingredient of candidate.ingredients) {
    const group = classifyIngredientIntoEnnsFoodGroup({ name: ingredient.name });
    if (group) groups.add(group);
  }
  return [...groups].reduce((total, group) => total + (scores.get(group) ?? 0), 0);
}

/** Corpus origin supplies a recipe, never a clinical clearance. */
export function selectRawRecipeCandidates(input: {
  slots: readonly RawCandidateSlot[];
  candidatesByType: ReadonlyMap<MealType, readonly RankedCandidate[]>;
  dietaryPreference: DietaryPreference;
  allergens: readonly string[];
  otherAllergies?: string | null;
  reviewFreeBaseOnly?: boolean;
  recentCandidateIds?: readonly string[];
}): { meals: SourcedRawRecipeMeal[]; remainingSlots: RawCandidateSlot[] } {
  const meals: SourcedRawRecipeMeal[] = [];
  const usedIds = new Set<string>();
  const usedSignatures = new Set<string>();
  const remainingSlots: RawCandidateSlot[] = [];
  const customAllergies = splitCustomRestrictions(input.otherAllergies);
  const recentIds = new Set(input.recentCandidateIds ?? []);

  for (const slot of input.slots) {
    const candidates = input.candidatesByType.get(slot.mealType) ?? [];
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
      description: candidate.description ?? 'Existing recipe from the broader recipe corpus.',
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
    });
  }
  return { meals, remainingSlots };
}

/** Fill only after all corpus pages have been checked for distinct recipes. */
export function fillRepeatedRawRecipeSlots(input: {
  slots: readonly RawCandidateSlot[];
  candidatesByType: ReadonlyMap<MealType, readonly RankedCandidate[]>;
  selected: readonly SourcedRawRecipeMeal[];
  dietaryPreference: DietaryPreference;
  allergens: readonly string[];
  otherAllergies?: string | null;
  reviewFreeBaseOnly?: boolean;
  recentCandidateIds?: readonly string[];
}): { meals: SourcedRawRecipeMeal[]; remainingSlots: RawCandidateSlot[] } {
  const meals: SourcedRawRecipeMeal[] = [];
  const remainingSlots: RawCandidateSlot[] = [];
  const counts = new Map<string, number>();
  for (const meal of input.selected) counts.set(meal.rawCandidateId, (counts.get(meal.rawCandidateId) ?? 0) + 1);
  const recent = new Set(input.recentCandidateIds ?? []);
  const customAllergies = splitCustomRestrictions(input.otherAllergies);
  const lastByType = new Map<MealType, string>();
  for (const meal of input.selected) lastByType.set(meal.mealType, meal.rawCandidateId);
  for (const slot of input.slots) {
    const pool = input.candidatesByType.get(slot.mealType) ?? [];
    const eligible = pool.map((candidate, index) => ({ candidate, index })).filter(({ candidate }) =>
      candidate.applicableMealTypes.includes(slot.mealType) &&
      candidate.dietaryTags.includes(input.dietaryPreference) &&
      Boolean(candidate.nutrition && candidate.ingredients.length) &&
      (!input.reviewFreeBaseOnly || candidate.reviewFreeBaseEligible) &&
      validateGeneratedMealCandidate({ ingredients: candidate.ingredients,
        dietaryPreference: input.dietaryPreference, allergens: input.allergens,
        customAllergies }).accepted
    );
    eligible.sort((a, b) =>
      (counts.get(a.candidate.id) ?? 0) - (counts.get(b.candidate.id) ?? 0) ||
      Number(lastByType.get(slot.mealType) === a.candidate.id) - Number(lastByType.get(slot.mealType) === b.candidate.id) ||
      Number(recent.has(a.candidate.id)) - Number(recent.has(b.candidate.id)) ||
      a.index - b.index
    );
    const chosen = eligible[0];
    if (!chosen) { remainingSlots.push(slot); continue; }
    const { candidate, index } = chosen;
    counts.set(candidate.id, (counts.get(candidate.id) ?? 0) + 1);
    lastByType.set(slot.mealType, candidate.id);
    meals.push({ dayNumber: slot.dayNumber, mealType: slot.mealType, rawCandidateId: candidate.id,
      mealName: candidate.displayName, description: candidate.description ?? 'Existing recipe from the broader recipe corpus.',
      calories: candidate.nutrition!.calories, proteinG: candidate.nutrition!.proteinG,
      carbsG: candidate.nutrition!.carbsG, fatG: candidate.nutrition!.fatG,
      ingredients: candidate.ingredients.map((ingredient) => ({ ...ingredient, foodItemId: ingredient.foodItemId ?? null })),
      candidateRank: index + 1, rankingScore: candidate._ranking.score,
      rankingReasonCodes: candidate._ranking.reasonCodes });
  }
  return { meals, remainingSlots };
}

export async function sourceRawRecipeCandidates(input: {
  slots: readonly RawCandidateSlot[];
  dailyCalorieTarget: number;
  dietaryPreference: DietaryPreference;
  conditions: readonly string[];
  allergens: readonly string[];
  otherConditions?: string | null;
  otherAllergies?: string | null;
  reviewFreeBaseOnly?: boolean;
  excludeCandidateIds?: readonly string[];
  localityFoodGroupScores?: ReadonlyMap<EnnsFoodGroupCode, number>;
  localityEvidenceText?: string;
  recentCandidateIds?: readonly string[];
}): Promise<{ meals: SourcedRawRecipeMeal[]; remainingSlots: RawCandidateSlot[] }> {
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
    const ranking = scorePreparationCandidate({
      activeClearanceCoverage: false,
      allergenDeclarationsComplete: false,
      ingredientsResolved: candidate.ingredientsComplete,
      nutrientsComplete: candidate.nutrition !== null,
      dietCompatible: true,
      remainingReviews: assuranceTier === AssuranceTier.ENHANCED ? 2 : 1,
      calorieDeviationRatio: candidate.nutrition
        ? Math.abs(candidate.nutrition.calories - range.target) / range.target
        : 1,
      mealTypeMatch: candidate.applicableMealTypes.includes(mealType),
      riceRole: candidate.riceRole,
      localityScore: candidateLocalityScore(
        candidate,
        input.localityFoodGroupScores ?? new Map<EnnsFoodGroupCode, number>()
      ),
      usedInRecentCycle: false,
    });
    return { ...candidate, _ranking: ranking };
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
      calorieMinimum: range.minimum,
      calorieMaximum: range.maximum,
      excludeIds: input.excludeCandidateIds,
      cursor: nextCursor.get(key) ?? undefined,
      limit: 120,
    });
    nextCursor.set(key, page.nextCursor);
    pagesFetched.set(key, (pagesFetched.get(key) ?? 0) + 1);
    candidatePools
      .get(mealType)
      ?.push(
        ...page.items
          .filter((candidate) => candidate.dietaryTags.includes(input.dietaryPreference))
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
      slots: input.slots,
      candidatesByType: candidatePools,
      dietaryPreference: input.dietaryPreference,
      allergens: input.allergens,
      otherAllergies: input.otherAllergies,
      reviewFreeBaseOnly: input.reviewFreeBaseOnly,
      recentCandidateIds: input.recentCandidateIds,
    });
  let selected = select();
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
  const repeated = fillRepeatedRawRecipeSlots({ ...input, slots: selected.remainingSlots,
    candidatesByType: candidatePools, selected: selected.meals });
  return { meals: [...selected.meals, ...repeated.meals].sort((a, b) =>
    a.dayNumber - b.dayNumber || Object.values(MealType).indexOf(a.mealType) - Object.values(MealType).indexOf(b.mealType)),
    remainingSlots: repeated.remainingSlots };
}
