import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { buildOutsideMealAiSchema } from '../src/domain/outside-meal-ai.policy';
import { loadNutritionReferenceCases, measureNutritionEstimates } from '../scripts/helpers/gemini-nutrition-evaluation';

test('Nutrition comparison uses saved FNRI composition and explicit cooked edible portions, withholding reference answers', () => {
  const { cases, request } = loadNutritionReferenceCases(resolve(__dirname, '../prisma/data/fnri.csv'));
  assert.equal(cases.length, 8);
  const rice = cases.filter((row) => row.foodId === 'A020');
  assert.equal(rice[1].expected.calories, rice[0].expected.calories * 3);
  assert.ok(cases.some((row) => row.expected.fatG === 0));
  assert.equal(request.prompt.includes('expected'), false);
  assert.equal(request.prompt.includes('foodId'), false);
  const estimates = cases.map((row) => ({
    name: row.name,
    ...row.expected,
    calorieLow: row.expected.calories,
    calorieHigh: row.expected.calories,
    ingredients: [],
  }));
  const exact = measureNutritionEstimates(cases, estimates);
  assert.deepEqual(exact.meanAbsoluteErrors, { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  assert.equal(exact.calorieRangeCoverage, 1);
  const biased = measureNutritionEstimates(
    cases,
    estimates.map((row) => ({ ...row, calories: row.calories + 10, proteinG: row.proteinG + 2 }))
  );
  assert.equal(biased.meanAbsoluteErrors.calories, 10);
  assert.ok(Math.abs(Number(biased.meanAbsoluteErrors.proteinG) - 2) < 0.000001);
  assert.throws(() => measureNutritionEstimates(cases, []), /incomplete/);
});

test('Outside AI rejects incomplete items, reversed calorie ranges and nonfinite nutrition without rejecting zero nutrients', () => {
  const item = {
    name: 'Rice',
    calories: 100,
    calorieLow: 90,
    calorieHigh: 110,
    proteinG: 2,
    carbsG: 22,
    fatG: 0,
    ingredients: ['rice'],
  };
  const schema = buildOutsideMealAiSchema(1);
  assert.equal(schema.safeParse({ items: [item] }).success, true);
  for (const response of [
    { items: [] },
    { items: [item, item] },
    { items: [{ ...item, calorieLow: 101 }] },
    { items: [{ ...item, calorieHigh: 99 }] },
    { items: [{ ...item, proteinG: Infinity }] },
  ])
    assert.equal(schema.safeParse(response).success, false);
});
