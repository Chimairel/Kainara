import test from 'node:test';
import assert from 'node:assert/strict';
import type { FoodItem, RawRecipeCandidate } from '@prisma/client';
import { prepareDemoMeasurement, demoPortionGrams } from '../src/domain/demo-recipe-measurement.policy';
import { createDemoRecipePreparer } from '../src/services/demo-recipe-preparation.service';
import { evaluateConditionNutrientRule } from '../src/domain/condition-rule-evaluation.policy';
import { DEMO_RULE_PROPOSALS } from '../src/domain/demo-condition-rules.policy';
import { demoPlateNutrition } from '../src/domain/demo-plate-nutrition.policy';

test('plate totals scale all nutrients and include rice without treating unknowns as zero', () => {
  const base = {
    calories: 300,
    proteinG: 30,
    carbsG: 10,
    fatG: 10,
    sodiumMg: 200,
    sugarG: 2,
    fiberG: 3,
    potassiumMg: 400,
    phosphorusMg: 150,
    saturatedFatG: 2,
  };
  const rice = {
    calories: 130,
    proteinG: 2,
    carbsG: 28,
    fatG: 0.3,
    sodium: 2,
    sugar: 0,
    fiber: 0.4,
    potassium: 30,
    phosphorus: 40,
    saturatedFat: 0.1,
  };
  const result = demoPlateNutrition(base, 2, rice, 150);
  assert.equal(result.calories, 795);
  assert.equal(result.sodiumMg, 403);
  assert.equal(result.phosphorusMg, 360);
  assert.equal(result.saturatedFatG, 4.15);
  assert.equal(demoPlateNutrition(base, 1, { ...rice, phosphorus: null }, 150).phosphorusMg, null);
  assert.equal(demoPlateNutrition(base, 1, null, 0).phosphorusMg, 150);
});

test('source fractions and mixed fractions divide once by recipe servings', () => {
  assert.equal(prepareDemoMeasurement({ name: '½ cups broth', quantity: 0, unit: null }, 4)[0].quantity, 0.125);
  assert.equal(prepareDemoMeasurement({ name: '1 1/2 cups broth' }, 3)[0].quantity, 0.5);
  assert.equal(prepareDemoMeasurement({ name: '½ cups broth', quantity: 0.125, unit: 'cups' }, 4)[0].quantity, 0.125);
  const range = prepareDemoMeasurement({ name: '4-5 pieces bay leaves' }, 3)[0];
  assert.equal(range.quantity, 1.5);
  assert.deepEqual(range.assumptions, ['SOURCE_RANGE_MIDPOINT']);
});
test('salt and pepper are distinct explicit demo assumptions; unknown amounts remain unresolved', () => {
  const mixed = prepareDemoMeasurement({ name: 'Salt and ground black pepper to taste' }, 4);
  assert.deepEqual(
    mixed.map((i) => [i.name, i.quantity, i.unit]),
    [
      ['salt', 0.5, 'g'],
      ['ground black pepper', 0.05, 'g'],
    ]
  );
  assert.equal(prepareDemoMeasurement({ name: 'fish sauce to taste' }, 4)[0].quantity, null);
});
test('mass conversions and food-specific household portions do not guess absent identities', () => {
  assert.equal(demoPortionGrams(1, 'lb', [], 'pork')?.grams, 453.59237);
  const portions = [{ id: 1, amount: 1, grams: 240, description: 'cup' }];
  assert.equal(demoPortionGrams(2, 'tbsp', portions, 'broth')?.grams, 30);
  assert.equal(demoPortionGrams(100, 'ml', portions, 'broth')?.grams, 100);
  assert.equal(demoPortionGrams(1, 'cup', [], 'flour'), null);
});
const foods = [
  {
    id: 'salt',
    name: 'Salt, table',
    source: 'USDA_FDC',
    sourceRecordId: '1',
    compositionRevision: 1,
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    sodium: 40000,
    sugar: 0,
    fiber: 0,
    potassium: 0,
    phosphorus: 0,
    saturatedFat: 0,
  },
  {
    id: 'pepper',
    name: 'Spices, pepper, black',
    source: 'USDA_FDC',
    sourceRecordId: '2',
    compositionRevision: 1,
    calories: 250,
    proteinG: 10,
    carbsG: 50,
    fatG: 3,
    sodium: 10,
    sugar: 1,
    fiber: 25,
    potassium: 1000,
    phosphorus: 100,
    saturatedFat: 1,
  },
] as FoodItem[];
test('both seasonings contribute and missing micronutrients cannot become zero', () => {
  const recipe = {
    id: 'source',
    contentSignature: 'original',
    sourceUrl: 'https://example.test/recipe',
    originalServings: 4,
    ingredients: [{ name: 'Salt and pepper to taste', foodItemId: 'salt' }],
  } as unknown as RawRecipeCandidate;
  const prepare = createDemoRecipePreparer(foods, []);
  const result = prepare(recipe);
  assert.equal(result.complete, true);
  assert.equal(result.prepared[1].foodItemId, 'pepper');
  assert.equal(result.nutrition?.sodiumMg, 200);
  assert.equal(result.estimated, true);
  assert.equal(result.clinicalCertification, false);
  assert.deepEqual(recipe.ingredients, [{ name: 'Salt and pepper to taste', foodItemId: 'salt' }]);
  const incomplete = createDemoRecipePreparer(
    foods.map((f) => ({ ...f, phosphorus: null })),
    []
  )(recipe);
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.nutrition?.phosphorusMg, null);
});
test('draft rules stay inactive; simulated daily checks require whole-day context', () => {
  for (const proposal of DEMO_RULE_PROPOSALS) {
    const draft = {
      ...proposal,
      id: 'fixture',
      operator: 'LESS_THAN',
      severity: 'CAUTION',
      reviewStatus: 'DRAFT',
      active: false,
    };
    assert.equal(evaluateConditionNutrientRule(draft, { sodiumMg: 100, saturatedFatG: 1 }).decision, 'NOT_EVALUABLE');
    const simulation = {
      ...draft,
      reviewStatus: 'APPROVED',
      active: true,
      approvedByNutritionistId: 'SIMULATION_ONLY',
    };
    assert.equal(
      evaluateConditionNutrientRule(simulation, { sodiumMg: 100, saturatedFatG: 1 }).decision,
      'NOT_EVALUABLE'
    );
    const low = { calories: 2000, sodiumMg: 1500, saturatedFatG: 10 };
    const high = { calories: 2000, sodiumMg: 3000, saturatedFatG: 30 };
    assert.equal(evaluateConditionNutrientRule(simulation, {}, { dailyTotals: low }).decision, 'PASS');
    assert.equal(evaluateConditionNutrientRule(simulation, {}, { dailyTotals: high }).decision, 'FAIL');
  }
});
