import assert from 'node:assert/strict';
import test from 'node:test';
import { MealType, RecipeRiceRole } from '@prisma/client';
import { proposeRiceRole, resolveRecipeRiceRole } from '../src/domain/recipe-rice-role.policy';
import { effectiveRecipeMealTypes, proposeMealTypeApplicability } from '../src/domain/meal-applicability.policy';
import { rawRecipeServing } from '../src/services/raw-recipe-serving.service';
import { resolveReplacementServing } from '../src/services/meal-swap-serving.service';
import type { CertifiedLibraryMeal } from '../src/services/meal-library-candidate-query.service';
import type { RecipeCandidateProjection } from '../src/services/recipe-candidate-provider';
import { projectRawRecipeCandidate } from '../src/services/panlasang-recipe-candidate.provider';

const ingredients = [{ name: 'Egg', quantity: 100, unit: 'g' }];
for (const name of [
  'Brownies with Walnuts',
  'Chocolate Cupcake Recipe',
  'Buttered Puto',
  'Brownies Recipe',
  'Binignit Recipe',
  'Bibingka',
  'Leche Flan',
  'Sapin-sapin',
]) {
  test(`${name} is not an ulam or a primary-meal replacement despite stale lunch/dinner labels`, () => {
    assert.equal(proposeRiceRole({ name, ingredients }).riceRole, RecipeRiceRole.STANDALONE);
    assert.deepEqual(effectiveRecipeMealTypes(name, null, [MealType.LUNCH, MealType.DINNER]), [MealType.SNACK]);
    assert.deepEqual(proposeMealTypeApplicability({ name, primaryMealType: MealType.LUNCH }), [MealType.SNACK]);
    const meal = {
      mealName: name,
      riceRole: 'PAIR_WITH_RICE',
      riceRoleReviewStatus: 'REVIEWED',
      includedRiceG: null,
      riceMinHalfCups: 1,
      riceMaxHalfCups: 3,
      ingredients: [{ ingredientName: 'Egg', quantity: 100, unit: 'g' }],
      applicableMealTypes: [{ mealType: 'LUNCH' }],
      calories: 600,
      proteinG: 10,
      carbsG: 80,
      fatG: 25,
    } as unknown as CertifiedLibraryMeal;
    // Primary-slot admission is separate; rice resolution does not rewrite a stored label.
    assert.equal(resolveRecipeRiceRole(meal).riceRole, RecipeRiceRole.PAIR_WITH_RICE);
    assert.equal(
      resolveReplacementServing({
        meal,
        mealType: 'LUNCH',
        dailyTarget: 1500,
        ricePreference: 'FLEXIBLE',
        hasConditions: false,
        riceFood: null,
      }),
      null
    );
    const candidate = {
      displayName: name,
      category: null,
      ingredients,
      applicableMealTypes: [MealType.LUNCH, MealType.DINNER],
      state: 'ACTIVE',
      provenance: 'PANLASANG_PINOY',
      nutrition: { calories: 600, proteinG: 10, carbsG: 80, fatG: 25 },
    } as RecipeCandidateProjection;
    assert.equal(rawRecipeServing({ candidate, mealType: 'LUNCH', dailyCalorieTarget: 1500 }), null);
  });
}

test('noodle dishes are standalone and savory fishcake/adobo retain their suitability', () => {
  for (const name of ['Garlic Bihon Recipe', 'Pancit Canton', 'Sotanghon Soup', 'Spaghetti']) {
    assert.equal(proposeRiceRole({ name, ingredients }).riceRole, 'STANDALONE');
    assert.deepEqual(effectiveRecipeMealTypes(name, null, [MealType.LUNCH, MealType.DINNER]), [
      MealType.LUNCH,
      MealType.DINNER,
    ]);
  }
  for (const name of ['Dulong Fishcake', 'Fish Cakes', 'Chicken Adobo', 'Pineapple Chicken']) {
    assert.equal(proposeRiceRole({ name, ingredients }).riceRole, 'PAIR_WITH_RICE');
    assert.deepEqual(effectiveRecipeMealTypes(name, null, [MealType.LUNCH]), [MealType.LUNCH]);
  }
  assert.equal(
    proposeRiceRole({ name: 'Arroz Caldo', ingredients: [{ name: 'Cooked rice', quantity: 150, unit: 'g' }] }).riceRole,
    'INCLUDES_RICE'
  );
});

test('raw servings cannot turn a breakfast-only recipe into a dinner replacement', () => {
  const candidate = {
    displayName: 'Breakfast egg dish',
    ingredients,
    applicableMealTypes: [MealType.BREAKFAST],
    state: 'ACTIVE',
    provenance: 'PANLASANG_PINOY',
    nutrition: { calories: 600, proteinG: 30, carbsG: 40, fatG: 20 },
  } as RecipeCandidateProjection;
  assert.equal(rawRecipeServing({ candidate, mealType: MealType.DINNER, dailyCalorieTarget: 2000 }), null);
  const meal = {
    mealName: 'Breakfast egg dish',
    applicableMealTypes: [{ mealType: 'BREAKFAST' }],
  } as unknown as CertifiedLibraryMeal;
  assert.equal(
    resolveReplacementServing({
      meal,
      mealType: 'DINNER',
      dailyTarget: 2000,
      ricePreference: 'FLEXIBLE',
      hasConditions: false,
      riceFood: null,
    }),
    null
  );
});

test('source projection preserves the saved rice label while narrowing stale dessert meal times', () => {
  const row = {
    id: 'brownie',
    recipeName: 'Brownies with Walnuts',
    normalizedName: 'brownies with walnuts',
    sourceName: 'PANLASANG_PINOY',
    status: 'AVAILABLE',
    category: null,
    calories: 600,
    proteinG: 10,
    carbsG: 80,
    fatG: 25,
    ingredients,
    publishedNutrition: { calories: 600 },
    applicableMealTypes: [{ mealType: 'LUNCH' }, { mealType: 'DINNER' }],
    dietaryTags: ['OMNIVORE'],
    riceRole: 'PAIR_WITH_RICE',
  } as unknown as Parameters<typeof projectRawRecipeCandidate>[0];
  const projected = projectRawRecipeCandidate(row);
  assert.deepEqual(projected.applicableMealTypes, [MealType.SNACK]);
  assert.equal(projected.riceRole, 'PAIR_WITH_RICE');
  assert.equal(row.riceRole, 'PAIR_WITH_RICE');
  assert.deepEqual(
    row.applicableMealTypes.map((entry) => entry.mealType),
    [MealType.LUNCH, MealType.DINNER]
  );
});
