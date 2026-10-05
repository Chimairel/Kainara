import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateGroceryIngredients,
  groceryItemKey,
  normalizeGroceryUnit,
} from '../src/domain/grocery-quantity.policy';

test('[TEST-059] grocery units normalize deterministically', () => {
  assert.equal(normalizeGroceryUnit('grams'), 'g');
  assert.equal(normalizeGroceryUnit('ML'), 'mL');
  assert.equal(groceryItemKey('  Brown   Rice ', 'grams'), 'brown rice|g');
});

test('[TEST-060] grocery aggregation sums compatible quantities and records meal coverage', () => {
  assert.deepEqual(
    aggregateGroceryIngredients([
      { ingredientName: 'brown rice', category: 'Cereals', quantity: 100, unit: 'g' },
      { ingredientName: 'Brown Rice', category: 'Cereals', quantity: 150, unit: 'grams' },
    ]),
    [
      {
        key: 'brown rice|g',
        ingredientName: 'Brown rice',
        category: 'Cereals',
        quantity: 250,
        unit: 'g',
        sourceMealCount: 2,
      },
    ]
  );
});

test('[TEST-061] missing quantities remain honestly unspecified', () => {
  const items = aggregateGroceryIngredients([
    { ingredientName: 'egg', quantity: 2, unit: 'piece' },
    { ingredientName: 'egg', quantity: null, unit: 'piece' },
  ]);
  assert.deepEqual(
    items.map(({ key, quantity, unit, sourceMealCount }) => ({ key, quantity, unit, sourceMealCount })),
    [
      { key: 'egg|piece', quantity: 2, unit: 'piece', sourceMealCount: 1 },
      { key: 'egg|unspecified', quantity: null, unit: null, sourceMealCount: 1 },
    ]
  );
});

test('a measured salt amount remains visible beside additional unmeasured salt', () => {
  const items = aggregateGroceryIngredients([
    { ingredientName: 'salt', quantity: 1, unit: 'tsp' },
    { ingredientName: 'Salt to taste', quantity: null, unit: 'tsp' },
    { ingredientName: 'salt', quantity: 0.5, unit: 'teaspoon' },
    { ingredientName: 'salt', quantity: 2, unit: null },
  ]);
  assert.deepEqual(
    items.map(({ key, quantity, sourceMealCount }) => ({ key, quantity, sourceMealCount })),
    [
      { key: 'salt|tsp', quantity: 1.5, sourceMealCount: 2 },
      { key: 'salt|unspecified', quantity: null, sourceMealCount: 2 },
    ]
  );
});
