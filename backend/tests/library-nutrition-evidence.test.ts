import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLibraryNutritionEvidence } from '../src/services/nutritionist-library-nutrition-evidence.service';

const foods = [
  {
    id: 'fnri-rice',
    name: 'Rice, cooked',
    source: 'FNRI',
    sourceRecordId: 'F1',
    sourceReferenceUrl: null,
    compositionRevision: 1,
    calories: 130,
    proteinG: 2.5,
    carbsG: 28,
    fatG: 0.3,
    fiber: 0.4,
    sodium: 1,
    potassium: 35,
  },
  {
    id: 'usda-peas',
    name: 'Peas, cooked',
    source: 'USDA_FDC',
    sourceRecordId: '123',
    sourceReferenceUrl: null,
    compositionRevision: 1,
    calories: 84,
    proteinG: 5.4,
    carbsG: 15.6,
    fatG: 0.2,
    fiber: 5.5,
    sodium: null,
    potassium: 271,
  },
];

test('mixed FNRI and USDA serving totals use edible grams and leave unsupported nutrients unknown', () => {
  const totals = calculateLibraryNutritionEvidence(
    [
      { foodItemId: 'fnri-rice', gramsPerServing: 150 },
      { foodItemId: 'usda-peas', gramsPerServing: 50 },
    ],
    foods
  );
  assert.deepEqual(totals, {
    calories: 237,
    proteinG: 6.5,
    carbsG: 49.8,
    fatG: 0.6,
    fiberG: 3.4,
    sodiumMg: null,
    potassiumMg: 188,
    sugarG: null,
    phosphorusMg: null,
    saturatedFatG: null,
  });
});

test('extended nutrients require every measured ingredient and retain actual source zero', () => {
  const supplied = foods.map((food) => ({ ...food, sugar: 0, phosphorus: 50, saturatedFat: 0.2 }));
  const ingredients = [
    { foodItemId: 'fnri-rice', gramsPerServing: 150 },
    { foodItemId: 'usda-peas', gramsPerServing: 50 },
  ];
  const totals = calculateLibraryNutritionEvidence(ingredients, supplied);
  assert.equal(totals.sugarG, 0);
  assert.equal(totals.phosphorusMg, 100);
  assert.equal(totals.saturatedFatG, 0.4);
  assert.equal(
    calculateLibraryNutritionEvidence(ingredients, [{ ...supplied[0], phosphorus: null }, supplied[1]]).phosphorusMg,
    null
  );
});

test('unresolved composition prevents server-side preparation', () => {
  assert.throws(() => calculateLibraryNutritionEvidence([{ foodItemId: 'missing', gramsPerServing: 100 }], foods));
});
