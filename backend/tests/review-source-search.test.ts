import assert from 'node:assert/strict';
import test from 'node:test';
import type { RecipeCandidateProjection } from '../src/services/recipe-candidate-provider';

const db = {
  foodItem: { findFirst: async () => null, findMany: async () => [] },
  foodAlias: { findMany: async () => [] },
  mealPlanCycleSnapshot: { findUnique: async () => null },
  mealPlan: { findMany: async () => [] },
  mealReviewLineage: { findMany: async () => [] },
};
(globalThis as unknown as { prisma: unknown }).prisma = db;

test('ranked pagination reports all matches and rejects a cursor from changed filters', async () => {
  const { pageReviewSourceCandidates } = await import('../src/services/review-source-search.service');
  const pool = Array.from({ length: 65 }, (_, i) => ({ option: { id: `id-${i}` }, score: 65 - i, recent: false }));
  const first = pageReviewSourceCandidates(pool, 'scope');
  assert.equal(first.total, 65);
  assert.equal(first.items.length, 24);
  assert.equal(first.items[0].option.id, 'id-64');
  const second = pageReviewSourceCandidates(pool, 'scope', first.nextCursor!);
  assert.equal(second.items[0].option.id, 'id-40');
  assert.equal(second.total, 65);
  assert.throws(() => pageReviewSourceCandidates(pool, 'new-filters', first.nextCursor!));
  assert.throws(() => pageReviewSourceCandidates(pool, 'scope', 'garbage'));
  assert.equal(pageReviewSourceCandidates([], 'scope').nextCursor, null);
});

test('recent recipes rank after fresh alternatives', async () => {
  const { pageReviewSourceCandidates } = await import('../src/services/review-source-search.service');
  const page = pageReviewSourceCandidates(
    [
      { option: { id: 'recent' }, score: 0, recent: true },
      { option: { id: 'fresh' }, score: 1, recent: false },
    ],
    'scope'
  );
  assert.deepEqual(
    page.items.map((x) => x.option.id),
    ['fresh', 'recent']
  );
});

const recipe = (id: string): RecipeCandidateProjection => ({
  id,
  providerRecordId: id,
  provenance: 'PANLASANG_PINOY',
  displayName: `Chicken ${id}`,
  normalizedName: id,
  category: 'Chicken',
  description: 'Chicken meal',
  contentSignature: id,
  sourceUrl: 'https://panlasangpinoy.com/chicken/',
  applicableMealTypes: ['LUNCH'],
  dietaryTags: ['OMNIVORE'],
  ingredients: [{ name: 'chicken breast', quantity: 100, unit: 'g' }],
  ingredientsComplete: true,
  nutrition: { calories: 800, proteinG: 40, carbsG: 90, fatG: 30 },
  extendedNutrients: { sugarG: 5 },
  servingDescription: null,
  riceRole: 'STANDALONE',
  riceRoleReviewStatus: 'REVIEWED',
  imageUrl: null,
  videoUrl: null,
  state: 'ACTIVE',
});

test('RND search reads past the first chunk, counts all matches and revalidates a non-first identity', async (t) => {
  const prisma = db;
  const { databaseRecipeCandidateProvider } = await import('../src/services/panlasang-recipe-candidate.provider');
  const { searchReviewSourceSwaps } = await import('../src/services/review-source-search.service');
  t.mock.method(prisma.foodItem, 'findFirst', async () => null);
  t.mock.method(prisma.foodItem, 'findMany', async () => []);
  t.mock.method(prisma.foodAlias, 'findMany', async () => []);
  t.mock.method(prisma.mealPlanCycleSnapshot, 'findUnique', async () => null);
  t.mock.method(prisma.mealPlan, 'findMany', async () => []);
  t.mock.method(prisma.mealReviewLineage, 'findMany', async () => [{ key: 'source:held' }]);
  const pool = [
    ...Array.from({ length: 650 }, (_, i) => recipe(String(i).padStart(3, '0'))),
    { ...recipe('allergen'), ingredients: [{ name: 'peanuts', quantity: 100, unit: 'g' }] },
    { ...recipe('unknown'), extendedNutrients: {} },
    recipe('held'),
    recipe('current'),
  ];
  const calls: Parameters<typeof databaseRecipeCandidateProvider.list>[0][] = [];
  t.mock.method(
    databaseRecipeCandidateProvider,
    'list',
    async (input: Parameters<typeof databaseRecipeCandidateProvider.list>[0]) => {
      calls.push(input);
      if (input.sourceKind === 'USER_OBSERVED') return { items: [], nextCursor: null };
      const rows = pool.filter(
        (x) => !input.excludeIds?.includes(x.id) && (!input.candidateId || x.id === input.candidateId)
      );
      const start = Number(input.cursor ?? 0);
      return {
        items: rows.slice(start, start + input.limit),
        nextCursor: start + input.limit < rows.length ? String(start + input.limit) : null,
      };
    }
  );
  const plan = {
    id: 'plan',
    userId: 'member',
    mealType: 'LUNCH',
    scheduledDate: new Date('2026-10-15'),
    sourceRawRecipeCandidateId: 'current',
    cycle: { snapshot: { id: 'snapshot', dailyCalorieTarget: 2000, ricePreference: 'NO_RICE' } },
  } as Parameters<typeof searchReviewSourceSwaps>[0];
  const context = {
    conditions: [],
    allergens: ['NUTS'],
    otherConditions: null,
    otherAllergies: null,
    profile: { dietaryPreference: 'OMNIVORE', revision: 1, safetyRevision: 1 },
    user: { safetyProfileEntries: [] },
    planningTargets: null,
  } as unknown as Parameters<typeof searchReviewSourceSwaps>[1];
  const first = await searchReviewSourceSwaps(plan, context, { sugarG: { max: 10 } });
  assert.equal(first.total, 650);
  assert.equal(first.items.length, 24);
  assert.equal(first.unknownExcludedCount, 1);
  assert.ok(first.nextCursor);
  assert.ok(calls.some((x) => x.cursor === '600' && x.reviewPoolScan === true));
  assert.ok(first.items.every((x) => x.option.requiresReview));
  const selected = await searchReviewSourceSwaps(plan, context, { sugarG: { max: 10 } }, undefined, '649');
  assert.equal(selected.total, 1);
  assert.equal(selected.items[0].option.id, 'review-source:649');
  assert.ok(calls.some((x) => x.candidateId === '649' && !x.reviewPoolScan));
  const changed = await searchReviewSourceSwaps(plan, context, { sugarG: { max: 1 } }, undefined, '649');
  assert.equal(changed.total, 0);
  const searched = await searchReviewSourceSwaps(plan, context, { sugarG: { max: 10 } }, undefined, undefined, '649 breast');
  assert.equal(searched.total, 1);
  assert.equal(searched.items[0].option.id, 'review-source:649');
  const incompatible = await searchReviewSourceSwaps(plan, context, { sugarG: { max: 1 } }, undefined, undefined, '649 breast');
  assert.equal(incompatible.total, 0);
  const allergenSearch = await searchReviewSourceSwaps(plan, context, {}, undefined, undefined, 'peanuts');
  assert.equal(allergenSearch.total, 0);
  await assert.rejects(() => searchReviewSourceSwaps(plan, context, { sugarG: { max: 10 } }, first.nextCursor!, undefined, 'breast'), /search changed/i);
});

test('source revision detects nutrient and ingredient changes even with an unchanged signature', async () => {
  const { rawRecipeSourceRevision } = await import('../src/services/panlasang-recipe-candidate.provider');
  const row = {
    contentSignature: 'same',
    ingredients: [],
    calories: 800,
    proteinG: 40,
    carbsG: 90,
    fatG: 30,
    publishedNutrition: { sodiumMg: 100 },
    riceRole: 'STANDALONE',
    riceRoleReviewStatus: 'REVIEWED',
    includedRiceG: null,
    status: 'AVAILABLE',
  } as Parameters<typeof rawRecipeSourceRevision>[0];
  assert.notEqual(
    rawRecipeSourceRevision(row),
    rawRecipeSourceRevision({ ...row, publishedNutrition: { sodiumMg: 101 } })
  );
  assert.notEqual(
    rawRecipeSourceRevision(row),
    rawRecipeSourceRevision({ ...row, ingredients: [{ name: 'peanuts' }] })
  );
});

test('exact source lookup retains exclusions without overwriting the selected identity', async (t) => {
  const { databaseRecipeCandidateProvider } = await import('../src/services/panlasang-recipe-candidate.provider');
  const stub = { findMany: async (_args: unknown) => [] };
  const client = db as typeof db & { rawRecipeCandidate?: typeof stub };
  client.rawRecipeCandidate = stub;
  let captured: unknown;
  t.mock.method(stub, 'findMany', async (args: unknown) => {
    captured = args;
    return [];
  });
  await databaseRecipeCandidateProvider.list({
    candidateId: 'later-choice',
    excludeIds: ['current', 'held'],
    sourceKind: 'PANLASANG_PINOY',
    mealType: 'LUNCH',
    limit: 120,
    hydrateIngredients: false,
  });
  assert.deepEqual((captured as { where: { id: unknown } }).where.id, {
    equals: 'later-choice',
    notIn: ['current', 'held'],
  });
  assert.equal((captured as { take: number }).take, 121);
  await databaseRecipeCandidateProvider.list({ limit: 2000, reviewPoolScan: true, hydrateIngredients: false });
  assert.equal((captured as { take: number }).take, 601);
});
