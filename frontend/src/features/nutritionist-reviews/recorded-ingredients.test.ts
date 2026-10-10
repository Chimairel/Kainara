import { expect, it } from 'vitest';
import { recordedIngredients } from './recorded-ingredients';

it('preserves the recorded ingredient mapping, source and zero amount', () => {
  expect(
    recordedIngredients([
      { name: 'Carrot', quantity: 0, unit: 'g', source: 'FNRI', compositionFoodName: 'Carrot, raw' },
    ])
  ).toEqual([{ name: 'Carrot', quantity: 0, unit: 'g', source: 'FNRI', compositionFoodName: 'Carrot, raw' }]);
});
it('keeps missing and legacy text quantities unknown without guessing a nutrition source', () => {
  expect(
    recordedIngredients([
      { ingredientName: 'Salt', quantity: 'to taste', dataSource: 'SOURCE_RECIPE' },
      '1 tbsp oil',
      null,
    ])
  ).toEqual([
    { name: 'Salt', quantity: null, unit: null, source: 'SOURCE_RECIPE', compositionFoodName: null },
    { name: '1 tbsp oil', quantity: null, unit: null, source: 'UNKNOWN', compositionFoodName: null },
  ]);
});
