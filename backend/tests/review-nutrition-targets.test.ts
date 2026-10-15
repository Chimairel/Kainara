import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewNutritionTargets } from '../src/domain/review-nutrition-targets.policy';
import { calculatePlanningMacroTargets } from '../src/domain/meal-macro-target.policy';

const daily = calculatePlanningMacroTargets({ dailyCalorieTarget: 2000, age: 30, restricted: true })!;
const rule = {
  id: 'reviewed', nutrient: 'SODIUM_MG', operator: 'LESS_THAN', threshold: 2000, unit: 'mg',
  basis: 'DAILY_TOTAL', severity: 'WARNING', reviewStatus: 'APPROVED', active: true,
  approvedByNutritionistId: 'rnd', condition: 'HYPERTENSION', sourceTitle: 'Recorded source',
  evidenceSource: { state: 'CURRENT', canonicalUrl: 'https://example.test/recorded-rule' },
};
test('saved report references retain their original value and explanation without becoming an approved rule', () => {
  const result = reviewNutritionTargets({ dailyTargets: daily, mealType: 'LUNCH', rules: [], referenceItems: [
    { heading: 'Sodium reference for DASH', value: '2,300 mg/day', explanation: 'Clinician selects the appropriate target.',
      sourceTitle: 'Saved reference', sourceUrl: 'https://example.test/dash' },
    { heading: 'Unknown reference', value: '9999 mg/day' },
  ] });
  assert.equal(result.rules.length, 0);
  assert.deepEqual(result.guidance, [{ nutrient: 'sodiumMg', value: '2,300 mg/day', explanation: 'Clinician selects the appropriate target.',
    sourceTitle: 'Saved reference', sourceUrl: 'https://example.test/dash' }]);
});
test('planning macro references use the existing slot policy; daily sodium is never divided into a meal limit', () => {
  const result = reviewNutritionTargets({ dailyTargets: daily, mealType: 'LUNCH', rules: [rule] });
  assert.equal(result.daily?.calories, 2000);
  assert.equal(result.meal?.calories, 800);
  assert.equal(result.meal?.proteinG, daily.proteinG * 0.4);
  assert.deepEqual(result.rules[0], { nutrient: 'sodiumMg', value: 2000, operator: 'LESS_THAN', unit: 'mg/day',
    basis: 'DAY', condition: 'HYPERTENSION', sourceTitle: rule.sourceTitle, sourceUrl: rule.evidenceSource.canonicalUrl });
});
test('absent targets and inactive, unapproved, or withdrawn evidence stay unset', () => {
  const result = reviewNutritionTargets({ dailyTargets: null, mealType: 'LUNCH', rules: [
    { ...rule, active: false }, { ...rule, reviewStatus: 'DRAFT' }, { ...rule, approvedByNutritionistId: null },
    { ...rule, evidenceSource: { ...rule.evidenceSource, state: 'WITHDRAWN' } },
    { ...rule, basis: 'UNKNOWN' }, { ...rule, nutrient: 'UNKNOWN' },
  ] });
  assert.equal(result.meal, null); assert.equal(result.daily, null); assert.deepEqual(result.rules, []);
});
test('dynamic reviewed rules use saved daily energy or body weight and preserve their basis', () => {
  const result = reviewNutritionTargets({ dailyTargets: daily, mealType: 'DINNER', bodyWeightKg: 60, rules: [
    { ...rule, nutrient: 'SATURATED_FAT_G', threshold: 6, basis: 'PERCENT_OF_DAILY_CALORIES', unit: '%' },
    { ...rule, nutrient: 'PROTEIN_G', threshold: 0.8, basis: 'PER_KG_BODY_WEIGHT_DAILY', unit: 'g' },
    { ...rule, threshold: 600, basis: 'PER_SERVING' },
  ] });
  assert.equal(result.rules[0].value, 2000 * 0.06 / 9);
  assert.equal(result.rules[0].unit, 'g/day');
  assert.equal(result.rules[1].value, 48);
  assert.equal(result.rules[2].basis, 'MEAL');
  assert.equal(result.rules[2].unit, 'mg/serving');
});

test('macro references retain saved daily ranges and sources without deriving meal thresholds', () => {
  const references = [
    { heading: 'Protein reference', value: '50–75 g/day' },
    { heading: 'Fat reference', value: '33.3–66.7 g/day' },
    { heading: 'Carbohydrate reference', value: '275–375 g/day' },
  ].map(item => ({ ...item, explanation: 'Saved daily population range.', sourceTitle: 'Saved report source', sourceUrl: 'https://example.test/pdri' }));
  const result = reviewNutritionTargets({ dailyTargets: daily, mealType: 'LUNCH', rules: [], referenceItems: references });
  assert.deepEqual(result.guidance.map(item => [item.nutrient, item.value]), [
    ['proteinG', '50–75 g/day'], ['fatG', '33.3–66.7 g/day'], ['carbsG', '275–375 g/day'],
  ]);
  assert.equal(result.meal?.proteinG, daily.proteinG * 0.4);
  assert.equal(result.guidance[0].sourceUrl, references[0].sourceUrl);
  assert.equal(result.rules.length, 0);
  assert.deepEqual(reviewNutritionTargets({ dailyTargets: daily, mealType: 'LUNCH', rules: [] }).guidance, []);
});
