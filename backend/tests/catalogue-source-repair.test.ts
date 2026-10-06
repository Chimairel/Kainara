import assert from 'node:assert/strict';
import test from 'node:test';
import { recoverSourceIngredientIdentity } from '../src/domain/source-ingredient-identity-recovery.policy';
import { effectiveRecipeMealTypes, proposeMealTypeApplicability } from '../src/domain/meal-applicability.policy';
import { classifyMealIngredients } from '../src/domain/meal-ingredient-classification.policy';
import { rawRecipeServing } from '../src/services/raw-recipe-serving.service';
import type { RecipeCandidateProjection } from '../src/services/recipe-candidate-provider';
import { sourceRecipeNutritionReviewHold } from '../src/domain/source-recipe-review-holds.policy';
import { validateGeneratedMealCandidate } from '../src/domain/generated-meal-validation.policy';
import { parseRecipeCandidateIngredients } from '../src/services/panlasang-recipe-candidate.provider';

test('source parser food units restore actual egg/bacon/shellfish identities without changing portions', () => {
  for (const [name, unit, quantity, expected] of [
    ['(beaten)', 'eggs', 1.5, 'EGGS'],
    ['yolks', 'egg', 0.5, 'EGGS'],
    ['(cleaned)', 'squid', 0.6, 'SHELLFISH'],
    ['(deveined)', 'shrimp', 12, 'SHELLFISH'],
  ] as const) {
    const result = recoverSourceIngredientIdentity({ name, unit, quantity, excludedFromPlanning: true });
    assert.equal(result.recovered, true);
    assert.equal(result.ingredient.quantity, quantity);
    assert.equal(result.ingredient.unit, 'piece');
    assert.equal(result.ingredient.excludedFromPlanning, false);
    assert.ok(classifyMealIngredients([result.ingredient]).detectedAllergens.includes(expected));
    assert.equal(recoverSourceIngredientIdentity(result.ingredient).recovered, false);
  }
  const bacon = recoverSourceIngredientIdentity({ name: 'strips (chopped)', unit: 'bacon', quantity: 1 });
  assert.equal(bacon.ingredient.unit, 'strip');
  assert.equal(classifyMealIngredients([bacon.ingredient]).compatibleDietaryPreferences.includes('VEGETARIAN'), false);
});

test('identity recovery cannot invent eggs from an omelet title, unknown unit, or zero quantity', () => {
  for (const ingredient of [
    { name: '(beaten)', unit: 'cup', quantity: 1 },
    { name: 'omelet', unit: null, quantity: 1 },
    { name: '(beaten)', unit: 'eggs', quantity: 0 },
    { name: 'coconut milk', unit: 'cup', quantity: 1 },
  ])
    assert.deepEqual(recoverSourceIngredientIdentity(ingredient), { ingredient, recovered: false });
});

test('the production source-candidate gate rejects the restored egg for an egg-allergic member', () => {
  const malformed = { name: '(beaten)', unit: 'eggs', quantity: 1.5, excludedFromPlanning: true };
  const recovered = recoverSourceIngredientIdentity(malformed).ingredient;
  const ingredients = parseRecipeCandidateIngredients([recovered]);
  const result = validateGeneratedMealCandidate({ ingredients, dietaryPreference: 'OMNIVORE', allergens: ['EGGS'] });
  assert.equal(result.accepted, false);
  assert.ok(result.definiteConflicts.includes('ALLERGEN_EGGS'));
  assert.equal(
    validateGeneratedMealCandidate({ ingredients, dietaryPreference: 'OMNIVORE', allergens: [] }).accepted,
    true
  );
});

test('confirmed source nutrition discrepancies remain held on reimport, without holding other recipes', () => {
  assert.ok(sourceRecipeNutritionReviewHold('https://panlasangpinoy.com/tortilla-espanola-potato-omelet-recipe/'));
  assert.ok(sourceRecipeNutritionReviewHold('https://panlasangpinoy.com/shrimp-and-vegetable-fried-rice/'));
  assert.equal(sourceRecipeNutritionReviewHold('https://panlasangpinoy.com/eggplant-and-ground-chicken-omelet/'), null);
});

test('plurals, crabmeat, named wheat pasta and cheese cannot evade ingredient screening', () => {
  for (const name of ['crabmeat', 'clams', 'scallops', 'lobsters', 'pusit'])
    assert.ok(classifyMealIngredients([{ name }]).detectedAllergens.includes('SHELLFISH'));
  for (const name of ['fettuccine', 'linguine', 'rotini', 'spaghetti', 'pancit canton', 'pancit bato'])
    assert.ok(classifyMealIngredients([{ name }]).detectedAllergens.includes('GLUTEN'));
  for (const name of ['Parmesan', 'ricotta', 'cheddar'])
    assert.ok(classifyMealIngredients([{ name }]).detectedAllergens.includes('DAIRY'));
  for (const name of ['thin rice noodles', 'glass noodles (sotanghon)', 'rice flour', 'coconut milk'])
    assert.equal(classifyMealIngredients([{ name }]).detectedAllergens.includes('DAIRY'), false);
  assert.equal(classifyMealIngredients([{ name: 'thin rice noodles' }]).detectedAllergens.includes('GLUTEN'), false);
});

test('source components never become whole meals; full meals with sauce remain eligible', () => {
  for (const name of [
    'Asian Dipping Sauce Recipe',
    'Recipe for Barbecue Chicken Marinade',
    'Flank Steak Marinade',
    'How to Make Toasted Garlic',
    'How to Caramelize Onions',
    'How to Make Mayonnaise',
    'Home Fries Recipe',
  ]) {
    assert.deepEqual(effectiveRecipeMealTypes(name, null, ['LUNCH', 'DINNER']), []);
    assert.deepEqual(proposeMealTypeApplicability({ name, primaryMealType: 'LUNCH' }), []);
    const candidate = {
      displayName: name,
      category: null,
      state: 'ACTIVE',
      applicableMealTypes: ['LUNCH'],
      provenance: 'PANLASANG_PINOY',
      nutrition: { calories: 700, proteinG: 20, carbsG: 100, fatG: 20 },
      ingredients: [],
      riceRole: 'STANDALONE',
      riceRoleReviewStatus: 'PROPOSED',
    } as unknown as RecipeCandidateProjection;
    assert.equal(rawRecipeServing({ candidate, mealType: 'LUNCH', dailyCalorieTarget: 2000 }), null);
  }
  for (const name of [
    'Chicken Adobo',
    'Chicken with Garlic Sauce',
    'Pasta with Tomato Sauce',
    'Grilled Chicken with Marinade',
  ])
    assert.deepEqual(effectiveRecipeMealTypes(name, null, ['LUNCH', 'DINNER']), ['LUNCH', 'DINNER']);
  for (const name of ['Carioca', 'Binatog Recipe', 'Ginataang Mais at Malagkit', 'Roasted Pumpkin Seeds'])
    assert.deepEqual(effectiveRecipeMealTypes(name, null, ['LUNCH']), ['SNACK']);
});
