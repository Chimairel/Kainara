import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresMealCandidateReview } from '../src/domain/meal-candidate-review.policy';
import { requiresIndividualPlanningReview } from '../src/domain/planning-membership.policy';
import { adaptUserSafetyRestrictions } from '../src/domain/structured-restriction.adapter';
import { classifyMealIngredients } from '../src/domain/meal-ingredient-classification.policy';

test('known allergies admit pending candidates without changing membership/profile review requirements', () => {
  for (const allergens of [
    ['SHELLFISH'],
    ['EGGS', 'DAIRY', 'NUTS'],
    ['EGGS', 'DAIRY', 'NUTS', 'GLUTEN', 'SHELLFISH'],
  ]) {
    const restrictions = adaptUserSafetyRestrictions({ allergies: allergens });
    assert.equal(requiresIndividualPlanningReview(restrictions), false);
    assert.equal(requiresMealCandidateReview(restrictions), true);
  }
  assert.equal(requiresMealCandidateReview(adaptUserSafetyRestrictions({})), false);
  assert.equal(requiresMealCandidateReview(adaptUserSafetyRestrictions({ healthConditions: ['DIABETES'] })), true);
});

test('source taho plant ingredients are recognized; animal additions and unknowns stay conservative', () => {
  const taho = ['soft silken tofu', 'sago pearls (Note 1)', 'water', 'brown sugar', 'vanilla extract'];
  const classify = (names: string[]) => classifyMealIngredients(names.map((name) => ({ name })));
  assert.ok(classify(taho).compatibleDietaryPreferences.includes('VEGAN'));
  assert.equal(classify([...taho, 'condensed milk']).compatibleDietaryPreferences.includes('VEGAN'), false);
  assert.ok(classify([...taho, 'egg']).detectedAllergens.includes('EGGS'));
  assert.equal(classify([...taho, 'mystery topping']).status, 'NEEDS_REVIEW');
});
