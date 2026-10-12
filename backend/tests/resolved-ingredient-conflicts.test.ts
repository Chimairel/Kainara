import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGeneratedMealCandidate } from '../src/domain/generated-meal-validation.policy';

test('mapped noodle broth cannot enter a gluten-restricted plan under a generic broth label', () => {
  const result = validateGeneratedMealCandidate({
    ingredients: [{ name: 'chicken broth', compositionFoodName: 'Chicken noodle broth, inst' }],
    allergens: ['GLUTEN'],
    dietaryPreference: 'OMNIVORE',
  });
  assert.equal(result.accepted, false);
  assert.deepEqual(result.definiteConflicts, ['ALLERGEN_GLUTEN']);
});

test('a mapped food cannot hide an explicit source allergen or dietary conflict', () => {
  assert.equal(
    validateGeneratedMealCandidate({
      ingredients: [{ name: 'butter', compositionFoodName: 'Vegetable oil' }],
      allergens: ['DAIRY'],
      dietaryPreference: 'OMNIVORE',
    }).accepted,
    false
  );
  assert.equal(
    validateGeneratedMealCandidate({
      ingredients: [{ name: 'broth', compositionFoodName: 'Chicken broth' }],
      allergens: [],
      dietaryPreference: 'VEGAN',
    }).accepted,
    false
  );
  assert.equal(
    validateGeneratedMealCandidate({
      ingredients: [{ name: 'water', compositionFoodName: 'Coconut water' }],
      allergens: ['GLUTEN'],
      dietaryPreference: 'VEGAN',
    }).accepted,
    true
  );
});
