import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readFnriSource,
  sourceNumber,
  planFoodNutrientEnrichment,
  sourceEvidenceFingerprint,
  type SourceFood,
} from '../src/domain/food-nutrient-source.policy';
import { publishedServingNutrientFill } from '../src/domain/meal-nutrient-completion.policy';

test('missing, trace and malformed source values remain unknown; numerical zero is retained', () => {
  for (const value of ['', 'tr', '-', 'n/a', '12mg', '1,000', -1, Infinity, undefined, null])
    assert.equal(sourceNumber(value), null);
  assert.equal(sourceNumber('0'), 0);
  assert.equal(sourceNumber('1.5'), 1.5);
});
test('FNRI parsing retains all available columns and explicit unavailable source entries', () => {
  const rows = readFnriSource(
    'food_id,food_name,has_data,"Energy, calculated (kcal)",Protein (g),"Carbohydrate, total (g)",Total Fat (g),"Sugars, total (g)","Phosphorus, P (mg)","Fatty acids, saturated, total (g)"\nF1,"Sample, cooked",TRUE,100,2,20,1,0,90,tr\n',
    false
  );
  assert.equal(rows[0].sugar, 0);
  assert.equal(rows[0].phosphorus, 90);
  assert.equal(rows[0].saturatedFat, null);
  assert.throws(() => readFnriSource('changed delivery'), /fingerprint/);
});
const source: SourceFood = {
  source: 'FNRI',
  sourceRecordId: 'A1',
  name: 'Rice',
  calories: 100,
  proteinG: 2,
  carbsG: 20,
  fatG: 1,
  sugar: 0,
  phosphorus: 40,
  saturatedFat: 0.2,
  evidence: { version: 'v1', entries: [{ value: 0, name: 'sugar' }] },
};
const food = {
  ...source,
  sourceRecordId: null,
  sugar: null,
  phosphorus: null,
  saturatedFat: null,
  sourceNutrientEvidence: null,
};
test('completion refuses mismatched source identities/macros or overwriting a recorded nutrient', () => {
  assert.throws(() => planFoodNutrientEnrichment({ ...food, calories: 101 }, source), /identity\/composition/);
  assert.throws(() => planFoodNutrientEnrichment({ ...food, sourceRecordId: 'different' }, source));
  assert.throws(() => planFoodNutrientEnrichment({ ...food, phosphorus: 20 }, source), /overwrite/);
  assert.equal(planFoodNutrientEnrichment(food, source).sugar, 0);
});
test('JSONB key reordering cannot produce repeated updates', () => {
  const plan = planFoodNutrientEnrichment(food, source);
  const existing = {
    ...food,
    ...plan,
    sourceNutrientEvidence: { entries: [{ name: 'sugar', value: 0 }], version: 'v1' },
  };
  assert.equal(planFoodNutrientEnrichment(existing, source).changed, false);
  assert.equal(sourceEvidenceFingerprint(existing.sourceNutrientEvidence), sourceEvidenceFingerprint(source.evidence));
});
const serving = {
  name: 'Soup',
  calories: 100,
  proteinG: 5,
  carbsG: 10,
  fatG: 4,
  sodiumMg: null,
  ingredients: [{ name: 'Broth', quantity: 100, unit: 'g' }],
};
const publisher = {
  name: 'Soup',
  nutrition: { calories: 100, proteinG: 5, carbsG: 10, fatG: 4, sodiumMg: 500 },
  ingredients: serving.ingredients,
};
test('publisher nutrients only fill the identical serving and never replace existing values', () => {
  assert.deepEqual(publishedServingNutrientFill(serving, publisher), { sodiumMg: 500 });
  assert.equal(publishedServingNutrientFill({ ...serving, sodiumMg: 0 }, publisher), null);
  assert.equal(
    publishedServingNutrientFill({ ...serving, ingredients: [{ name: 'Broth', quantity: 200, unit: 'g' }] }, publisher),
    null
  );
  assert.equal(publishedServingNutrientFill({ ...serving, calories: 200 }, publisher), null);
  assert.equal(
    publishedServingNutrientFill(
      { ...serving, ingredients: [...serving.ingredients, { name: 'Rice', quantity: 100, unit: 'g' }] },
      publisher
    ),
    null
  );
});
