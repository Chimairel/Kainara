import test from 'node:test';
import assert from 'node:assert/strict';
import { existingRecipeExtendedFill } from '../src/domain/recipe-extended-backfill.policy';

const nutrition = {
  calories: 300,
  proteinG: 30,
  carbsG: 25,
  fatG: 10,
  sodiumMg: 250,
  sugarG: 0,
  fiberG: 3,
  potassiumMg: 400,
  phosphorusMg: 150,
  saturatedFatG: 2,
};
const row = {
  sourceName: 'DEMO_STANDARD_PORTION',
  calories: 300,
  proteinG: 30,
  carbsG: 25,
  fatG: 10,
  ingredients: [{ name: 'Chicken', foodItemId: 'food', quantity: 100, unit: 'g' }],
  publishedNutrition: {
    demoPreparation: {
      complete: true,
      estimated: true,
      clinicalCertification: false,
      signature: 'saved-signature',
      nutrition,
      prepared: [{ name: 'Chicken', foodItemId: 'food', quantity: 100, unit: 'g', gramsPerServing: 100 }],
    },
  },
};

test('recovers six existing calculated facts, retaining zero and their explicit basis', () => {
  const result = existingRecipeExtendedFill(row)!;
  assert.deepEqual(result.fill, {
    sodiumMg: 250,
    sugarG: 0,
    fiberG: 3,
    potassiumMg: 400,
    phosphorusMg: 150,
    saturatedFatG: 2,
  });
  assert.equal(result.basis, 'EXISTING_STANDARDIZED_DEMO_CALCULATION');
});
test('preserves recorded values, rejects invalid values and is idempotent after fill', () => {
  const published = { ...row.publishedNutrition, sodiumMg: 999 };
  assert.equal(existingRecipeExtendedFill({ ...row, publishedNutrition: published })!.fill.sodiumMg, undefined);
  const filled = { ...row.publishedNutrition, ...existingRecipeExtendedFill(row)!.fill };
  assert.equal(existingRecipeExtendedFill({ ...row, publishedNutrition: filled }), null);
});
test('changed macros, ingredient identity or amount cannot inherit a saved calculation', () => {
  for (const changed of [
    { calories: 301 },
    { ingredients: [{ ...row.ingredients[0], quantity: 101 }] },
    { ingredients: [{ ...row.ingredients[0], foodItemId: 'other' }] },
    { sourceName: 'PANLASANG_PINOY' },
  ])
    assert.equal(existingRecipeExtendedFill({ ...row, ...changed }), null);
});
test('incomplete or uncertified-as-measured metadata cannot supply fabricated facts', () => {
  for (const changed of [{ complete: false }, { estimated: false }, { clinicalCertification: true }, { prepared: [] }])
    assert.equal(
      existingRecipeExtendedFill({
        ...row,
        publishedNutrition: { demoPreparation: { ...row.publishedNutrition.demoPreparation, ...changed } },
      }),
      null
    );
  const result = existingRecipeExtendedFill({
    ...row,
    publishedNutrition: {
      demoPreparation: {
        ...row.publishedNutrition.demoPreparation,
        nutrition: { ...nutrition, sodiumMg: null, sugarG: -1, phosphorusMg: undefined },
      },
    },
  })!;
  assert.equal(result.fill.sodiumMg, undefined);
  assert.equal(result.fill.sugarG, undefined);
  assert.equal(result.fill.phosphorusMg, undefined);
});
