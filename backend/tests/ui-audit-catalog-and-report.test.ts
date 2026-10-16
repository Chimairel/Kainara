import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { Response } from 'express';
import prisma from '../src/lib/prisma';
import { VerifiedRecipeCatalogService } from '../src/services/verified-recipe-catalog.service';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { UserController } from '../src/controllers/user.controller';
import { NutritionReportPDF } from '../src/lib/pdf';
import type { AuthenticatedRequest } from '../src/types';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';

// Prisma's extended delegates expose methods through a proxy, not own properties.
function replaceMethod(t: TestContext, target: object, name: string, replacement: (...args: any[]) => unknown) {
  const original = Reflect.get(target, name);
  Reflect.set(target, name, replacement);
  t.after(() => Reflect.set(target, name, original));
}

function recordedSourceReviews(t: TestContext) {
  replaceMethod(t, prisma.mealBaseVerification, 'findMany', async () =>
    Array.from({ length: 25 }, (_, i) => ({ targetId: `source-${i}`, revisionKey: `revision-${i}` }))
  );
}

test('avoidance catalogue excludes conflicting and ambiguous recipes before pagination/counting', async (t) => {
  recordedSourceReviews(t);
  const previous = process.env.MEMBERSHIP_ENABLED;
  process.env.MEMBERSHIP_ENABLED = 'false';
  t.after(() => {
    if (previous === undefined) delete process.env.MEMBERSHIP_ENABLED;
    else process.env.MEMBERSHIP_ENABLED = previous;
  });
  replaceMethod(t, prisma.user, 'findUnique', async () => ({
    userProfile: { dailyCalorieTarget: 1800, weightKg: 60, age: 30 },
    healthConditions: [],
    allergies: [],
    safetyProfileEntries: [
      {
        domain: 'AVOIDED_INGREDIENT',
        canonicalCode: 'PORK',
        supportState: 'RECOGNIZED_UNSUPPORTED',
        displayName: 'Pork',
      },
    ],
  }));
  replaceMethod(t, prisma.mealPlanCycle, 'findFirst', async () => null);
  replaceMethod(t, prisma.mealPlan, 'findMany', async () => []);
  replaceMethod(t, prisma.mealLibrary, 'findMany', async () => []);
  replaceMethod(t, prisma.mealLibrary, 'count', async () => 0);
  const rows = ['chicken', 'baboy', 'meat broth', 'rice'].map((name, index) => ({
    id: `source-${index}`,
    recipeName: name,
    sourceName: 'PANLASANG_PINOY',
    status: 'AVAILABLE',
    ingredients: [{ name, quantity: 100, unit: 'g' }],
    publishedNutrition: null,
    calories: 250,
    proteinG: 10,
    carbsG: 35,
    fatG: 9,
    applicableMealTypes: [{ mealType: 'LUNCH' }],
  }));
  replaceMethod(t, prisma.rawRecipeCandidate, 'findMany', async ({ where, take }: any) => {
    if (take === 250) return rows;
    assert.deepEqual(where.id.in, ['source-0', 'source-3']);
    return rows.filter((row) => where.id.in.includes(row.id));
  });
  replaceMethod(t, prisma.rawRecipeCandidate, 'count', async ({ where }: any) => {
    assert.deepEqual(where.id.in, ['source-0', 'source-3']);
    return where.id.in.length;
  });
  const result = await VerifiedRecipeCatalogService.list('member', { page: 1 });
  assert.equal(result.restrictedProfile, false);
  assert.equal(result.total, 2);
  assert.deepEqual(
    result.items.map((item) => item.id),
    ['raw:source-0', 'raw:source-3']
  );
});

test('catalog pagination, rice filtering and plan labels use owner-scoped current/upcoming recipe identities', async (t) => {
  recordedSourceReviews(t);
  const previous = process.env.MEMBERSHIP_ENABLED;
  process.env.MEMBERSHIP_ENABLED = 'false';
  t.after(() => {
    if (previous === undefined) delete process.env.MEMBERSHIP_ENABLED;
    else process.env.MEMBERSHIP_ENABLED = previous;
  });
  replaceMethod(t, prisma.user, 'findUnique', async () => ({
    userProfile: { dailyCalorieTarget: 1800, weightKg: 60, age: 30 },
    healthConditions: [],
    allergies: [],
    safetyProfileEntries: [],
  }));
  replaceMethod(
    t,
    prisma.mealPlanCycle,
    'findFirst',
    async ({
      where,
    }: {
      where: { userId: string; startDate: { gt?: Date }; supersededAt: null; supersededById: null };
    }) => {
      assert.equal(where.userId, 'member');
      assert.equal(where.supersededAt, null);
      assert.equal(where.supersededById, null);
      return { id: where.startDate.gt ? 'upcoming' : 'current' };
    }
  );
  replaceMethod(t, prisma.mealPlan, 'findMany', async ({ where }: { where: Record<string, unknown> }) => {
    assert.equal(where.userId, 'member');
    assert.deepEqual(where.planGroupId, { in: ['current', 'upcoming'] });
    assert.equal(where.requiresSafetyRevalidation, false);
    assert.equal(where.supersededByMealPlanId, null);
    return [
      {
        id: 'slot',
        planGroupId: 'upcoming',
        sourceRawRecipeCandidateId: 'source-0',
        libraryMealId: null,
        mealName: 'Shared title',
        scheduledDate: new Date('2026-10-12'),
        calories: 400,
        proteinG: 0,
        carbsG: 100,
        fatG: 0,
      },
    ];
  });
  replaceMethod(t, prisma.mealLibrary, 'findMany', async () => []);
  replaceMethod(t, prisma.mealLibrary, 'count', async () => 0);
  replaceMethod(t, prisma.rawRecipeCandidate, 'count', async ({ where }: { where: { riceRole: string } }) => {
    assert.equal(where.riceRole, 'STANDALONE');
    return 9;
  });
  replaceMethod(t, prisma.rawRecipeCandidate, 'findMany', async ({ skip, take }: { skip: number; take: number }) =>
    Array.from({ length: take }, (_, i) => ({
      id: `source-${skip + i}`,
      recipeName: 'Shared title',
      sourceName: 'PANLASANG_PINOY',
      status: 'AVAILABLE',
      ingredients: [],
      publishedNutrition: null,
      calories: 250,
      proteinG: 10,
      carbsG: 35,
      fatG: 9,
      applicableMealTypes: [{ mealType: 'LUNCH' }],
    }))
  );
  const first = await VerifiedRecipeCatalogService.list('member', { page: 1, riceRole: 'STANDALONE' });
  assert.equal(first.items.length, 6);
  assert.equal(first.items[0].inPlan, true);
  assert.equal(first.items[0].fatG, 0);
  assert.equal(first.items[0].proteinG, 0);
  assert.equal(first.items[0].occurrences[0].cycleScope, 'UPCOMING');
  assert.equal(first.items[1].inPlan, false, 'a matching title is not the same recipe identity');
  const second = await VerifiedRecipeCatalogService.list('member', { page: 2, riceRole: 'STANDALONE' });
  assert.equal(second.items.length, 3);
  assert.equal(second.items[0].id, 'raw:source-6');
  assert.equal(second.pageCount, 2);
  const clamped = await VerifiedRecipeCatalogService.list('member', { page: 99, riceRole: 'STANDALONE' });
  assert.equal(clamped.page, 2);
});

test('PDF version parameters reject malformed input before any report lookup', async () => {
  for (const version of ['2junk', '0', '-1', '1.5', ['1', '2'], '999999999999999999999']) {
    let status = 0;
    const response = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: unknown) {
        return body;
      },
    };
    await UserController.downloadNutritionReportPdf(
      { user: { userId: 'member' }, query: { version } } as unknown as AuthenticatedRequest,
      response as unknown as Response
    );
    assert.equal(status, 400);
  }
});

test('archived PDF uses the saved target and never substitutes the live profile target', async (t) => {
  replaceMethod(
    t,
    prisma.nutritionReportVersion,
    'findFirst',
    async ({ where }: { where: { userId: string; version: number } }) => {
      assert.deepEqual(where, { userId: 'member', version: 2 });
      return {
        id: 'v2',
        userId: 'member',
        version: 2,
        generatedAt: new Date('2026-10-01'),
        profileSnapshot: { profile: { dailyCalorieTarget: 1700 } },
        policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
        content: { generalSummary: 'Saved report', referenceItems: [] },
      };
    }
  );
  const report = await NutritionReportService.getVersionReport('member', 2);
  assert.equal(report?.recordedCalorieTarget, 1700);
  const user = { name: 'Synthetic member', userProfile: { dailyCalorieTarget: 2900 } };
  const text = JSON.stringify(NutritionReportPDF({ user, report, archived: true }));
  assert.match(text, /1700/);
  assert.doesNotMatch(text, /2900/);
  assert.match(text, /Archived record/);
  const missing = JSON.stringify(
    NutritionReportPDF({
      user,
      report: { ...report, recordedCalorieTarget: null, planningTargets: null },
      archived: true,
    })
  );
  assert.match(missing, /Not recorded/);
  assert.doesNotMatch(missing, /2900/);
});

test('catalogue summary counts without reading cycle annotations or recipe card payloads', async (t) => {
  recordedSourceReviews(t);
  const previous = process.env.MEMBERSHIP_ENABLED;
  process.env.MEMBERSHIP_ENABLED = 'false';
  t.after(() => {
    if (previous === undefined) delete process.env.MEMBERSHIP_ENABLED;
    else process.env.MEMBERSHIP_ENABLED = previous;
  });
  replaceMethod(t, prisma.user, 'findUnique', async ({ where }: any) => {
    assert.equal(where.id, 'member');
    return {
      userProfile: { dailyCalorieTarget: 1800, weightKg: 60, age: 30 },
      healthConditions: [],
      allergies: [],
      safetyProfileEntries: [],
    };
  });
  replaceMethod(t, prisma.mealPlanCycle, 'findFirst', async () => {
    throw new Error('Counts must not load cycle annotations');
  });
  replaceMethod(t, prisma.mealPlan, 'findMany', async () => {
    throw new Error('Counts must not load plan cards');
  });
  replaceMethod(t, prisma.mealLibrary, 'findMany', async () => []);
  replaceMethod(t, prisma.mealLibrary, 'count', async () => 0);
  replaceMethod(t, prisma.rawRecipeCandidate, 'count', async ({ where }: any) => {
    assert.deepEqual(where.recipeName, { contains: 'chicken', mode: 'insensitive' });
    assert.equal(where.riceRole, 'STANDALONE');
    return 25;
  });
  replaceMethod(t, prisma.rawRecipeCandidate, 'findMany', async () => {
    throw new Error('Counts must not load recipe cards');
  });
  const result = await VerifiedRecipeCatalogService.list('member', {
    summaryOnly: true,
    search: 'chicken',
    riceRole: 'STANDALONE',
  });
  assert.equal(result.total, 25);
  assert.equal(result.restrictedProfile, false);
  assert.deepEqual(result.items, []);
});

test('restricted summary follows compatibility admission and returns all identities beyond its one-row page', async (t) => {
  const { mealApprovalSafetyScope } = await import('../src/domain/meal-approval-scope.policy');
  const previous = process.env.MEMBERSHIP_ENABLED;
  process.env.MEMBERSHIP_ENABLED = 'false';
  t.after(() => {
    if (previous === undefined) delete process.env.MEMBERSHIP_ENABLED;
    else process.env.MEMBERSHIP_ENABLED = previous;
  });
  const entry = { domain: 'ALLERGY', canonicalCode: 'DAIRY', originalText: 'milk', supportState: 'SUPPORTED' };
  const scope = mealApprovalSafetyScope({ conditions: [], allergens: ['DAIRY'], safetyEntries: [entry] });
  replaceMethod(t, prisma.user, 'findUnique', async () => ({
    userProfile: {
      dailyCalorieTarget: 1800,
      weightKg: 60,
      age: 30,
      dietaryPreference: 'OMNIVORE',
      otherConditions: null,
      otherAllergies: null,
    },
    healthConditions: [],
    allergies: [{ allergen: 'DAIRY' }],
    safetyProfileEntries: [entry],
  }));
  replaceMethod(t, prisma.mealConditionClearance, 'findMany', async () => []);
  replaceMethod(t, prisma.conditionRulePolicyVersion, 'findMany', async () => []);
  const rows = Array.from({ length: 4 }, (_, i) => ({
    id: `eligible-${i}`,
    mealName: `Rice ${i}`,
    status: i === 3 ? 'FLAGGED' : 'APPROVED',
    recipeSignature: 'a'.repeat(64),
    sourceRawRecipeCandidateId: 'source',
    sourceRawRecipeCandidate: {
      sourceName: 'PANLASANG_PINOY',
      status: 'AVAILABLE',
      contentSignature: 'source-signature',
    },
    description: null,
    safetyEvidenceRevision: 1,
    safetyEvidenceStatus: 'INCOMPLETE',
    applicableMealTypes: [{ mealType: 'LUNCH' }],
    ingredients: [{ ingredientName: 'rice', category: 'GRAINS', foodItem: null }],
    profileApprovals: [
      {
        safetyScopeKey: scope.key,
        recipeSignature: 'a'.repeat(64),
        evidenceRevision: 1,
        reviewPolicyVersion: 'NUTRIMIND_PLAN_SAFETY_V2',
        reviewDueAt: new Date('2099-01-01'),
        flaggedAt: null,
        reviewerNutritionist: {
          isVerified: true,
          prcLicenseExpiry: new Date('2099-01-01'),
          user: { role: 'NUTRITIONIST', isSuspended: false },
        },
      },
    ],
  }));
  replaceMethod(t, prisma.mealLibrary, 'findMany', async () => rows);
  replaceMethod(t, prisma.mealBaseVerification, 'findMany', async () => [
    { targetKind: 'RAW_RECIPE', targetId: 'source', revisionKey: 'source-signature' },
  ]);
  const result = await VerifiedRecipeCatalogService.list('member', { summaryOnly: true });
  assert.equal(result.restrictedProfile, true);
  assert.equal(result.total, 3);
  assert.deepEqual('eligibleIds' in result ? result.eligibleIds : [], ['eligible-0', 'eligible-1', 'eligible-2']);
  assert.deepEqual(result.items, []);
});

test('history count uses the authenticated member and the same default statuses as history', async (t) => {
  const { getPlanHistoryCount } = await import('../src/controllers/meals-history.controller');
  replaceMethod(t, prisma.mealLog, 'count', async ({ where }: any) => {
    assert.deepEqual(where, { userId: 'member-123', status: { in: ['DONE', 'SKIPPED', 'VOIDED'] } });
    return 0;
  });
  let body: unknown;
  await getPlanHistoryCount(
    { user: { userId: 'member-123' }, query: { userId: 'another-member' } } as unknown as AuthenticatedRequest,
    {
      json: (value: unknown) => {
        body = value;
      },
    } as Response
  );
  assert.deepEqual(body, { success: true, data: { total: 0 } });
});
