import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeActionableMeal } from '../src/services/meal-plan-presentation.service';

const meal = {
  id: 'fixture-meal',
  libraryMealId: null,
  selectionEvidence: null,
  status: 'APPROVED',
  aiConfidenceFlag: 'SAFE',
  calories: 400,
  ingredients: [],
};

test('approved meals without a stored reviewer do not acquire fabricated credentials or explanation attribution', () => {
  const result = serializeActionableMeal(meal);
  assert.equal(result.verifier, null);
  assert.ok(!JSON.stringify(result.explanation).includes('Andrea Reyes'));
  assert.ok(!('selectionEvidence' in result));
});

test('meal presentation preserves the stored reviewer and strips its internal relation', () => {
  const result = serializeActionableMeal({
    ...meal,
    nutritionist: {
      prcLicenseNumber: 'fixture-license',
      prcLicenseExpiry: new Date('2030-01-01'),
      specialization: null,
      yearsOfExperience: null,
      university: null,
      bio: null,
      user: { name: 'Stored reviewer', image: null },
    },
  });
  assert.equal(result.verifier?.name, 'Stored reviewer');
  assert.ok(!('nutritionist' in result));
});

test('the public serializer uses linked composition metadata without exposing the internal food relation', () => {
  const result = serializeActionableMeal({
    ...meal,
    candidateProvenance: 'RAW_RECIPE_CORPUS',
    ingredients: [
      {
        dataSource: 'SOURCE_RECIPE',
        foodItemId: 'fixture-food',
        foodItem: { source: 'FNRI' },
        ingredientName: 'Egg',
        quantity: 50,
        unit: 'g',
      },
    ],
  });
  assert.ok(result.explanation.bullets.some((line) => /1 FNRI out of 1/.test(line)));
  assert.equal(result.explanation.nutritionEvidence, 'SOURCE_RECIPE');
  assert.deepEqual(result.ingredients, [
    { dataSource: 'SOURCE_RECIPE', foodItemId: 'fixture-food', ingredientName: 'Egg', quantity: 50, unit: 'g' },
  ]);
});
