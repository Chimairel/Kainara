import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGeneratedMealCandidate } from '../src/domain/generated-meal-validation.policy';
import { classifyMealIngredients } from '../src/domain/meal-ingredient-classification.policy';
import prisma from '../src/lib/prisma';
import { prepareGeneratedMealIngredients } from '../src/services/meal-generation-ingredient-preparation.service';

test('FNRI mixed fish category does not turn finfish into a shellfish ingredient', () => {
  const ingredients = [{ name: 'tuna', category: 'Fish & Shellfish', compositionFoodName: 'Tuna, canned in brine' }];
  const classification = classifyMealIngredients(ingredients);
  assert.deepEqual(classification.detectedAllergens, []);
  assert.equal(classification.compatibleDietaryPreferences.includes('VEGETARIAN'), false);
  assert.equal(
    validateGeneratedMealCandidate({ ingredients, allergens: ['SHELLFISH'], dietaryPreference: 'OMNIVORE' }).accepted,
    true
  );
});

test('explicit or mapped shellfish remains blocked inside the broad FNRI group', () => {
  for (const name of ['shrimp', 'prawn', 'crab', 'squid', 'oyster sauce']) {
    for (const ingredient of [
      { name, category: 'Fish & Shellfish' },
      { name: 'seafood stock', category: 'Fish & Shellfish', compositionFoodName: name },
    ]) {
      const result = validateGeneratedMealCandidate({
        ingredients: [ingredient],
        allergens: ['SHELLFISH'],
        dietaryPreference: 'OMNIVORE',
      });
      assert.equal(result.accepted, false);
      assert.ok(result.definiteConflicts.includes('ALLERGEN_SHELLFISH'));
    }
  }
});

test('a broad seafood category alone does not classify an unidentified ingredient as complete', () => {
  const result = classifyMealIngredients([{ name: 'proprietary house mix', category: 'Fish & Shellfish' }]);
  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.deepEqual(result.compatibleDietaryPreferences, ['OMNIVORE']);
});

test('generation ingredient hydration accepts finfish in the mixed group while rejecting mapped shellfish', async (context) => {
  let compositionName = 'Tuna, canned in brine';
  const originalFindMany = prisma.foodItem.findMany;
  context.after(() => {
    prisma.foodItem.findMany = originalFindMany;
  });
  prisma.foodItem.findMany = (async () => [
    {
      id: 'fixture-fish',
      name: compositionName,
      category: 'Fish & Shellfish',
      source: 'FNRI',
      compositionRevision: 1,
      calories: 100,
      proteinG: 20,
      carbsG: 0,
      fatG: 2,
    },
  ]) as unknown as typeof prisma.foodItem.findMany;
  const input = {
    meals: [
      {
        dayNumber: 1,
        mealType: 'LUNCH' as const,
        mealName: 'Fixture fish plate',
        description: 'Synthetic regression',
        calories: 100,
        proteinG: 20,
        carbsG: 0,
        fatG: 2,
        candidateProvenance: 'RAW_RECIPE_CORPUS' as const,
        ingredients: [{ name: 'fish', foodItemId: 'fixture-fish', quantity: 100, unit: 'g' }],
      },
    ],
    unmatchedSlots: [{ dayNumber: 1, mealType: 'LUNCH' as const, scheduledDate: new Date('2026-10-16T04:00:00Z') }],
    startDate: new Date('2026-10-16T04:00:00Z'),
    userHasConditions: false,
    groundedFoodById: new Map(),
    restrictions: { dietaryPreference: 'OMNIVORE' as const, allergens: ['SHELLFISH'] },
  };
  const result = await prepareGeneratedMealIngredients(input);
  assert.equal(result.preparedMeals.length, 1);
  assert.equal(result.preparedMeals[0].ingredientsData[0].foodItemId, 'fixture-fish');
  assert.notEqual(result.preparedMeals[0].aiConfidenceFlag, 'SAFE');
  compositionName = 'Shrimp, cooked';
  await assert.rejects(prepareGeneratedMealIngredients(input), /DEFINITE_CONFLICT: ALLERGEN_SHELLFISH/);
});

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
