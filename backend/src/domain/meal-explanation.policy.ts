export interface MealSelectionEvidence {
  schemaVersion: 1;
  source: 'VERIFIED_LIBRARY' | 'RAW_RECIPE_CORPUS' | 'AI_GENERATED';
  dailyCalorieTarget: number;
  slotCalorieTarget: number | null;
  slotCalorieLower: number | null;
  slotCalorieUpper: number | null;
  planningLocationLabel: string;
  consumptionEvidenceScope: string | null;
  consumptionEvidenceRelease: string | null;
  rankingScore?: number | null;
  rankingReasonCodes?: string[];
  servingScale?: number;
  dataAdjustment?: 'CODEX_PUBLISHED_SERVING_SCALE_V1';
  capturedAt: string;
}

export interface MealExplanation {
  source: 'VERIFIED_LIBRARY' | 'RAW_RECIPE_CORPUS' | 'AI_GENERATED' | 'LEGACY_UNKNOWN';
  reviewState: 'NUTRITIONIST_VERIFIED' | 'APPROVED' | 'PENDING_REVIEW';
  nutritionEvidence: 'ALL_FNRI' | 'ALL_USDA' | 'SOURCE_RECIPE' | 'MIXED' | 'ESTIMATED' | 'UNAVAILABLE';
  calorieFit: 'WITHIN_TARGET' | 'OUTSIDE_TARGET' | 'UNAVAILABLE';
  bullets: string[];
  limitation?: string;
}

interface MealExplanationInput {
  libraryMealId?: string | null;
  status: string;
  aiConfidenceFlag: string;
  calories: number;
  verifierName?: string | null;
  candidateProvenance?: string | null;
  ingredients?: Array<{
    dataSource?: string | null;
    foodItemId?: string | null;
    foodItem?: { source: string } | null;
  }>;
  selectionEvidence?: unknown;
}

function isSelectionEvidence(value: unknown): value is MealSelectionEvidence {
  if (!value || typeof value !== 'object') return false;
  const evidence = value as Partial<MealSelectionEvidence>;
  return (
    evidence.schemaVersion === 1 &&
    (evidence.source === 'VERIFIED_LIBRARY' ||
      evidence.source === 'RAW_RECIPE_CORPUS' ||
      evidence.source === 'AI_GENERATED') &&
    (evidence.slotCalorieLower === null || typeof evidence.slotCalorieLower === 'number') &&
    (evidence.slotCalorieUpper === null || typeof evidence.slotCalorieUpper === 'number')
  );
}

export function buildMealExplanation(input: MealExplanationInput): MealExplanation {
  const evidence = isSelectionEvidence(input.selectionEvidence) ? input.selectionEvidence : null;
  const ingredients = input.ingredients ?? [];
  const linkedSource = (ingredient: (typeof ingredients)[number]) =>
    ingredient.foodItemId
      ? (ingredient.foodItem?.source ??
        (['FNRI', 'USDA_FDC'].includes(ingredient.dataSource ?? '') ? ingredient.dataSource : null))
      : null;
  const fnriCount = ingredients.filter((ingredient) => linkedSource(ingredient) === 'FNRI').length;
  const usdaCount = ingredients.filter((ingredient) => linkedSource(ingredient) === 'USDA_FDC').length;
  const linkedCount = ingredients.filter((ingredient) => Boolean(ingredient.foodItemId)).length;
  const sourceCount = ingredients.filter((ingredient) => ingredient.dataSource === 'SOURCE_RECIPE').length;
  const estimatedCount = ingredients.filter((ingredient) => ingredient.dataSource === 'GEMINI_ESTIMATED').length;
  const nutritionEvidence =
    ingredients.length === 0
      ? 'UNAVAILABLE'
      : sourceCount === ingredients.length
        ? 'SOURCE_RECIPE'
        : ingredients.every((ingredient) => ingredient.dataSource === 'FNRI' && linkedSource(ingredient) === 'FNRI')
          ? 'ALL_FNRI'
          : ingredients.every(
                (ingredient) => ingredient.dataSource === 'USDA_FDC' && linkedSource(ingredient) === 'USDA_FDC'
              )
            ? 'ALL_USDA'
            : estimatedCount === ingredients.length
              ? 'ESTIMATED'
              : sourceCount || estimatedCount || linkedCount
                ? 'MIXED'
                : 'UNAVAILABLE';
  const source =
    evidence?.source ??
    (input.candidateProvenance === 'RAW_RECIPE_CORPUS'
      ? 'RAW_RECIPE_CORPUS'
      : input.libraryMealId
        ? 'VERIFIED_LIBRARY'
        : 'LEGACY_UNKNOWN');
  const reviewState =
    input.status !== 'APPROVED' ? 'PENDING_REVIEW' : input.verifierName ? 'NUTRITIONIST_VERIFIED' : 'APPROVED';
  const calorieFit =
    evidence && evidence.slotCalorieLower !== null && evidence.slotCalorieUpper !== null
      ? input.calories >= evidence.slotCalorieLower && input.calories <= evidence.slotCalorieUpper
        ? 'WITHIN_TARGET'
        : 'OUTSIDE_TARGET'
      : 'UNAVAILABLE';
  const bullets: string[] = [];

  if (source === 'VERIFIED_LIBRARY') bullets.push('Selected from the meal library.');
  else if (source === 'RAW_RECIPE_CORPUS')
    bullets.push('Selected from the recipe catalogue. Recipe origin and nutritionist review are separate.');
  else if (source === 'AI_GENERATED')
    bullets.push('Generated for this plan slot from your saved nutrition and meal-planning preferences.');
  else bullets.push('Exact selection-source evidence was not recorded for this meal.');

  if (evidence && evidence.slotCalorieLower !== null && evidence.slotCalorieUpper !== null) {
    bullets.push(
      `${Math.round(input.calories)} kcal is ${calorieFit === 'WITHIN_TARGET' ? 'within' : 'outside'} this slot's ${Math.round(evidence.slotCalorieLower)}–${Math.round(evidence.slotCalorieUpper)} kcal planning range.`
    );
  }
  const rankingLabels: Record<string, string> = {
    DIET_MATCH: 'dietary preference',
    MEAL_TYPE_MATCH: 'meal time',
    RICE_PREFERENCE_MATCH: 'rice preference',
    VARIETY_PREFERRED: 'meal variety',
  };
  const rankingReasons = evidence?.rankingReasonCodes?.flatMap((reason) =>
    rankingLabels[reason] ? [rankingLabels[reason]] : []
  );
  if (rankingReasons?.length) bullets.push(`Selection considered your ${rankingReasons.join(', ')}.`);
  if (evidence?.dataAdjustment === 'CODEX_PUBLISHED_SERVING_SCALE_V1' && evidence.servingScale) {
    bullets.push(
      `This plan uses ${evidence.servingScale}× the recorded recipe serving. Ingredient amounts and nutrition totals reflect this portion.`
    );
  }

  if (sourceCount)
    bullets.push(
      'Dish nutrition retains recorded recipe values rather than a complete FNRI/USDA ingredient calculation. Any added rice is calculated separately.'
    );
  if (nutritionEvidence === 'ALL_FNRI')
    bullets.push('Ingredient nutrition is recorded from FNRI food-composition data.');
  else if (nutritionEvidence === 'ALL_USDA')
    bullets.push('Ingredient nutrition is recorded from USDA FoodData Central fallback data.');
  if (fnriCount || usdaCount) {
    const links = [fnriCount ? `${fnriCount} FNRI` : null, usdaCount ? `${usdaCount} USDA` : null].filter(Boolean);
    bullets.push(
      `Saved ingredient links: ${links.join(' and ')} out of ${ingredients.length} ingredients. Links identify foods; they do not by themselves verify the meal totals.`
    );
  } else if (linkedCount)
    bullets.push(
      `${linkedCount} of ${ingredients.length} ingredients have saved food-composition links; their source is not recorded here.`
    );
  if (ingredients.length && linkedCount < ingredients.length)
    bullets.push(
      `${ingredients.length - linkedCount} of ${ingredients.length} ingredients have no saved food-composition link.`
    );
  if (estimatedCount) bullets.push(`${estimatedCount} of ${ingredients.length} ingredients use estimated nutrition.`);
  if (nutritionEvidence === 'UNAVAILABLE') bullets.push('Ingredient-level nutrition provenance is unavailable.');

  if (reviewState === 'NUTRITIONIST_VERIFIED') bullets.push(`Reviewed by ${input.verifierName}.`);
  else if (reviewState === 'PENDING_REVIEW')
    bullets.push(`Professional review is still pending; automated safety flag: ${input.aiConfidenceFlag}.`);
  else
    bullets.push('Ready to use under the current planning policy. No nutritionist review is recorded for this meal.');

  return {
    source,
    reviewState,
    nutritionEvidence,
    calorieFit,
    bullets,
    ...(evidence ? {} : { limitation: 'Exact meal-selection evidence is unavailable for this legacy meal.' }),
  };
}
