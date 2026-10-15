import assert from 'node:assert/strict';
import test from 'node:test';
import { REVIEW_NUTRIENTS, plateNutrients, evaluateNutrientFilters, replacementServingKey, reviewNutrientFiltersSchema } from '../src/domain/review-nutrient-filter.policy';
import { reviewSwapQuerySchema, reviewSwapBodySchema } from '../src/validation/review-swap.schemas';
import { nutritionistReviewActionSchema } from '../src/validation/nutritionist.schemas';
import { requiresExplicitReplacementReview } from '../src/domain/review-swap.policy';

const base = Object.fromEntries(REVIEW_NUTRIENTS.map(key => [key, 10]));
test('complete-plate limits include scaled side nutrients in their recorded units', () => {
  const plate = plateNutrients(base, { ...base, sodiumMg: 20, sugarG: 0 }, 150);
  assert.equal(plate.sodiumMg, 40); assert.equal(plate.sugarG, 10); assert.equal(plate.proteinG, 25);
  assert.deepEqual(evaluateNutrientFilters(plate, { sodiumMg: { min: 40, max: 40 }, sugarG: { max: 10 } }), { matches: true, unknown: [] });
  assert.equal(evaluateNutrientFilters(plate, { sodiumMg: { max: 39.99999 } }).matches, false);
});
test('unknown base or side never becomes zero; zero is eligible at a zero maximum', () => {
  for (const key of REVIEW_NUTRIENTS) {
    const unknownBase = plateNutrients({ ...base, [key]: null }, base, 100);
    const unknownSide = plateNutrients(base, { ...base, [key]: null }, 100);
    for (const plate of [unknownBase, unknownSide]) assert.deepEqual(evaluateNutrientFilters(plate, { [key]: { max: 100 } }), { matches: false, unknown: [key] });
    assert.equal(evaluateNutrientFilters(plateNutrients({ ...base, [key]: 0 }, null, null), { [key]: { max: 0 } }).matches, true);
  }
  assert.equal(evaluateNutrientFilters(plateNutrients({}, null, null), {}).matches, true);
  for (const value of [NaN, Infinity, -1]) assert.equal(plateNutrients({ sodiumMg: value }, null, null).sodiumMg, null);
});
test('strict limits reject reversed, empty, unsupported, nonfinite, oversized and disguised units', () => {
  assert.equal(reviewNutrientFiltersSchema.safeParse({ sodiumMg: { max: 0 } }).success, true);
  for (const filters of [{ sugarG: {} }, { sugarG: { min: 3, max: 2 } }, { sugarG: { max: -1 } }, { sugarG: { max: Infinity } }, { sugarG: { max: 1000001 } }, { sodiumG: { max: 1 } }, { sugarG: { max: '36' } }, { sugarG: { max: 36, unit: 'mg' } }])
    assert.equal(reviewNutrientFiltersSchema.safeParse(filters).success, false);
  assert.equal(reviewSwapQuerySchema.safeParse({ filters: '{not json}' }).success, false);
  assert.deepEqual(reviewSwapQuerySchema.parse({ filters: '{"sugarG":{"max":36}}' }).filters, { sugarG: { max: 36 } });
});
test('serving keys bind extended nutrients, portion and composition evidence, even without a recipe signature change', () => {
  const input = { recipeSignature: 'a'.repeat(64), evidenceRevision: 1, nutrients: plateNutrients(base, base, 75), riceFoodId: 'rice', riceRevision: 1, pairedRiceG: 75 };
  const key = replacementServingKey(input);
  assert.equal(key, replacementServingKey({ ...input }));
  for (const patch of [{ pairedRiceG: 150 }, { riceRevision: 2 }, { evidenceRevision: 2 }, { nutrients: { ...input.nutrients, sodiumMg: null } }, { nutrients: { ...input.nutrients, sugarG: 10.0001 } }])
    assert.notEqual(key, replacementServingKey({ ...input, ...patch }));
});
test('only rejection accepts the recorded no-match outcome and holds automatic fallback', () => {
  const outcome = { kind: 'NO_SUITABLE_REPLACEMENT', searchReceipt: 'receipt' };
  assert.equal(nutritionistReviewActionSchema.safeParse({ action: 'reject', note: 'None suit the case.', replacementOutcome: outcome }).success, true);
  assert.equal(nutritionistReviewActionSchema.safeParse({ action: 'approve', replacementOutcome: outcome }).success, false);
  assert.equal(nutritionistReviewActionSchema.safeParse({ action: 'reject', note: 'Reason', replacementOutcome: { ...outcome, matchedCount: 0 } }).success, false);
  assert.equal(requiresExplicitReplacementReview({ status: 'REJECTED', selectionEvidence: { replacementOutcome: outcome } }), true);
  assert.equal(requiresExplicitReplacementReview({ status: 'APPROVED', selectionEvidence: { replacementOutcome: outcome } }), false);
  assert.equal(reviewSwapBodySchema.safeParse({ libraryMealId: 'meal', expectedVersion: 'a'.repeat(64), expectedRecipeSignature: 'b'.repeat(64), expectedEvidenceRevision: 1, expectedServingKey: 'c'.repeat(64), filters: { sodiumMg: { max: 10 } }, note: 'Recorded replacement.' }).success, true);
});

test('meal search combines name and ingredient terms with validated numeric bounds', async () => {
  const { matchesReviewMealSearch } = await import('../src/domain/review-meal-search.policy');
  assert.equal(matchesReviewMealSearch(' PORK  carrot ', 'Pork Lomi', ['carrots', 'noodles']), true);
  assert.equal(matchesReviewMealSearch('pork chicken', 'Pork Lomi', ['carrots']), false);
  assert.equal(matchesReviewMealSearch('cafe', 'Café soup', []), true);
  assert.equal(matchesReviewMealSearch('', 'Any recipe', []), true);
  const filters = { proteinG: { min: 35.7, max: 35.7 }, fatG: { max: 14.6 } };
  assert.equal(reviewSwapQuerySchema.safeParse({ search: 'pork', filters: JSON.stringify(filters) }).success, true);
  assert.equal(reviewSwapQuerySchema.safeParse({ search: 'x'.repeat(101) }).success, false);
  assert.equal(evaluateNutrientFilters(plateNutrients({ ...base, proteinG: 35.7, fatG: 14.6 }, null, null), filters).matches, true);
  assert.equal(evaluateNutrientFilters(plateNutrients({ ...base, proteinG: 35.7001, fatG: 14.6 }, null, null), filters).matches, true);
});

test('Exactly finds the complete-plate value shown to one decimal, including the reported sodium case', () => {
  const filters = { sodiumMg: { min: 466.8, max: 466.8 } };
  const plate = plateNutrients({ ...base, sodiumMg: 444.2819 }, { ...base, sodiumMg: 10 }, 225);
  assert.equal(plate.sodiumMg, 466.7819);
  assert.equal(Math.round(plate.sodiumMg! * 10) / 10, 466.8);
  assert.equal(evaluateNutrientFilters(plate, filters).matches, true);
  for (const value of [466.75, 466.799999, 466.8, 466.849999])
    assert.equal(evaluateNutrientFilters({ ...plate, sodiumMg: value }, filters).matches, true);
  for (const value of [466.749999, 466.85, 466.9, null])
    assert.equal(evaluateNutrientFilters({ ...plate, sodiumMg: value }, filters).matches, false);
  for (const key of REVIEW_NUTRIENTS)
    assert.equal(evaluateNutrientFilters({ ...plate, [key]: 35.7001 }, { [key]: { min: 35.7, max: 35.7 } }).matches, true);
});

test('inequalities, explicit extra precision, missing values and combined rules remain strict', () => {
  const plate = plateNutrients({ ...base, sodiumMg: 466.81 }, null, null);
  assert.equal(evaluateNutrientFilters(plate, { sodiumMg: { max: 466.8 } }).matches, false);
  assert.equal(evaluateNutrientFilters({ ...plate, sodiumMg: 466.79 }, { sodiumMg: { min: 466.8 } }).matches, false);
  assert.equal(evaluateNutrientFilters({ ...plate, sodiumMg: 466.8 }, { sodiumMg: { min: 466.8, max: 466.8, minExclusive: true } }).matches, false);
  assert.equal(evaluateNutrientFilters(plate, { sodiumMg: { min: 466.81, max: 466.81 } }).matches, true);
  assert.equal(evaluateNutrientFilters({ ...plate, sodiumMg: 466.810001 }, { sodiumMg: { min: 466.81, max: 466.81 } }).matches, false);
  assert.equal(evaluateNutrientFilters(plate, { sodiumMg: { min: 466.8, max: 466.8 }, sugarG: { max: 9.99 } }).matches, false);
  assert.deepEqual(evaluateNutrientFilters({ ...plate, sodiumMg: null }, { sodiumMg: { min: 0, max: 0 } }), { matches: false, unknown: ['sodiumMg'] });
});
