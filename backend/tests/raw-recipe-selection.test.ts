import assert from 'node:assert/strict';
import test from 'node:test';
import { DietaryPreference, MealType } from '@prisma/client';
import {
  fillRepeatedRawRecipeSlots,
  selectRawRecipeCandidates,
  sourceRawRecipeCandidates,
} from '../src/services/raw-recipe-candidate.service';
import type { RecipeCandidateProjection } from '../src/services/recipe-candidate-provider';
import { databaseRecipeCandidateProvider } from '../src/services/panlasang-recipe-candidate.provider';
import { parseRecipeCandidateIngredients } from '../src/services/panlasang-recipe-candidate.provider';

function candidate(
  id: string,
  name: string,
  ingredient: string,
  signature = id
): RecipeCandidateProjection & {
  _ranking: { score: number; reasonCodes: [] };
} {
  return {
    id,
    providerRecordId: id,
    provenance: 'PANLASANG_PINOY',
    displayName: name,
    normalizedName: name.toLowerCase(),
    category: null,
    description: null,
    contentSignature: signature,
    sourceUrl: 'https://example.invalid/recipe',
    applicableMealTypes: [MealType.LUNCH],
    dietaryTags: [DietaryPreference.OMNIVORE],
    ingredients: [{ name: ingredient, quantity: 100, unit: 'g' }],
    ingredientsComplete: true,
    nutrition: { calories: 600, proteinG: 30, carbsG: 40, fatG: 20 },
    servingDescription: null,
    riceRole: null,
    imageUrl: null,
    videoUrl: null,
    state: 'ACTIVE',
    _ranking: { score: 50, reasonCodes: [] },
  };
}

test('one-day worker turns retain recipe variety across all seven saved days', async () => {
  const originalList = databaseRecipeCandidateProvider.list;
  const types = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];
  const saved: Array<{ rawCandidateId: string; contentSignature: string; mealType: MealType; dayNumber: number }> = [];
  databaseRecipeCandidateProvider.list = async (request) => ({
    items:
      request.sourceKind === 'USER_OBSERVED'
        ? []
        : Array.from({ length: 7 }, (_, i) => ({
            ...candidate(`${request.mealType}-${i}`, `Dish ${request.mealType}-${i}`, 'chicken'),
            applicableMealTypes: [request.mealType!],
            nutrition: {
              calories: request.mealType === MealType.LUNCH ? 800 : 600,
              proteinG: 30,
              carbsG: 75,
              fatG: 20,
            },
          })),
    nextCursor: null,
  });
  try {
    for (let dayNumber = 1; dayNumber <= 7; dayNumber++) {
      const result = await sourceRawRecipeCandidates({
        slots: types.map((mealType) => ({
          dayNumber,
          mealType,
          scheduledDate: new Date(`2031-01-0${dayNumber}T00:00:00Z`),
        })),
        dailyCalorieTarget: 2000,
        planningTargets: {
          calories: 2000,
          proteinG: 90,
          carbsG: 225,
          fatG: 60,
          goal: 'MAINTAIN',
          policyVersion: 'MEAL_MACRO_PLANNING_V1',
          basis: 'GENERAL_ADULT_ESTIMATE',
          explanation: 'Software fixture',
        },
        existingRecipes: saved,
        dietaryPreference: DietaryPreference.OMNIVORE,
        conditions: [],
        allergens: [],
        ricePreference: 'NO_RICE',
      });
      assert.equal(result.remainingSlots.length, 0);
      assert.equal(result.meals.length, 3);
      for (const meal of result.meals) {
        assert.ok(
          !saved.some((previous) => previous.rawCandidateId === meal.rawCandidateId),
          `repeated ${meal.rawCandidateId} on day ${dayNumber}`
        );
        saved.push({ ...meal, contentSignature: meal.rawCandidateId, mealType: meal.mealType });
      }
    }
    assert.equal(new Set(saved.map((meal) => meal.rawCandidateId)).size, 21);
  } finally {
    databaseRecipeCandidateProvider.list = originalList;
  }
});

test('saved worker recipes exclude both their identities and duplicate content signatures', () => {
  const options = [
    candidate('used', 'Used', 'chicken', 'same'),
    candidate('alias', 'Duplicate', 'chicken', 'same'),
    candidate('new', 'Fresh', 'pork'),
  ];
  const result = selectRawRecipeCandidates({
    slots: [{ dayNumber: 2, mealType: MealType.LUNCH, scheduledDate: new Date() }],
    candidatesByType: new Map([[MealType.LUNCH, options]]),
    existingRecipes: [{ rawCandidateId: 'used', contentSignature: 'same', mealType: MealType.LUNCH, dayNumber: 1 }],
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergens: [],
  });
  assert.equal(result.meals[0].rawCandidateId, 'new');
});

test('exhausted worker pools rotate using saved counts and still reject allergen conflicts', () => {
  const options = [
    candidate('a', 'First', 'chicken'),
    candidate('b', 'Second', 'pork'),
    candidate('blocked', 'Shrimp', 'shrimp'),
  ];
  const result = fillRepeatedRawRecipeSlots({
    slots: [{ dayNumber: 4, mealType: MealType.LUNCH, scheduledDate: new Date() }],
    selected: [],
    existingRecipes: [
      { rawCandidateId: 'a', contentSignature: 'a', mealType: MealType.LUNCH, dayNumber: 1 },
      { rawCandidateId: 'a', contentSignature: 'a', mealType: MealType.LUNCH, dayNumber: 2 },
      { rawCandidateId: 'b', contentSignature: 'b', mealType: MealType.LUNCH, dayNumber: 3 },
    ],
    candidatesByType: new Map([[MealType.LUNCH, options]]),
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergens: ['SHELLFISH'],
  });
  assert.equal(result.meals[0].rawCandidateId, 'b');
});

test('raw selection skips definite allergen conflicts and exact duplicate signatures', () => {
  const slot = (dayNumber: number) => ({
    dayNumber,
    mealType: MealType.LUNCH,
    scheduledDate: new Date('2031-01-01T00:00:00Z'),
  });
  const selected = selectRawRecipeCandidates({
    slots: [slot(1), slot(2), slot(3)],
    candidatesByType: new Map([
      [
        MealType.LUNCH,
        [
          candidate('a', 'Shrimp dish', 'shrimp'),
          candidate('b', 'Chicken dish', 'chicken', 'same-chicken'),
          candidate('c', 'Chicken copy', 'chicken', 'same-chicken'),
          candidate('d', 'Pork dish', 'pork'),
        ],
      ],
    ]),
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergens: ['SHELLFISH'],
  });
  assert.deepEqual(
    selected.meals.map((meal) => meal.rawCandidateId),
    ['b', 'd']
  );
  assert.deepEqual(
    selected.remainingSlots.map((remaining) => remaining.dayNumber),
    [3]
  );
  assert.equal(selected.meals[0].candidateRank, 2);
});

test('a source number without a unit remains an unmeasured grocery ingredient', () => {
  assert.deepEqual(
    parseRecipeCandidateIngredients([
      { name: 'salt', quantity: 1, unit: 'tsp' },
      { name: 'salt', quantity: 2, unit: null },
    ]).map(({ name, quantity, unit }) => ({ name, quantity, unit })),
    [
      { name: 'salt', quantity: 1, unit: 'tsp' },
      { name: 'salt', quantity: undefined, unit: undefined },
    ]
  );
});

test('raw selection does not treat a dietary tag or blank ingredient list as sufficient', () => {
  const invalid = candidate('a', 'Unspecified', 'chicken');
  invalid.ingredients = [];
  const wrongDiet = candidate('b', 'Tagged otherwise', 'chicken');
  wrongDiet.dietaryTags = [DietaryPreference.VEGAN];
  const selected = selectRawRecipeCandidates({
    slots: [{ dayNumber: 1, mealType: MealType.LUNCH, scheduledDate: new Date() }],
    candidatesByType: new Map([[MealType.LUNCH, [invalid, wrongDiet]]]),
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergens: [],
  });
  assert.equal(selected.meals.length, 0);
  assert.equal(selected.remainingSlots.length, 1);
});

test('review-free sourcing skips incomplete recipes without sending them to nutritionists', () => {
  const incomplete = candidate('a', 'Incomplete source', 'chicken');
  incomplete.reviewFreeBaseEligible = false;
  const complete = candidate('b', 'Measured source', 'chicken');
  complete.reviewFreeBaseEligible = true;
  const selected = selectRawRecipeCandidates({
    slots: [{ dayNumber: 1, mealType: MealType.LUNCH, scheduledDate: new Date() }],
    candidatesByType: new Map([[MealType.LUNCH, [incomplete, complete]]]),
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergens: [],
    reviewFreeBaseOnly: true,
  });
  assert.deepEqual(
    selected.meals.map((meal) => meal.rawCandidateId),
    ['b']
  );
});

test('a new cycle selects a different eligible source before a recently used recipe', () => {
  const options = [candidate('a', 'First', 'chicken'), candidate('b', 'Second', 'pork')];
  const selected = selectRawRecipeCandidates({
    slots: [{ dayNumber: 1, mealType: MealType.LUNCH, scheduledDate: new Date() }],
    candidatesByType: new Map([[MealType.LUNCH, options]]),
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergens: [],
    recentCandidateIds: ['a'],
  });
  assert.equal(selected.meals[0].rawCandidateId, 'b');
});

test('limited eligible recipes rotate only after distinct candidates are exhausted', () => {
  const options = [candidate('a', 'First', 'chicken'), candidate('b', 'Second', 'pork')];
  const slots = [1, 2, 3, 4].map((dayNumber) => ({
    dayNumber,
    mealType: MealType.LUNCH,
    scheduledDate: new Date(`2031-01-0${dayNumber}T00:00:00Z`),
  }));
  const unique = selectRawRecipeCandidates({
    slots,
    candidatesByType: new Map([[MealType.LUNCH, options]]),
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergens: [],
  });
  const repeated = fillRepeatedRawRecipeSlots({
    slots: unique.remainingSlots,
    selected: unique.meals,
    candidatesByType: new Map([[MealType.LUNCH, options]]),
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergens: [],
  });
  assert.deepEqual(
    [...unique.meals, ...repeated.meals].map((meal) => meal.rawCandidateId),
    ['a', 'b', 'a', 'b']
  );
  assert.equal(repeated.remainingSlots.length, 0);
});

test('raw sourcing checks the next corpus page before leaving a slot for Gemini', async () => {
  const originalList = databaseRecipeCandidateProvider.list;
  const requestedCursors: Array<string | undefined> = [];
  databaseRecipeCandidateProvider.list = async (input) => {
    if (input.sourceKind === 'USER_OBSERVED') return { items: [], nextCursor: null };
    requestedCursors.push(input.cursor);
    return input.cursor
      ? { items: [candidate('safe', 'Chicken dish', 'chicken')], nextCursor: null }
      : { items: [candidate('blocked', 'Shrimp dish', 'shrimp')], nextCursor: 'next-page' };
  };
  try {
    const result = await sourceRawRecipeCandidates({
      slots: [{ dayNumber: 1, mealType: MealType.LUNCH, scheduledDate: new Date() }],
      dailyCalorieTarget: 2000,
      dietaryPreference: DietaryPreference.OMNIVORE,
      conditions: [],
      allergens: ['SHELLFISH'],
    });
    assert.deepEqual(requestedCursors, [undefined, 'next-page']);
    assert.deepEqual(
      result.meals.map((meal) => meal.rawCandidateId),
      ['safe']
    );
    assert.equal(result.remainingSlots.length, 0);
  } finally {
    databaseRecipeCandidateProvider.list = originalList;
  }
});

test('a published breakfast serving can be adjusted without adding source nutrition', async () => {
  const originalList = databaseRecipeCandidateProvider.list;
  const ranges: Array<{ minimum?: number; maximum?: number }> = [];
  databaseRecipeCandidateProvider.list = async (input) => {
    ranges.push({ minimum: input.calorieMinimum, maximum: input.calorieMaximum });
    const breakfast = candidate('breakfast', 'Breakfast egg sandwich', 'flour');
    breakfast.applicableMealTypes = [MealType.BREAKFAST];
    breakfast.nutrition = { calories: 438, proteinG: 12, carbsG: 72, fatG: 10 };
    breakfast.reviewFreeBaseEligible = true;
    return { items: [breakfast], nextCursor: null };
  };
  try {
    const result = await sourceRawRecipeCandidates({
      slots: [{ dayNumber: 1, mealType: MealType.BREAKFAST, scheduledDate: new Date() }],
      dailyCalorieTarget: 2571,
      dietaryPreference: DietaryPreference.OMNIVORE,
      conditions: [],
      allergens: [],
      reviewFreeBaseOnly: true,
    });
    assert.equal(result.remainingSlots.length, 0);
    assert.equal(result.meals[0].calories, 770.88);
    assert.equal(result.meals[0].ingredients[0].quantity, 176);
    assert.equal(result.meals[0].servingScale, 1.76);
    assert.match(result.meals[0].description, /Serving size: 1\.76×/i);
    assert.ok(ranges[0].minimum! < 438);
  } finally {
    databaseRecipeCandidateProvider.list = originalList;
  }
});
