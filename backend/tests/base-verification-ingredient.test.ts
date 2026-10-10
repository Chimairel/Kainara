import assert from 'node:assert/strict';
import test from 'node:test';
import { baseVerificationIngredient } from '../src/services/meal-base-verification.service';

test('base verification includes recorded source and actual composition name without private ingredient fields', () => {
  const ingredient = {
    ingredientName: 'Carrot',
    quantity: 0,
    unit: 'g',
    dataSource: 'FNRI',
    foodItem: { name: 'Carrot, raw' },
    foodItemId: 'internal',
  };
  assert.deepEqual(baseVerificationIngredient(ingredient), {
    name: 'Carrot',
    quantity: 0,
    unit: 'g',
    source: 'FNRI',
    compositionFoodName: 'Carrot, raw',
  });
});
test('base verification retains missing composition identity rather than inventing a mapped food', () => {
  assert.deepEqual(
    baseVerificationIngredient({ ingredientName: 'Oil', quantity: null, unit: null, dataSource: 'GEMINI_ESTIMATED' }),
    { name: 'Oil', quantity: null, unit: null, source: 'GEMINI_ESTIMATED', compositionFoodName: null }
  );
});
