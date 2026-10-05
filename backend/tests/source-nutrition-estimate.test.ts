import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateFromComparableRecipes,
  hasDemoNutritionEstimate,
} from '../src/domain/source-nutrition-estimate.policy';
import { isUnrestrictedPanlasangBaseEligible } from '../src/domain/unrestricted-panlasang-base.policy';

test('comparable-source estimates are deterministic and preserve their donor IDs', () => {
  const target = {
    id: 'missing',
    recipeName: 'Chicken adobo with potato',
    category: 'Chicken',
    mealType: 'LUNCH',
    ingredients: [{ name: 'chicken' }, { name: 'potato' }],
  };
  const donors = [
    {
      id: 'close',
      recipeName: 'Chicken adobo',
      category: 'Chicken',
      mealType: 'LUNCH',
      ingredients: [{ name: 'chicken' }, { name: 'soy sauce' }],
      nutrition: { calories: 500, proteinG: 40, carbsG: 30, fatG: 20 },
    },
    {
      id: 'far',
      recipeName: 'Blueberry pancake',
      category: 'Breakfast',
      mealType: 'BREAKFAST',
      ingredients: [{ name: 'flour' }],
      nutrition: { calories: 300, proteinG: 8, carbsG: 50, fatG: 8 },
    },
  ];
  const first = estimateFromComparableRecipes(target, donors);
  assert.deepEqual(first?.donorIds, ['close']);
  assert.equal(first?.nutrition.calories, 500);
  assert.deepEqual(estimateFromComparableRecipes(target, donors), first);
});

test('backend audit marker does not change meal eligibility or case review', () => {
  const publishedNutrition = {
    calories: null,
    dataCompletionAudit: { operations: ['CODEX_SIMILAR_RECIPE_ESTIMATE_V1'] },
  };
  assert.equal(hasDemoNutritionEstimate(publishedNutrition), true);
  const input = {
    source: {
      id: 'source-1',
      sourceName: 'PANLASANG_PINOY',
      status: 'AVAILABLE',
      publishedNutrition,
      calories: 500,
      proteinG: 40,
      carbsG: 30,
      fatG: 20,
      ingredients: [{ name: 'chicken', quantity: 150, unit: 'g' }],
    },
    candidateId: 'source-1',
    conditions: [],
    allergens: [],
    preparedIngredients: [{ ingredientName: 'chicken', quantity: 150, unit: 'g' }],
  };
  assert.equal(isUnrestrictedPanlasangBaseEligible(input), true);
  assert.equal(
    isUnrestrictedPanlasangBaseEligible({
      ...input,
      source: { ...input.source, publishedNutrition: { calories: 500 } },
    }),
    true
  );
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, conditions: ['DIABETES'] }), false);
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, allergens: ['SHELLFISH'] }), false);
});
