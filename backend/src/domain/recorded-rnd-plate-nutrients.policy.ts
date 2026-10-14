import { MEAL_EXTENDED_NUTRIENTS } from './meal-nutrient-completion.policy';
import { reviewSourceNutrients } from './review-nutrient-estimate.policy';
import { recordedReviewPlateEstimates, recordedReviewPlateNutrients } from './review-plate-nutrients.policy';

type Plan = Parameters<typeof recordedReviewPlateNutrients>[0];
type ReviewPlan = Omit<Plan, 'servingComponents'> & {
  servingComponents: Array<Plan['servingComponents'][number] & { foodItem: (NonNullable<Plan['servingComponents'][number]['foodItem']> & {
    name?: string; calories?: number; proteinG?: number; carbsG?: number; fatG?: number; sourceNutrientEvidence?: unknown;
  }) | null }>;
};

/** RND presentation only: use current valid supplements without rewriting saved meal facts. */
export function recordedRndPlateNutrients(plan: ReviewPlan) {
  const original = recordedReviewPlateNutrients(plan);
  const source = plan.sourceRawRecipeCandidate;
  const enriched = {
    ...plan,
    sourceRawRecipeCandidate: source ? {
      ...source,
      publishedNutrition: reviewSourceNutrients(source.publishedNutrition, {
        name: source.recipeName, ingredients: source.ingredients,
        calories: source.calories ?? null, proteinG: source.proteinG ?? null,
        carbsG: source.carbsG ?? null, fatG: source.fatG ?? null,
      }, true).values,
    } : source,
    servingComponents: plan.servingComponents.map(side => {
      const food = side.foodItem;
      if (!food || !food.name) return side;
      const evidence = food.sourceNutrientEvidence as Record<string, unknown> | null;
      const values = reviewSourceNutrients({
        sodiumMg: food.sodium, sugarG: food.sugar, fiberG: food.fiber,
        potassiumMg: food.potassium, phosphorusMg: food.phosphorus, saturatedFatG: food.saturatedFat,
        extendedNutritionEstimates: evidence?.reviewNutrientEstimates,
      }, {
        name: food.name, ingredients: [], calories: food.calories ?? null,
        proteinG: food.proteinG ?? null, carbsG: food.carbsG ?? null, fatG: food.fatG ?? null,
      }, true).values;
      return { ...side, foodItem: { ...food,
        sodium: values.sodiumMg ?? food.sodium, sugar: values.sugarG ?? food.sugar, fiber: values.fiberG ?? food.fiber,
        potassium: values.potassiumMg ?? food.potassium, phosphorus: values.phosphorusMg ?? food.phosphorus,
        saturatedFat: values.saturatedFatG ?? food.saturatedFat,
      }};
    }),
  };
  const nutrients = recordedReviewPlateNutrients(enriched);
  const estimatedNutrientKeys = [...new Set([
    ...recordedReviewPlateEstimates(plan).keys,
    ...MEAL_EXTENDED_NUTRIENTS.filter(key => original[key] == null && nutrients[key] != null),
  ])];
  return { nutrients, estimatedNutrientKeys };
}
