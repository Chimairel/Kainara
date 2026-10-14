import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptedReviewFilterInterpretation } from '../src/domain/review-filter-interpretation.policy';
import { evaluateNutrientFilters, plateNutrients } from '../src/domain/review-nutrient-filter.policy';

test('interpreted strict and inclusive limits are enforced without rounding at their boundaries', () => {
  const filters = acceptedReviewFilterInterpretation({ filters: { sugarG: { max: 200, maxExclusive: true }, sodiumMg: { max: 500 } }, unsupported: [] });
  assert.equal(evaluateNutrientFilters(plateNutrients({ sugarG: 199.9999, sodiumMg: 500 }, null, null), filters).matches, true);
  assert.equal(evaluateNutrientFilters(plateNutrients({ sugarG: 200, sodiumMg: 500 }, null, null), filters).matches, false);
  assert.equal(evaluateNutrientFilters(plateNutrients({ sugarG: null, sodiumMg: 0 }, null, null), filters).matches, false);
});
test('AI output cannot silently drop unsupported instructions or widen the known nutrient schema', () => {
  for (const value of [
    { filters: {}, unsupported: [] },
    { filters: { sugarG: { max: 10 } }, unsupported: ['low sodium without an amount'] },
    { filters: { cholesterol: { max: 20 } }, unsupported: [] },
    { filters: { sugarG: { max: '10' } }, unsupported: [] },
    { filters: { sugarG: { maxExclusive: true } }, unsupported: [] },
  ]) assert.throws(() => acceptedReviewFilterInterpretation(value));
});
