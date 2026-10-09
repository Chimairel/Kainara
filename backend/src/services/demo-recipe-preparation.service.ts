import { createHash } from 'node:crypto';
import type { FoodItem, RawRecipeCandidate } from '@prisma/client';
import { normalizeFoodName } from '../domain/fnri-match.policy';
import {
  createSourceIngredientFnriMatcher,
  normalizeSourceIngredientName,
} from '../domain/source-ingredient-fnri-match.policy';
import {
  DEMO_PREPARATION_VERSION,
  prepareDemoMeasurement,
  demoPortionGrams,
  type DemoIngredientInput,
  type SourcePortion,
} from '../domain/demo-recipe-measurement.policy';
import { calculateLibraryNutritionEvidence } from './nutritionist-library-nutrition-evidence.service';

// Explicit food/preparation choices for a demonstration recipe, not verified equivalences.
const equivalents: Record<string, string> = {
  'cooking oil': 'Oil, canola',
  'vegetable oil': 'Oil, canola',
  water: 'Water, tap',
  'ground black pepper': 'Spices, pepper, black',
  peppercorn: 'Spices, pepper, black',
  'whole peppercorn': 'Spices, pepper, black',
  'whole peppercorns': 'Spices, pepper, black',
  'dried bay leaves': 'Spices, bay leaf',
  'bay leaves': 'Spices, bay leaf',
  'chicken broth': 'Soup, stock, chicken, home-prepared',
  'beef broth': 'Soup, beef broth or bouillon canned, ready-to-serve',
  salt: 'Salt, table',
  'sea salt': 'Salt, table',
  'coarse sea salt': 'Salt, table',
  'white vinegar': 'Vinegar, distilled',
  'onion powder': 'Spices, onion powder',
  paprika: 'Spices, paprika',
  'ground pork': 'Pork, fresh, ground, raw',
  'ground beef': 'Beef, ground, 85% lean meat / 15% fat, raw',
  'extra virgin olive oil': 'Oil, olive, salad or cooking',
  'vegetable broth': 'Soup, vegetable broth',
  'lemon juice': 'Lemon juice, raw',
  'dried oregano': 'Spices, oregano, dried',
  'baking soda': 'Leavening agents, baking soda',
};
const portionBridges: Record<string, string> = {
  'garlic bulb': 'Garlic, raw',
  'onion bulb': 'Onions, raw',
  'onion bombay bulb': 'Onions, raw',
  onion: 'Onions, raw',
  'egg chicken whole': 'Egg, whole, raw, fresh',
  'sugar white refined': 'Sugars, granulated',
  cornstarch: 'Cornstarch',
  carrot: 'Carrots, raw',
  tomato: 'Tomatoes, red, ripe, raw, year round average',
  'soy sauce': 'Soy sauce made from soy and wheat (shoyu)',
  'fish sauce': 'Sauce, fish, ready-to-serve',
  'olive oil': 'Oil, olive, salad or cooking',
  'coconut milk': 'Nuts, coconut milk, raw (liquid expressed from grated meat and water)',
  eggplant: 'Eggplant, raw',
  salt: 'Salt, table',
  'sugar brown': 'Sugars, brown',
};
export interface HouseholdFood {
  fdcId: number;
  name: string;
  portions: SourcePortion[];
}

export function createDemoRecipePreparer(foods: readonly FoodItem[], household: readonly HouseholdFood[]) {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const fnri = createSourceIngredientFnriMatcher(foods.filter((f) => f.source === 'FNRI'));
  const usda = new Map<string, FoodItem[]>();
  for (const f of foods.filter((f) => f.source === 'USDA_FDC'))
    usda.set(normalizeFoodName(f.name), [...(usda.get(normalizeFoodName(f.name)) ?? []), f]);
  const portions = new Map(household.map((f) => [String(f.fdcId), f]));
  const portionsByName = new Map<string, HouseholdFood>();
  for (const h of household)
    if (!portionsByName.has(normalizeFoodName(h.name))) portionsByName.set(normalizeFoodName(h.name), h);
  const matchCache = new Map<string, FoodItem | null>();
  function exactUsda(name: string) {
    const matches = usda.get(normalizeFoodName(name));
    return matches?.length === 1 ? matches[0] : null;
  }
  return (row: RawRecipeCandidate) => {
    const original = Array.isArray(row.ingredients)
      ? (row.ingredients.filter(
          (i) => i && typeof i === 'object' && !Array.isArray(i) && i.excludedFromPlanning !== true
        ) as unknown as DemoIngredientInput[])
      : [];
    const prepared = original.flatMap((input, index) => {
      if (typeof input.name !== 'string') throw new Error('Malformed source ingredient.');
      return prepareDemoMeasurement(input, row.originalServings ?? 0).map((measure) => {
        const normalized = normalizeSourceIngredientName(measure.name);
        const recorded = !/salt.*and.*pepper/iu.test(input.name) && input.foodItemId && byId.get(input.foodItemId);
        if (!matchCache.has(normalized))
          matchCache.set(normalized, fnri.match(measure.name)?.food || exactUsda(normalized));
        const match = recorded || matchCache.get(normalized);
        const substitute = !match && equivalents[normalized] ? exactUsda(equivalents[normalized]) : null;
        const food = match || substitute || null;
        const house = food
          ? portions.get(food.sourceRecordId ?? '') ||
            portionsByName.get(normalizeFoodName(portionBridges[normalizeFoodName(food.name)] ?? food.name))
          : null;
        const mass = demoPortionGrams(measure.quantity, measure.unit, house?.portions ?? [], measure.name);
        const assumptions = [
          ...measure.assumptions,
          ...(substitute ? ['DEMO_COMPOSITION_SUBSTITUTE'] : []),
          ...(mass?.assumed ? ['DEMO_HOUSEHOLD_PORTION'] : []),
        ];
        return {
          name: measure.name,
          quantity: measure.quantity,
          unit: measure.unit,
          foodItemId: food?.id ?? null,
          foodName: food?.name ?? null,
          gramsPerServing: mass?.grams ?? null,
          originalIndex: index,
          original: {
            name: input.name,
            quantity: input.quantity ?? null,
            unit: input.unit ?? null,
            foodItemId: input.foodItemId ?? null,
          },
          compositionRevision: food?.compositionRevision ?? null,
          assumptions,
          conversion: mass ? { ...mass, fdcId: house?.fdcId ?? null } : null,
        };
      });
    });
    const missingMappings = prepared.filter((i) => !i.foodItemId).map((i) => i.name);
    const missingAmounts = prepared.filter((i) => !i.gramsPerServing).map((i) => i.name);
    const nutrition =
      prepared.length && !missingMappings.length && !missingAmounts.length
        ? calculateLibraryNutritionEvidence(
            prepared.map((i) => ({ foodItemId: i.foodItemId!, gramsPerServing: i.gramsPerServing! })),
            prepared.map((i) => byId.get(i.foodItemId!)!)
          )
        : null;
    const missingNutrients = nutrition
      ? Object.entries(nutrition)
          .filter(([, v]) => v === null)
          .map(([k]) => k)
      : [];
    const signature = createHash('sha256')
      .update(
        JSON.stringify({
          version: DEMO_PREPARATION_VERSION,
          sourceId: row.id,
          sourceSignature: row.contentSignature,
          prepared,
          nutrition,
        })
      )
      .digest('hex');
    return {
      version: DEMO_PREPARATION_VERSION,
      sourceId: row.id,
      sourceSignature: row.contentSignature,
      sourceUrl: row.sourceUrl,
      preparationBasis: 'ALL_LISTED_EDIBLE_INGREDIENTS_RETAINED_NO_COOKING_RETENTION_OR_OIL_LOSS_MODEL',
      clinicalCertification: false,
      estimated: true,
      signature,
      prepared,
      nutrition,
      missingMappings,
      missingAmounts,
      missingNutrients,
      complete: prepared.length > 0 && !!nutrition && !missingNutrients.length,
    };
  };
}
