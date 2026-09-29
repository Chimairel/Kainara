import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceServingScale, scalePublishedAmount } from '../src/domain/source-serving-adjustment.policy';
import { buildRawRecipeContentSignature } from '../src/domain/raw-recipe-content-signature.policy';

test('published servings can fit a slot through a bounded, traceable portion change', () => {
  assert.equal(sourceServingScale({ calories: 721, dailyCalorieTarget: 2571, mealType: 'BREAKFAST' }), 1);
  const scale = sourceServingScale({ calories: 438, dailyCalorieTarget: 2571, mealType: 'BREAKFAST' });
  assert.equal(scale, 1.76);
  assert.equal(scalePublishedAmount(438, scale!), 770.88);
  assert.equal(sourceServingScale({ calories: 113, dailyCalorieTarget: 2571, mealType: 'BREAKFAST' }), null);
  assert.equal(sourceServingScale({ calories: 0, dailyCalorieTarget: 2571, mealType: 'BREAKFAST' }), null);
});

test('missing published nutrition is distinct from an actual zero in source identity', () => {
  const base = { name: 'Source recipe', ingredients: [{ name: 'water', quantity: 1, unit: 'cup' }] };
  assert.notEqual(
    buildRawRecipeContentSignature({ ...base, nutrition: { calories: null } }),
    buildRawRecipeContentSignature({ ...base, nutrition: { calories: 0 } })
  );
});
