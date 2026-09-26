import assert from 'node:assert/strict';
import test from 'node:test';
import { isUnrestrictedPanlasangBaseEligible } from '../src/domain/unrestricted-panlasang-base.policy';

const source = {
  id: 'source-1', sourceName: 'PANLASANG_PINOY', status: 'AVAILABLE',
  publishedNutrition: { calories: 420 },
  calories: 420, proteinG: 30, carbsG: 40, fatG: 15,
  ingredients: [
    { name: 'chicken', quantity: 150, unit: 'g' },
    { name: 'ginger', quantity: 5, unit: 'g' },
  ],
};
const input = {
  source, candidateId: source.id,
  conditions: [] as string[], allergens: [] as string[],
  preparedIngredients: [
    { ingredientName: 'chicken', quantity: 150, unit: 'g' },
    { ingredientName: 'ginger', quantity: 5, unit: 'g' },
  ],
};

test('complete Panlasang source may serve a user with no declared restrictions', () => {
  assert.equal(isUnrestrictedPanlasangBaseEligible(input), true);
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, source: { ...source, sourceName: 'USER_OBSERVED' } }), false);
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, source: { ...source, status: 'WITHDRAWN' } }), false);
  assert.equal(isUnrestrictedPanlasangBaseEligible({
    ...input, preparedIngredients: [{ ingredientName: 'chicken', quantity: 175, unit: 'g' }, input.preparedIngredients[1]],
  }), false);
});

test('incomplete source and any health restriction keep the review path', () => {
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, conditions: ['DIABETES'] }), false);
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, allergens: ['DAIRY'] }), false);
  assert.equal(isUnrestrictedPanlasangBaseEligible({ ...input, otherConditions: 'unclear symptoms' }), false);
  assert.equal(isUnrestrictedPanlasangBaseEligible({
    ...input, source: { ...source, ingredients: [{ name: 'chicken', quantity: null, unit: null }] },
  }), false);
});
