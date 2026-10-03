import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { proposeRiceRole, resolveRecipeRiceRole } from '../src/domain/recipe-rice-role.policy';
import { rawRecipeServing } from '../src/services/raw-recipe-serving.service';
import { resolveReplacementServing } from '../src/services/meal-swap-serving.service';
import { composePlanWithPairedRice } from '../src/services/meal-plan-serving.service';
import type { CertifiedLibraryMeal } from '../src/services/meal-library-candidate-query.service';
import type { RecipeCandidateProjection } from '../src/services/recipe-candidate-provider';
import { persistDeterministicLibraryClassification } from '../src/services/meal-library-publication.service';

const rice = {
  id: 'rice',
  name: 'Rice, well-milled, boiled',
  source: 'FNRI',
  compositionRevision: 1,
  calories: 130,
  proteinG: 2.5,
  carbsG: 28,
  fatG: 0.3,
};
const dish = {
  mealName: 'Chicken adobo',
  applicableMealTypes: [{ mealType: 'LUNCH' }],
  riceRole: null,
  riceRoleReviewStatus: 'NOT_REVIEWED',
  includedRiceG: null,
  riceMinHalfCups: 1,
  riceMaxHalfCups: 3,
  recipeSignature: 'a'.repeat(64),
  calories: 400,
  proteinG: 30,
  carbsG: 10,
  fatG: 20,
  ingredients: [{ ingredientName: 'Chicken', quantity: 100, unit: 'g' }],
} as unknown as CertifiedLibraryMeal;
const source = {
  displayName: dish.mealName,
  category: 'Main dish',
  applicableMealTypes: ['LUNCH'],
  state: 'ACTIVE',
  provenance: 'PANLASANG_PINOY',
  nutrition: { calories: 400, proteinG: 30, carbsG: 10, fatG: 20 },
  riceRole: null,
  riceRoleReviewStatus: 'NOT_REVIEWED',
  ingredients: [{ name: 'Chicken', quantity: 100, unit: 'g' }],
} as RecipeCandidateProjection;

test('unclassified dishes receive no automatic rice in either serving path, including macro optimization', () => {
  const input = {
    mealType: 'LUNCH' as const,
    ricePreference: 'FLEXIBLE' as const,
    riceFood: rice,
    macroTarget: { calories: 600, proteinG: 50, carbsG: 70, fatG: 20 },
  };
  assert.equal(resolveRecipeRiceRole(dish).riceRole, null);
  assert.equal(resolveRecipeRiceRole(dish).basis, 'UNCLASSIFIED');
  const raw = rawRecipeServing({ ...input, candidate: source, dailyCalorieTarget: 1500 })!;
  assert.equal(raw.pairedRiceG, null);
  const library = resolveReplacementServing({
    ...input,
    meal: { ...dish, calories: 600 },
    dailyTarget: 1500,
    hasConditions: false,
  })!;
  assert.equal(library.pairedRiceG, null);
  assert.equal(
    rawRecipeServing({ ...input, candidate: source, dailyCalorieTarget: 1500, ricePreference: 'WITH_RICE' }),
    null
  );
  assert.equal(
    resolveReplacementServing({
      ...input,
      meal: dish,
      dailyTarget: 1500,
      hasConditions: false,
      ricePreference: 'WITH_RICE',
    }),
    null
  );
});

test('saved standalone labels override recognizable ulam titles; only explicit pairing adds rice', () => {
  for (const riceRole of ['STANDALONE', 'PAIR_WITH_RICE'] as const) {
    const raw = rawRecipeServing({
      candidate: { ...source, riceRole },
      mealType: 'LUNCH',
      ricePreference: 'FLEXIBLE',
      dailyCalorieTarget: 1500,
      riceFood: rice,
    })!;
    assert.equal(Boolean(raw.pairedRiceG), riceRole === 'PAIR_WITH_RICE');
    const library = resolveReplacementServing({
      meal: { ...dish, riceRole, calories: 600 },
      mealType: 'LUNCH',
      ricePreference: 'FLEXIBLE',
      dailyTarget: 1700,
      riceFood: rice,
      hasConditions: false,
    })!;
    assert.equal(Boolean(library.pairedRiceG), riceRole === 'PAIR_WITH_RICE');
    assert.equal(resolveRecipeRiceRole({ ...dish, riceRole }).riceRole, riceRole);
  }
});

test('import/audit proposals require positive pairing evidence and distinguish rice noodles', () => {
  assert.deepEqual(proposeRiceRole({ name: 'Unfamiliar recipe', category: 'General', ingredients: [] }), {
    riceRole: null,
    includedRiceG: null,
    reasonCode: 'UNCLASSIFIED',
  });
  assert.equal(proposeRiceRole({ name: 'Chicken Adobo', ingredients: [] }).riceRole, 'PAIR_WITH_RICE');
  assert.equal(
    proposeRiceRole({ name: 'Garlic Bihon', ingredients: [{ name: 'Rice sticks' }] }).riceRole,
    'STANDALONE'
  );
});

test('rice persistence rechecks the current saved label and rejects unknown/standalone without writes', async () => {
  for (const role of [null, 'STANDALONE', 'PAIR_WITH_RICE'] as const) {
    let writes = 0;
    const tx = {
      mealPlan: {
        findUniqueOrThrow: async () => ({
          id: 'slot',
          status: 'PENDING_REVIEW',
          candidateProvenance: 'RAW_RECIPE_CORPUS',
          mealName: 'Chicken adobo',
          baseRecipeSignature: 'a'.repeat(64),
          libraryMeal: null,
          sourceRawRecipeCandidate: {
            sourceName: 'PANLASANG_PINOY',
            status: 'AVAILABLE',
            libraryVariants: [],
            riceRole: role,
            riceRoleReviewStatus: 'PROPOSED',
            includedRiceG: null,
          },
          ingredients: dish.ingredients,
          clearanceUsages: [],
          servingComponents: [{ componentType: 'BASE_RECIPE', calories: 400, proteinG: 30, carbsG: 10, fatG: 20 }],
        }),
        update: async () => {
          writes++;
        },
      },
      foodItem: { findUniqueOrThrow: async () => rice },
      mealPlanServingComponent: {
        deleteMany: async () => {
          writes++;
        },
        create: async () => {
          writes++;
        },
      },
      mealPlanClearanceUsage: {
        updateMany: async () => {
          writes++;
        },
      },
    } as unknown as Prisma.TransactionClient;
    const action = composePlanWithPairedRice(tx, { mealPlanId: 'slot', cookedRiceG: 150, fnriRiceFoodItemId: 'rice' });
    if (role === 'PAIR_WITH_RICE') {
      const plate = await action;
      assert.equal(plate.total.calories, 595);
      assert.equal(plate.total.carbsG, 52);
      assert.equal(writes, 4);
    } else {
      await assert.rejects(action, /Only a rice-compatible dish/);
      assert.equal(writes, 0);
    }
  }
});

test('draft classification preserves explicit author labels and reviewed labels', async () => {
  for (const reviewed of [true, false]) {
    let updated: Record<string, unknown> = {};
    const tx = {
      mealLibrary: {
        findUniqueOrThrow: async () => ({
          ...dish,
          mealType: 'LUNCH',
          riceRole: 'STANDALONE',
          riceRoleReviewStatus: reviewed ? 'REVIEWED' : 'PROPOSED',
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updated = data;
        },
      },
      mealLibrarySafetyDeclaration: { deleteMany: async () => undefined, createMany: async () => undefined },
      mealLibraryApplicableType: { deleteMany: async () => undefined, createMany: async () => undefined },
    } as unknown as Prisma.TransactionClient;
    await persistDeterministicLibraryClassification(tx, 'dish', { preserveRiceRole: !reviewed });
    assert.ok(!('riceRole' in updated));
    assert.ok(!('riceRoleReviewStatus' in updated));
    assert.ok(!('includedRiceG' in updated));
    assert.ok('ingredientClassificationStatus' in updated);
  }
});
