import assert from 'node:assert/strict';
import test from 'node:test';
import { screenFoodExclusions } from '../src/domain/food-exclusion.policy';
import { validateGeneratedMealCandidate } from '../src/domain/generated-meal-validation.policy';
import { canReviewDeclarationAsRecorded } from '../src/domain/profile-declaration-review.policy';

test('source and AI candidates cannot substitute pork aliases or uncertain animal ingredients', () => {
  for (const name of ['pork belly', 'baboy', 'liempo', 'ham', 'bacon', 'lard', 'longganisa']) {
    const result = validateGeneratedMealCandidate({
      ingredients: [{ name }],
      dietaryPreference: 'OMNIVORE',
      allergens: [],
      customAllergies: ['PORK'],
    });
    assert.equal(result.accepted, false, name);
    assert.ok(result.definiteConflicts.includes('FOOD_EXCLUSION_PORK'));
  }
  for (const name of ['sausage', 'meat broth', 'gelatin', 'Mystery ingredient']) {
    assert.equal(screenFoodExclusions([{ name }], ['PORK']).complete, false, name);
    assert.equal(
      validateGeneratedMealCandidate({
        ingredients: [{ name }],
        dietaryPreference: 'OMNIVORE',
        allergens: [],
        customAllergies: ['PORK'],
      }).accepted,
      false
    );
  }
  assert.equal(screenFoodExclusions([{ name: 'rice', compositionFoodName: 'Pork' }], ['PORK']).conflicts[0], 'PORK');
  assert.deepEqual(screenFoodExclusions([{ name: 'chicken' }, { name: 'ginger' }], ['PORK', 'BEEF']), {
    conflicts: [],
    complete: true,
  });
  assert.equal(
    validateGeneratedMealCandidate({
      ingredients: [{ name: 'shrimp' }],
      dietaryPreference: 'OMNIVORE',
      allergens: ['SHELLFISH'],
      customAllergies: ['PORK'],
    }).accepted,
    false
  );
});

test('reviewing as recorded is available only for named pending declarations, never vague or invalid data', () => {
  for (const domain of ['CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'])
    assert.equal(
      canReviewDeclarationAsRecorded({ domain, displayName: 'Named declaration', supportState: 'PENDING_REVIEW' }),
      true
    );
  for (const supportState of ['NEEDS_CLARIFICATION', 'INVALID', 'UNKNOWN', 'SUPPORTED'])
    assert.equal(
      canReviewDeclarationAsRecorded({ domain: 'CONDITION', displayName: 'Named declaration', supportState }),
      false
    );
  assert.equal(
    canReviewDeclarationAsRecorded({ domain: 'CONDITION', displayName: ' ', supportState: 'PENDING_REVIEW' }),
    false
  );
});
