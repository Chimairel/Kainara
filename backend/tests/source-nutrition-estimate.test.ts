import assert from 'node:assert/strict';
import test from 'node:test';
import { allowDemoNutritionPlanning, estimateFromComparableRecipes,
  hasDemoNutritionEstimate } from '../src/domain/source-nutrition-estimate.policy';
import { isUnrestrictedPanlasangBaseEligible } from '../src/domain/unrestricted-panlasang-base.policy';

test('comparable-source estimates are deterministic and preserve their donor IDs', () => {
  const target = { id: 'missing', recipeName: 'Chicken adobo with potato', category: 'Chicken',
    mealType: 'LUNCH', ingredients: [{ name: 'chicken' }, { name: 'potato' }] };
  const donors = [
    { id: 'close', recipeName: 'Chicken adobo', category: 'Chicken', mealType: 'LUNCH',
      ingredients: [{ name: 'chicken' }, { name: 'soy sauce' }],
      nutrition: { calories: 500, proteinG: 40, carbsG: 30, fatG: 20 } },
    { id: 'far', recipeName: 'Blueberry pancake', category: 'Breakfast', mealType: 'BREAKFAST',
      ingredients: [{ name: 'flour' }],
      nutrition: { calories: 300, proteinG: 8, carbsG: 50, fatG: 8 } },
  ];
  const first = estimateFromComparableRecipes(target, donors);
  assert.deepEqual(first?.donorIds, ['close']);
  assert.equal(first?.nutrition.calories, 500);
  assert.deepEqual(estimateFromComparableRecipes(target, donors), first);
});

test('demo-only estimates cannot enter automatic published planning', () => {
  const publishedNutrition = { calories: null,
    dataCompletionAudit: { operations: ['CODEX_SIMILAR_RECIPE_ESTIMATE_V1'] } };
  assert.equal(hasDemoNutritionEstimate(publishedNutrition), true);
  const input = { source: { id: 'source-1', sourceName: 'PANLASANG_PINOY', status: 'AVAILABLE',
    publishedNutrition, calories: 500, proteinG: 40, carbsG: 30, fatG: 20,
    ingredients: [{ name: 'chicken', quantity: 150, unit: 'g' }] },
    candidateId: 'source-1', conditions: [], allergens: [],
    preparedIngredients: [{ ingredientName: 'chicken', quantity: 150, unit: 'g' }] };
  assert.equal(isUnrestrictedPanlasangBaseEligible(input), false);
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, allowDemoEstimatedNutrition: true }), true);
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, allowDemoEstimatedNutrition: true,
    conditions: ['DIABETES'] }), false);
  const oldNode = process.env.NODE_ENV;
  const oldFlag = process.env.ALLOW_DEMO_RECIPE_ESTIMATES;
  try {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEMO_RECIPE_ESTIMATES = 'true';
    assert.equal(allowDemoNutritionPlanning(), false);
    process.env.NODE_ENV = 'development';
    assert.equal(allowDemoNutritionPlanning(), true);
  } finally {
    if (oldNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNode;
    if (oldFlag === undefined) delete process.env.ALLOW_DEMO_RECIPE_ESTIMATES;
    else process.env.ALLOW_DEMO_RECIPE_ESTIMATES = oldFlag;
  }
});
