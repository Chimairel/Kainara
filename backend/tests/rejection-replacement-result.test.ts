import './helpers/gemini-unit-key';
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import prisma from '../src/lib/prisma';
import { rejectMealPlan } from '../src/services/nutritionist-rejection.service';
import { ReviewRoutingService } from '../src/services/review-routing.service';
import { CertifiedSlotFallbackService } from '../src/services/certified-slot-fallback.service';
import { GroceryService } from '../src/services/grocery.service';
import { databaseRecipeCandidateProvider } from '../src/services/panlasang-recipe-candidate.provider';
import { AiCapacityService } from '../src/services/ai-capacity.service';

async function fixture(t: TestContext, options: { expired?: boolean; allergy?: boolean } = {}) {
  const profile = {
    revision: 1,
    safetyRevision: 1,
    age: 28,
    heightCm: 170,
    weightKg: 70,
    activityLevel: 'SEDENTARY',
    goal: 'MAINTAIN',
    dailyCalorieTarget: 2000,
    ricePreference: 'NO_RICE',
    dietaryPreference: 'OMNIVORE',
    otherConditions: null,
    otherAllergies: null,
  };
  const plan = {
    id: 'meal',
    userId: 'member',
    mealName: 'Pending meal',
    mealType: 'BREAKFAST',
    planGroupId: 'cycle',
    scheduledDate: new Date(),
    status: 'PENDING_REVIEW',
    claimedByNutritionistId: 'rnd',
    claimedAt: new Date(Date.now() - (options.expired ? 31 * 60_000 : 0)),
    user: {
      userProfile: profile,
      healthConditions: [],
      allergies: options.allergy ? [{ allergen: 'DAIRY' }] : [],
      safetyProfileEntries: [],
    },
    reviewApprovalCount: 0,
  };
  let decisions = 0;
  const created: Record<string, unknown>[] = [];
  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async () => [],
    userProfile: { findUniqueOrThrow: async () => profile },
    mealPlan: {
      findMany: async () => [],
      create: async (input: { data: Record<string, unknown> }) => {
        created.push(input.data);
        return { id: 'replacement', ...input.data };
      },
      updateMany: async () => {
        plan.status = 'REJECTED';
        return { count: 1 };
      },
    },
    mealPlanReviewDecision: {
      create: async () => {
        decisions++;
        return { id: 'decision' };
      },
    },
    notification: { create: async () => ({}) },
    auditEvent: { create: async () => ({}) },
    groceryList: { updateMany: async () => ({ count: 1 }) },
    foodItem: { findMany: async () => [] },
  };
  const models = [
    prisma.mealPlan,
    prisma.nutritionistProfile,
    prisma.notification,
    prisma.auditEvent,
    prisma.user,
    prisma.nutritionReportVersion,
    prisma.aiUsageEvent,
    prisma.foodItem,
    prisma.foodAlias,
  ];
  const originals = models.map((model) => ({
    findUnique: (model as typeof prisma.mealPlan).findUnique,
    findMany: (model as typeof prisma.mealPlan).findMany,
    findFirst: (model as typeof prisma.mealPlan).findFirst,
    create: model.create,
  }));
  t.after(() => models.forEach((model, i) => Object.assign(model, originals[i])));
  Object.assign(prisma.mealPlan, { findUnique: async () => plan, findMany: async () => [] });
  Object.assign(prisma.nutritionistProfile, { findUnique: async () => ({ userId: 'reviewer' }) });
  Object.assign(prisma.notification, { create: async () => ({}) });
  Object.assign(prisma.auditEvent, { create: async () => ({}) });
  Object.assign(prisma.aiUsageEvent, { create: async () => ({}) });
  Object.assign(prisma.foodItem, { findMany: async () => [], findFirst: async () => null });
  Object.assign(prisma.foodAlias, { findMany: async () => [], findFirst: async () => null });
  Object.assign(prisma.user, { findUnique: async () => plan.user });
  Object.assign(prisma.nutritionReportVersion, {
    findFirst: async () => ({
      acknowledgedAt: new Date(),
      policyVersion: 'NUTRITION_GUIDANCE_DETERMINISTIC_V1',
      profileSnapshot: { profile },
      profileRevision: 1,
      content: {},
    }),
  });
  t.mock.method(prisma, '$transaction', async (work: unknown) =>
    typeof work === 'function' ? work(tx) : Promise.all(work as Promise<unknown>[])
  );
  t.mock.method(ReviewRoutingService, 'assertMeal', async () => undefined);
  t.mock.method(databaseRecipeCandidateProvider, 'list', async () => ({ items: [], nextCursor: null }));
  t.mock.method(AiCapacityService, 'reserve', async () => 'fixture');
  t.mock.method(AiCapacityService, 'finish', async () => undefined);
  const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'synthetic-no-provider-access';
  t.after(() => {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  });
  t.mock.method(CertifiedSlotFallbackService, 'replaceWithBestCertified', async () => ({
    replaced: false,
    replacementPlanId: null,
  }));
  const errors: unknown[] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => errors.push(args));
  return { plan, created, errors, decisions: () => decisions };
}

test('provider failure preserves the saved rejection and duplicate submission cannot repeat it', async (t) => {
  const f = await fixture(t);
  let providerCalls = 0;
  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    assert.match(String(input), /generateContent/);
    providerCalls++;
    throw new Error('Simulated provider unavailable');
  });
  const result = await rejectMealPlan('rnd', 'meal', 'Replace the unsuitable meal.');
  assert.equal(result.success, true);
  assert.equal(result.replacementResult.status, 'PREPARATION_FAILED');
  assert.equal(f.plan.status, 'REJECTED');
  assert.equal(f.decisions(), 1);
  assert.ok(providerCalls > 0, 'The stored-candidate miss must reach the simulated provider.');
  await assert.rejects(rejectMealPlan('rnd', 'meal', 'Replace the unsuitable meal.'), /Only PENDING_REVIEW/);
  assert.equal(f.decisions(), 1);
});

test('allergy-conflicting AI candidates are exhausted without saving a replacement', async (t) => {
  const f = await fixture(t, { allergy: true });
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    assert.match(String(input), /generateContent/);
    attempts++;
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  text: JSON.stringify({
                    mealName: 'Milk breakfast',
                    description: 'Synthetic conflict',
                    calories: 600,
                    proteinG: 20,
                    carbsG: 90,
                    fatG: 18,
                    ingredients: [{ name: 'milk', category: 'Dairy' }],
                  }),
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });
  const result = await rejectMealPlan('rnd', 'meal', 'Member declared a dairy allergy.');
  assert.equal(attempts, 3);
  assert.equal(result.replacementResult.status, 'NO_CANDIDATE');
  assert.equal(result.replacementPlanId, null);
  assert.equal(f.decisions(), 1);
});

test('certified fallback receives the pending-review mode after rejection commits', async (t) => {
  const f = await fixture(t);
  t.mock.method(
    CertifiedSlotFallbackService,
    'replaceWithBestCertified',
    async (input: Parameters<typeof CertifiedSlotFallbackService.replaceWithBestCertified>[0]) => {
      assert.equal(f.plan.status, 'REJECTED');
      assert.equal(input.pendingRejection, true);
      return { replaced: true, replacementPlanId: 'replacement' };
    }
  );
  t.mock.method(GroceryService, 'generateGroceryList', async () => ({}));
  const result = await rejectMealPlan('rnd', 'meal', 'Find another suitable breakfast.');
  assert.deepEqual(result.replacementResult, { status: 'READY_FOR_REVIEW', source: 'CERTIFIED_LIBRARY' });
});

test('expired claims never save a rejection', async (t) => {
  const f = await fixture(t, { expired: true });
  await assert.rejects(rejectMealPlan('rnd', 'meal', 'Find another meal.'), /active claim/);
  assert.equal(f.decisions(), 0);
});

test('eligible simulated AI fallback remains pending with unresolved ingredient evidence', async (t) => {
  const f = await fixture(t);
  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    assert.match(String(input), /generateContent/);
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  text: JSON.stringify({
                    mealName: 'Vegetable breakfast',
                    description: 'Synthetic candidate',
                    calories: 600,
                    proteinG: 20,
                    carbsG: 90,
                    fatG: 18,
                    ingredients: [{ name: 'carrot', category: 'Vegetables' }],
                  }),
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });
  const result = await rejectMealPlan('rnd', 'meal', 'Prepare another candidate.');
  assert.equal(result.replacementResult.status, 'READY_FOR_REVIEW', String(f.errors.flat()));
  assert.deepEqual(result.replacementResult, { status: 'READY_FOR_REVIEW', source: 'AI_FROM_SCRATCH' });
  assert.equal(f.created.length, 1);
  assert.equal(f.created[0].status, 'PENDING_REVIEW');
  assert.equal(f.created[0].requiresSafetyRevalidation, true);
  assert.equal(f.created[0].aiConfidenceFlag, 'NEEDS_REVIEW');
  assert.equal(f.created[0].candidateProvenance, 'AI_FROM_SCRATCH');
  assert.equal(f.created[0].userId, 'member');
  assert.equal(f.created[0].planGroupId, 'cycle');
  assert.equal(f.created[0].scheduledDate, f.plan.scheduledDate);
  assert.equal(f.created[0].nutritionistProfileId, undefined);
  assert.equal(f.decisions(), 1);
});
