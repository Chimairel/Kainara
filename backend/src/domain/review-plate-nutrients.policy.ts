import { MEAL_EXTENDED_NUTRIENTS } from './meal-nutrient-completion.policy';
import { plateNutrients, type PlateNutrients } from './review-nutrient-filter.policy';
import { scalePublishedAmount } from './source-serving-adjustment.policy';

type Macros = { calories: number; proteinG: number; carbsG: number; fatG: number };
type Extended = Partial<Pick<PlateNutrients, (typeof MEAL_EXTENDED_NUTRIENTS)[number]>>;
const macros = ['calories', 'proteinG', 'carbsG', 'fatG'] as const;
const measured = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function publishedExtendedNutrients(value: unknown): Extended {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(MEAL_EXTENDED_NUTRIENTS.map(key => [key, measured(record[key]) ? record[key] : null]));
}
export function scaledExtendedNutrients(value: unknown, scale: number): Extended {
  return Object.fromEntries(Object.entries(publishedExtendedNutrients(value)).map(([key, amount]) =>
    [key, amount == null || !measured(scale) || scale <= 0 ? null : scalePublishedAmount(amount, scale)]));
}
type Ingredient = { ingredientName: string; quantity?: number | null; unit?: string | null };
type Side = Macros & { quantityG: number | null; foodItem: {
  sodium: number | null; sugar: number | null; fiber: number | null; potassium: number | null;
  phosphorus: number | null; saturatedFat: number | null;
} | null };
const normalized = (value: string) => value.normalize('NFKC').trim().toLowerCase();
const sameIngredients = (saved: Ingredient[], source: unknown, scale: number) => {
  if (!Array.isArray(source)) return false;
  const original = source.filter(item => item && typeof item === 'object' && item.excludedFromPlanning !== true);
  const identity = (name: string, quantity: number | null | undefined, unit: string | null | undefined) =>
    JSON.stringify([normalized(name), quantity == null ? null : scalePublishedAmount(quantity, 1), normalized(unit ?? '')]);
  const wanted = original.map(item => {
    if (typeof item.name !== 'string') return '';
    const unit = typeof item.unit === 'string' && item.unit.trim() ? item.unit : null;
    const amount = unit && measured(item.quantity) && item.quantity > 0 ? scalePublishedAmount(item.quantity, scale) : null;
    return identity(item.name, amount, unit);
  }).sort();
  const actual = saved.map(item => identity(item.ingredientName, item.quantity, item.unit)).sort();
  return wanted.length > 0 && wanted.length === actual.length && wanted.every((item, index) => item === actual[index]);
};

/** Pending-review presentation only. Never change a saved macro or infer missing source values. */
export function recordedReviewPlateNutrients(plan: Macros & {
  mealName: string; baseRecipeSignature: string | null; ingredients: Ingredient[]; servingComponents: Side[];
  libraryMeal?: (Macros & Extended & { recipeSignature: string | null }) | null;
  sourceRawRecipeCandidate?: (Partial<Record<keyof Macros, number | null>> & { recipeName: string; ingredients: unknown; publishedNutrition: unknown }) | null;
}): PlateNutrients {
  const base = Object.fromEntries(macros.map(key => [key, plan[key] - plan.servingComponents.reduce((sum, side) => sum + side[key], 0)])) as Macros;
  let extra: Extended = {};
  if (plan.libraryMeal && plan.baseRecipeSignature && plan.libraryMeal.recipeSignature === plan.baseRecipeSignature &&
      macros.every(key => Math.abs(plan.libraryMeal![key] - base[key]) <= 0.011)) {
    extra = publishedExtendedNutrients(plan.libraryMeal);
  } else if (!plan.libraryMeal && plan.sourceRawRecipeCandidate) {
    const source = plan.sourceRawRecipeCandidate;
    const scale = measured(source.calories) && source.calories > 0 ? Math.round(base.calories / source.calories * 1000) / 1000 : 0;
    if (scale >= 0.5 && scale <= 2 && normalized(plan.mealName) === normalized(source.recipeName) &&
        macros.every(key => measured(source[key]) && Math.abs(scalePublishedAmount(source[key]!, scale) - base[key]) <= 0.011) &&
        sameIngredients(plan.ingredients, source.ingredients, scale)) {
      extra = scaledExtendedNutrients(source.publishedNutrition, scale);
    }
  }
  let nutrients = plateNutrients({ ...base, ...extra }, null, null);
  for (const side of plan.servingComponents) {
    const food = side.foodItem;
    if (!measured(side.quantityG) || side.quantityG <= 0) {
      nutrients = plateNutrients({}, null, null);
      break;
    }
    nutrients = plateNutrients(nutrients, food ? {
      sodiumMg: food.sodium, sugarG: food.sugar, fiberG: food.fiber,
      potassiumMg: food.potassium, phosphorusMg: food.phosphorus, saturatedFatG: food.saturatedFat,
    } : null, side.quantityG);
  }
  return { ...nutrients, ...Object.fromEntries(macros.map(key => [key, plan[key]])) } as PlateNutrients;
}
