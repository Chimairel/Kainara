import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';

test('retained intake keeps its source photo and recorded nutrients with owner-scoped reads', async (context) => {
  const previous = process.env.CLINICAL_CLARIFICATIONS_ENABLED;
  process.env.CLINICAL_CLARIFICATIONS_ENABLED = 'true';
  context.after(() => {
    process.env.CLINICAL_CLARIFICATIONS_ENABLED = previous;
  });
  const { retainedMealsForCycle } = await import('../src/services/plan-repair-history.service');
  const { resolvePlanImage } = await import('../src/services/meal-plan-presentation.service');
  const raw = {
    recipeName: 'Recorded meal',
    sourceName: 'PANLASANG_PINOY',
    sourceUrl: 'https://panlasangpinoy.com/recorded-meal/',
    sourceImageUrl: 'https://panlasangpinoy.com/wp-content/uploads/2026/10/recorded-meal.jpg',
    sourceVideoUrl: null,
  };
  const client = {
    mealPlanRepairReceipt: {
      findFirst: async (args: any) => {
        assert.deepEqual(args.where, { userId: 'owner', replacementCycleId: 'new-cycle' });
        return { retainedMealIds: ['old-meal'] };
      },
    },
    mealPlan: {
      findMany: async (args: any) => {
        assert.equal(args.where.userId, 'owner');
        assert.equal(args.where.mealLogs.some.userId, 'owner');
        assert.deepEqual(args.where.mealLogs.some.status.in, ['DONE', 'SKIPPED']);
        assert.equal(args.select.sourceRawRecipeCandidate.select.sourceImageUrl, true);
        return [
          {
            id: 'old-meal',
            mealName: raw.recipeName,
            calories: 999,
            proteinG: 99,
            carbsG: 99,
            fatG: 99,
            sourceRawRecipeCandidate: raw,
            mealLogs: [{ id: 'log', status: 'DONE', calories: 912, proteinG: 30, carbsG: 139, fatG: 26 }],
          },
        ];
      },
    },
  } as unknown as Pick<Prisma.TransactionClient, 'mealPlan' | 'mealPlanRepairReceipt'>;
  const rows = await retainedMealsForCycle('owner', 'new-cycle', client);
  assert.equal(resolvePlanImage(rows[0])?.url, raw.sourceImageUrl);
  assert.deepEqual([rows[0].calories, rows[0].proteinG, rows[0].carbsG, rows[0].fatG], [912, 30, 139, 26]);
  assert.equal(rows[0].mealLogs[0].id, 'log');
});
