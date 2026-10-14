import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateReviewNutrients,
  reviewSourceNutrients,
  type NutrientReference,
} from '../src/domain/review-nutrient-estimate.policy';
const recipe = {
  name: 'Chicken rice',
  ingredients: [{ name: 'Chicken breast' }, { name: 'rice' }],
  calories: 400,
  proteinG: 20,
  carbsG: 60,
  fatG: 10,
};
const refs: NutrientReference[] = [
  {
    id: 'USDA_FDC_1',
    name: 'Chicken with rice',
    category: 'Meals',
    calories: 200,
    proteinG: 10,
    carbsG: 30,
    fatG: 5,
    sodiumMg: 100,
    sugarG: 2,
    fiberG: 3,
    potassiumMg: 150,
    phosphorusMg: 100,
    saturatedFatG: 2,
  },
];
test('supplements all missing values using recorded units and energy; records references and estimate status', () => {
  const e = estimateReviewNutrients(recipe, {}, refs, 'hash')!;
  assert.deepEqual(e.values, {
    sodiumMg: 200,
    sugarG: 4,
    fiberG: 6,
    potassiumMg: 300,
    phosphorusMg: 200,
    saturatedFatG: 4,
  });
  assert.equal(e.estimated, true);
  assert.equal(e.clinicalCertification, false);
  assert.equal(e.donors.sodiumMg![0].id, 'USDA_FDC_1');
});
test('estimates remain excluded by default and preserve published values and measured zeros on explicit RND opt-in', () => {
  const e = estimateReviewNutrients(recipe, { sodiumMg: 0 }, refs, 'hash')!;
  const p = { sodiumMg: 0, extendedNutritionEstimates: e };
  assert.equal(reviewSourceNutrients(p, recipe).values.phosphorusMg, null);
  const review = reviewSourceNutrients(p, recipe, true);
  assert.equal(review.values.sodiumMg, 0);
  assert.equal(review.values.phosphorusMg, 200);
  assert.ok(!review.estimatedKeys.includes('sodiumMg'));
  assert.ok(review.estimatedKeys.includes('phosphorusMg'));
});
test('changed meal inputs cannot reuse a supplementary estimate', () => {
  const p = { extendedNutritionEstimates: estimateReviewNutrients(recipe, {}, refs, 'hash')! };
  for (const changed of [{ calories: 401 }, { name: 'Beef rice' }, { ingredients: [{ name: 'beef' }] }])
    assert.equal(reviewSourceNutrients(p, { ...recipe, ...changed }, true).values.phosphorusMg, null);
});
test('missing references and invalid targets remain unknown; unknown is never converted to zero', () => {
  assert.equal(estimateReviewNutrients({ ...recipe, calories: 0 }, {}, refs, 'hash'), null);
  assert.equal(estimateReviewNutrients(recipe, {}, [], 'hash'), null);
  const e = estimateReviewNutrients(recipe, {}, [{ ...refs[0], phosphorusMg: null }], 'hash')!;
  assert.equal(e.values.phosphorusMg, undefined);
});
test('estimated constituents do not exceed recorded carbs/fat and native values remain unchanged', () => {
  const p = { sugarG: 999, saturatedFatG: 123 };
  const e = estimateReviewNutrients({ ...recipe, carbsG: 1, fatG: 0 }, p, refs, 'hash')!;
  assert.equal(e.values.sugarG, 1);
  assert.equal(e.values.saturatedFatG, 0);
  assert.deepEqual(p, { sugarG: 999, saturatedFatG: 123 });
});
