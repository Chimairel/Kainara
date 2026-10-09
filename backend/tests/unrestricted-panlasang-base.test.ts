import assert from 'node:assert/strict';
import test from 'node:test';
import { isUnrestrictedPanlasangBaseEligible } from '../src/domain/unrestricted-panlasang-base.policy';

const source = {
  id: 'source-1',
  sourceName: 'PANLASANG_PINOY',
  status: 'AVAILABLE',
  publishedNutrition: { calories: 420 },
  calories: 420,
  proteinG: 30,
  carbsG: 40,
  fatG: 15,
  ingredients: [
    { name: 'chicken', quantity: 150, unit: 'g' },
    { name: 'ginger', quantity: 5, unit: 'g' },
  ],
};
const input = {
  source,
  candidateId: source.id,
  conditions: [] as string[],
  allergens: [] as string[],
  preparedIngredients: [
    { ingredientName: 'chicken', quantity: 150, unit: 'g' },
    { ingredientName: 'ginger', quantity: 5, unit: 'g' },
  ],
};

test('demo preparation requires RND review even for an unrestricted member', () => {
  assert.equal(
    isUnrestrictedPanlasangBaseEligible({
      ...input,
      source: { ...source, publishedNutrition: { ...source.publishedNutrition, demoPreparation: { estimated: true } } },
    }),
    false
  );
});

test('complete Panlasang source may serve a user with no declared restrictions', () => {
  assert.equal(isUnrestrictedPanlasangBaseEligible(input), true);
  assert.equal(
    isUnrestrictedPanlasangBaseEligible({ ...input, source: { ...source, sourceName: 'USER_OBSERVED' } }),
    false
  );
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, source: { ...source, status: 'WITHDRAWN' } }), false);
  assert.equal(
    isUnrestrictedPanlasangBaseEligible({
      ...input,
      preparedIngredients: [{ ingredientName: 'chicken', quantity: 175, unit: 'g' }, input.preparedIngredients[1]],
    }),
    false
  );
});

test('unmeasured source ingredients keep their names without inventing grocery quantities', () => {
  const partial = {
    ...source,
    ingredients: [
      source.ingredients[0],
      { name: 'salt', quantity: null, unit: null },
      { name: '(minced)', quantity: null, unit: null, excludedFromPlanning: true },
    ],
  };
  assert.equal(
    isUnrestrictedPanlasangBaseEligible({
      ...input,
      source: partial,
      preparedIngredients: [input.preparedIngredients[0], { ingredientName: 'salt' }],
    }),
    true
  );
  assert.equal(
    isUnrestrictedPanlasangBaseEligible({
      ...input,
      source: partial,
      preparedIngredients: [input.preparedIngredients[0], { ingredientName: 'pepper' }],
    }),
    false
  );
  assert.equal(
    isUnrestrictedPanlasangBaseEligible({
      ...input,
      source: { ...partial, ingredients: [...partial.ingredients, null] },
      preparedIngredients: [input.preparedIngredients[0], { ingredientName: 'salt' }],
    }),
    false
  );
  assert.equal(
    isUnrestrictedPanlasangBaseEligible({
      ...input,
      source: { ...partial, ingredients: [source.ingredients[0], { name: 'shrimp', excludedFromPlanning: true }] },
      preparedIngredients: [input.preparedIngredients[0]],
    }),
    false
  );
});

test('health restrictions or missing source nutrition keep the review path', () => {
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, conditions: ['DIABETES'] }), false);
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, allergens: ['DAIRY'] }), false);
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, otherConditions: 'unclear symptoms' }), false);
  assert.equal(
    isUnrestrictedPanlasangBaseEligible({ ...input, source: { ...source, publishedNutrition: null } }),
    false
  );
});

test('adjusted source portions require matching measured ingredients and published macros', () => {
  const adjusted = {
    ...input,
    servingScale: 1.5,
    preparedNutrition: { calories: 630, proteinG: 45, carbsG: 60, fatG: 22.5 },
    preparedIngredients: [
      { ingredientName: 'chicken', quantity: 225, unit: 'g' },
      { ingredientName: 'ginger', quantity: 7.5, unit: 'g' },
    ],
  };
  assert.equal(isUnrestrictedPanlasangBaseEligible(adjusted), true);
  assert.equal(
    isUnrestrictedPanlasangBaseEligible({
      ...adjusted,
      preparedNutrition: { ...adjusted.preparedNutrition, calories: 650 },
    }),
    false
  );
  assert.equal(
    isUnrestrictedPanlasangBaseEligible({
      ...adjusted,
      preparedIngredients: [adjusted.preparedIngredients[0], { ingredientName: 'ginger', quantity: 8, unit: 'g' }],
    }),
    false
  );
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...adjusted, conditions: ['DIABETES'] }), false);
});
