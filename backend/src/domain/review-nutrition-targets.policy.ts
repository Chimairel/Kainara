import { allocatedReviewRanges } from './review-meal-planning.policy';
import { mealMacroBudget, MEAL_MACRO_POLICY_VERSION, type PlanningMacroTargets } from './meal-macro-target.policy';
import { resolveConditionRuleThreshold, type ConditionRuleLike } from './condition-rule-evaluation.policy';

const nutrientKeys = {
  SODIUM_MG: 'sodiumMg', SUGAR_G: 'sugarG', FIBER_G: 'fiberG', POTASSIUM_MG: 'potassiumMg',
  PHOSPHORUS_MG: 'phosphorusMg', SATURATED_FAT_G: 'saturatedFatG', PROTEIN_G: 'proteinG', CARBOHYDRATE_G: 'carbsG',
} as const;
type TargetRule = ConditionRuleLike & {
  condition: string; sourceTitle: string;
  evidenceSource: { state: string; canonicalUrl: string } | null;
  patientSpecific?: boolean;
  sourceCitation?: string;
};

/** Display references only: never changes eligibility or invents a personal nutrient limit. */
export function reviewNutritionTargets(input: {
  dailyTargets: PlanningMacroTargets | null | undefined;
  mealType: string;
  bodyWeightKg?: number | null;
  rules: readonly TargetRule[];
  referenceItems?: unknown;
}) {
  const daily = input.dailyTargets?.policyVersion === MEAL_MACRO_POLICY_VERSION &&
    [input.dailyTargets.calories, input.dailyTargets.proteinG, input.dailyTargets.carbsG, input.dailyTargets.fatG]
      .every(value => Number.isFinite(value) && value >= 0) ? input.dailyTargets : null;
  const guidance = (Array.isArray(input.referenceItems) ? input.referenceItems : []).flatMap((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const nutrient = ({ 'Protein reference': 'proteinG', 'Fat reference': 'fatG', 'Carbohydrate reference': 'carbsG',
      'Sodium reference for DASH': 'sodiumMg', 'Dietary fiber reference': 'fiberG',
      'Saturated fat guidance': 'saturatedFatG' } as Record<string, string>)[String(item.heading)];
    if (!nutrient || !['value', 'explanation', 'sourceTitle', 'sourceUrl'].every(key => typeof item[key] === 'string')) return [];
    return [{ nutrient, value: item.value as string, explanation: item.explanation as string,
      sourceTitle: item.sourceTitle as string, sourceUrl: item.sourceUrl as string }];
  });
  return {
    daily,
    meal: mealMacroBudget(daily, input.mealType) ?? null,
    guidance,
    ...allocatedReviewRanges(guidance, input.mealType, daily?.calories),
    rules: input.rules.flatMap(rule => {
      const nutrient = nutrientKeys[rule.nutrient as keyof typeof nutrientKeys];
      if (!nutrient || !rule.active || rule.reviewStatus !== 'APPROVED' || !rule.approvedByNutritionistId ||
        (rule.evidenceSource?.state !== 'CURRENT' && !rule.patientSpecific)) return [];
      const threshold = resolveConditionRuleThreshold(rule, {
        dailyTotals: daily ? { calories: daily.calories } : undefined, bodyWeightKg: input.bodyWeightKg,
      });
      if (threshold.result === null || !Number.isFinite(threshold.result) || threshold.result < 0) return [];
      return [{
        nutrient, value: threshold.result, operator: rule.operator, unit: threshold.resultUnit,
        basis: rule.basis === 'PER_SERVING' ? 'MEAL' as const : 'DAY' as const,
        condition: rule.condition, sourceTitle: rule.sourceTitle, sourceUrl: rule.evidenceSource?.canonicalUrl ?? rule.sourceCitation ?? '',
      }];
    }),
  };
}
