import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRecipeRiceRole } from '../src/domain/recipe-rice-role.policy';
import { resolveReplacementServing } from '../src/services/meal-swap-serving.service';
import type { CertifiedLibraryMeal } from '../src/services/meal-library-candidate-query.service';

const dish = {
  mealName: 'Chicken adobo',
  riceRole: null,
  riceRoleReviewStatus: 'NOT_REVIEWED',
  includedRiceG: null,
  riceMinHalfCups: 1,
  riceMaxHalfCups: 3,
  recipeSignature: 'a'.repeat(64),
  calories: 300,
  proteinG: 30,
  carbsG: 10,
  fatG: 15,
  ingredients: [{ ingredientName: 'Chicken', quantity: 150, unit: 'g', foodItem: { name: 'Chicken breast, cooked' } }],
} as unknown as CertifiedLibraryMeal;
const rice = {
  id: 'rice',
  name: 'Rice, well-milled, boiled',
  source: 'FNRI',
  compositionRevision: 1,
  calories: 130,
  proteinG: 2.5,
  carbsG: 28,
  fatG: 0.3,
};
const input = {
  meal: dish,
  mealType: 'BREAKFAST' as const,
  dailyTarget: 1650,
  ricePreference: 'WITH_RICE' as const,
  hasConditions: false,
  riceFood: rice,
};

test('a verified legacy dish fits with a rice side without changing its recipe or review', () => {
  const plate = resolveReplacementServing(input)!;
  assert.equal(plate.pairedRiceG, 150);
  assert.equal(plate.calories, 495);
  assert.equal(plate.carbsG, 52);
  assert.equal(dish.calories, 300);
  assert.equal(dish.riceRole, null);
  assert.equal(dish.riceRoleReviewStatus, 'NOT_REVIEWED');
  assert.equal(resolveRecipeRiceRole(dish).basis, 'INGREDIENT_CLASSIFICATION');
});
test('included rice is recognized from ingredients and never gets a second side', () => {
  const meal = {
    ...dish,
    calories: 495,
    ingredients: [
      ...dish.ingredients,
      { ...dish.ingredients[0], ingredientName: 'Rice', quantity: 150, foodItem: { name: rice.name, category: null } },
    ],
  };
  assert.equal(resolveRecipeRiceRole(meal).riceRole, 'INCLUDES_RICE');
  assert.equal(resolveRecipeRiceRole(meal).includedRiceG, 150);
  assert.equal(resolveReplacementServing({ ...input, meal })!.pairedRiceG, null);
  assert.equal(
    resolveReplacementServing({
      ...input,
      meal: {
        ...meal,
        riceRole: 'PAIR_WITH_RICE',
        riceRoleReviewStatus: 'REVIEWED',
      },
    })!.pairedRiceG,
    null
  );
  assert.equal(resolveReplacementServing({ ...input, meal, ricePreference: 'NO_RICE' }), null);
});
test('standalone food and rice derivatives do not become included-rice plates', () => {
  const meal = {
    ...dish,
    mealName: 'Rice noodle salad',
    ingredients: [
      {
        ...dish.ingredients[0],
        ingredientName: 'Rice noodle',
        foodItem: { name: 'Rice noodles, cooked', category: null },
      },
    ],
  };
  assert.equal(resolveRecipeRiceRole(meal).riceRole, 'STANDALONE');
  assert.equal(resolveReplacementServing({ ...input, meal }), null);
});
test('reviewed roles and limits override inference; base case clearance cannot approve new rice', () => {
  assert.equal(
    resolveReplacementServing({
      ...input,
      meal: { ...dish, riceRole: 'STANDALONE', riceRoleReviewStatus: 'REVIEWED' },
    }),
    null
  );
  assert.equal(
    resolveReplacementServing({
      ...input,
      meal: {
        ...dish,
        riceRole: 'PAIR_WITH_RICE',
        riceRoleReviewStatus: 'REVIEWED',
        riceMinHalfCups: 3,
        riceMaxHalfCups: 3,
      },
    }),
    null
  );
  assert.equal(resolveReplacementServing({ ...input, hasConditions: true }), null);
  const unchanged = resolveReplacementServing({
    ...input,
    meal: { ...dish, calories: 495 },
    ricePreference: 'EITHER',
    hasConditions: true,
    riceFood: null,
  });
  assert.equal(unchanged!.calories, 495);
  assert.equal(unchanged!.pairedRiceG, null);
  assert.equal(
    resolveReplacementServing({ ...input, hasConditions: true, allowPendingCaseReview: true })!.pairedRiceG,
    150
  );
});
