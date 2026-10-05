import assert from 'node:assert/strict';
import test from 'node:test';
import type { MealPlan, Prisma, RawRecipeCandidate } from '@prisma/client';
import {
  savePreparedCorpusMeal,
  savePreparedCorpusMeals,
  type PreparedCorpusMealInput,
} from '../src/services/meal-plan-corpus-persistence.service';
import { buildComposedServing } from '../src/domain/composed-serving.policy';

const source = {
  id: 'synthetic-source',
  sourceName: 'PANLASANG_PINOY',
  status: 'AVAILABLE',
  contentSignature: 'current-content',
  riceRole: 'PAIR_WITH_RICE',
  riceRoleReviewStatus: 'REVIEWED',
  includedRiceG: null,
  libraryVariants: [] as { id: string }[],
} as unknown as RawRecipeCandidate & { libraryVariants: { id: string }[] };
const rice = {
  id: 'synthetic-rice',
  name: 'Rice, well-milled, boiled',
  source: 'FNRI',
  compositionRevision: 3,
  calories: 130,
  proteinG: 2.5,
  carbsG: 28,
  fatG: 0.3,
};

function input(day = 0): PreparedCorpusMealInput {
  return {
    userId: 'synthetic-member',
    planGroupId: 'synthetic-cycle',
    planType: 'WEEKLY',
    autoGeneralBase: false,
    sourceEvidence: source,
    highRiskReviewRequired: true,
    userConditions: ['HEART_CONDITION'],
    userAllergens: ['NUTS'],
    planConditions: ['HEART_CONDITION'],
    otherConditions: null,
    otherAllergies: 'MSG',
    safetyEntries: [],
    selectionEvidence: { servingScale: 1 },
    riceFood: rice,
    meal: {
      rawCandidateId: source.id,
      candidateProvenance: 'RAW_RECIPE_CORPUS',
      mealName: 'Synthetic chicken dish',
      mealType: 'DINNER',
      description: 'Software fixture',
      calories: 600,
      proteinG: 40,
      carbsG: 10,
      fatG: 25,
      scheduledDate: new Date(Date.UTC(2026, 9, 6 + day)),
      aiConfidenceFlag: 'NEEDS_REVIEW',
      servingScale: 1,
      pairedRiceG: 150,
      ingredientsData: [
        {
          ingredientName: 'Chicken',
          category: 'PROTEIN',
          quantity: 200,
          unit: 'g',
          foodItemId: null,
          dataSource: 'SOURCE_RECIPE',
        },
      ],
    },
  };
}

function database(currentSource = source, currentRice = rice) {
  const calls: string[] = [];
  let plans: Prisma.MealPlanCreateManyInput[] = [];
  let ingredients: Prisma.MealIngredientCreateManyInput[] = [];
  let components: Prisma.MealPlanServingComponentCreateManyInput[] = [];
  const tx = {
    rawRecipeCandidate: {
      findMany: async () => {
        calls.push('sources');
        return [currentSource];
      },
    },
    foodItem: {
      findMany: async () => {
        calls.push('rice');
        return [currentRice];
      },
    },
    mealPlan: {
      createMany: async ({ data }: { data: Prisma.MealPlanCreateManyInput[] }) => {
        calls.push('plans');
        plans = data;
        return { count: data.length };
      },
      findMany: async () => {
        calls.push('saved');
        return plans as unknown as MealPlan[];
      },
    },
    mealIngredient: {
      createMany: async ({ data }: { data: Prisma.MealIngredientCreateManyInput[] }) => {
        calls.push('ingredients');
        ingredients = data;
        return { count: data.length };
      },
    },
    mealPlanServingComponent: {
      createMany: async ({ data }: { data: Prisma.MealPlanServingComponentCreateManyInput[] }) => {
        calls.push('components');
        components = data;
        return { count: data.length };
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, calls, rows: () => ({ plans, ingredients, components }) };
}

test('a 21-slot case plan uses six batch operations and remains pending with complete serving evidence', async () => {
  const db = database();
  const saved = await savePreparedCorpusMeals(
    db.tx,
    Array.from({ length: 21 }, (_, day) => input(day))
  );
  assert.deepEqual(db.calls, ['sources', 'rice', 'plans', 'ingredients', 'components', 'saved']);
  const { plans, ingredients, components } = db.rows();
  assert.equal(saved.length, 21);
  assert.equal(new Set(plans.map((plan) => plan.id)).size, 21);
  assert.equal(ingredients.length, 21);
  assert.equal(components.length, 42);
  for (const plan of plans) {
    assert.equal(plan.status, 'PENDING_REVIEW');
    assert.equal(plan.requiresSafetyRevalidation, true);
    assert.equal(plan.highRiskReviewRequired, true);
    assert.equal(plan.calories, 795);
    assert.equal(plan.carbsG, 52);
    assert.ok(plan.reviewWorkKey);
    assert.equal(plan.sourceRawRecipeCandidateId, source.id);
    assert.equal(
      plan.composedServingSignature,
      buildComposedServing({
        baseRecipeSignature: plan.baseRecipeSignature!,
        baseNutrition: input().meal,
        riceFood: rice,
        cookedRiceG: 150,
      }).composedServingSignature
    );
    assert.deepEqual(
      components.filter((row) => row.mealPlanId === plan.id).map((row) => row.componentType),
      ['BASE_RECIPE', 'COOKED_RICE']
    );
  }
});

test('the single-slot repair path returns the saved plan and does not invent a rice side', async () => {
  const db = database();
  const value = input();
  value.meal.pairedRiceG = null;
  const saved = await savePreparedCorpusMeal(db.tx, value);
  assert.equal(saved.calories, 600);
  assert.equal(saved.baseRecipeSignature, saved.composedServingSignature);
  assert.equal(db.rows().components.length, 1);
  assert.ok(!db.calls.includes('rice'));
});

for (const [name, change] of [
  ['flagged source', { status: 'FLAGGED' }],
  ['changed source signature', { contentSignature: 'changed-content' }],
  ['flagged library variant', { libraryVariants: [{ id: 'flagged-variant' }] }],
] as const) {
  test(`batch rejects ${name} before any write`, async () => {
    const db = database({ ...source, ...change } as typeof source);
    await assert.rejects(savePreparedCorpusMeals(db.tx, [input(), input(1)]), /Source recipe was flagged/);
    assert.deepEqual(db.calls, ['sources', 'rice']);
  });
}

test('the whole batch is rejected if a later slot would receive double rice', async () => {
  const db = database();
  const invalid = input(1);
  invalid.meal.ingredientsData.push({
    ingredientName: 'Rice',
    quantity: 150,
    unit: 'g',
    foodItemId: rice.id,
    category: 'GRAINS',
    dataSource: 'SOURCE_RECIPE',
  });
  await assert.rejects(savePreparedCorpusMeals(db.tx, [input(), invalid]), /Only a rice-compatible dish/);
  assert.deepEqual(db.calls, ['sources', 'rice']);
});

test('rice steps, governed identity, and live nutrient revision remain enforced', async () => {
  const invalid = input();
  invalid.meal.pairedRiceG = 125;
  await assert.rejects(savePreparedCorpusMeals(database().tx, [invalid]), /half-cup steps/);
  await assert.rejects(
    savePreparedCorpusMeals(database(source, { ...rice, source: 'USDA_FDC' }).tx, [input()]),
    /governed cooked-rice/
  );
  await assert.rejects(
    savePreparedCorpusMeals(database(source, { ...rice, compositionRevision: 4 }).tx, [input()]),
    /Food composition changed/
  );
});

test('case restrictions cannot be promoted through the general-base flag', async () => {
  const db = database();
  await assert.rejects(
    savePreparedCorpusMeals(db.tx, [{ ...input(), autoGeneralBase: true }]),
    /Source recipe changed/
  );
  assert.deepEqual(db.calls, ['sources', 'rice']);
});

test('an unchanged unrestricted published serving retains general-base eligibility', async () => {
  const publishedSource = {
    ...source,
    publishedNutrition: { calories: 600 },
    calories: 600,
    proteinG: 40,
    carbsG: 10,
    fatG: 25,
    ingredients: [{ name: 'Chicken', quantity: 200, unit: 'g' }],
  };
  const db = database(publishedSource);
  const value = {
    ...input(),
    autoGeneralBase: true,
    sourceEvidence: publishedSource,
    userConditions: [],
    userAllergens: [],
    planConditions: [],
    otherAllergies: null,
    highRiskReviewRequired: false,
  };
  const saved = await savePreparedCorpusMeal(db.tx, value);
  assert.equal(saved.status, 'APPROVED');
  assert.equal(saved.requiresSafetyRevalidation, false);
  assert.equal(saved.calories, 795);
  assert.equal(db.rows().components[0].evidenceSource, 'PANLASANG_PINOY_GENERAL_BASE');
});

test('a missing live source aborts the batch and an empty batch performs no work', async () => {
  const db = database();
  const value = input();
  value.meal.rawCandidateId = 'missing-source';
  await assert.rejects(savePreparedCorpusMeals(db.tx, [value]), /Source recipe was flagged/);
  assert.deepEqual(db.calls, ['sources', 'rice']);
  const empty = database();
  assert.deepEqual(await savePreparedCorpusMeals(empty.tx, []), []);
  assert.deepEqual(empty.calls, []);
});
