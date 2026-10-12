import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';

process.env.CLINICAL_CLARIFICATIONS_ENABLED = 'true';

test('a second profile edit advances an empty waiting cycle without inventing meal withdrawals', async () => {
  const { withdrawOutdatedMealReviews } = await import('../src/services/outdated-meal-review.service');
  let cycleRevision = 3;
  let mealWrites = 0;
  let auditWrites = 0;
  let groceriesStale = false;
  const tx = {
    mealPlan: {
      findMany: async () => [],
      updateMany: async () => {
        mealWrites++;
      },
    },
    mealPlanCycle: {
      findMany: async () => [{ id: 'waiting-cycle' }],
      updateMany: async (args: Prisma.MealPlanCycleUpdateManyArgs) => {
        assert.deepEqual(args.where, { id: { in: ['waiting-cycle'] } });
        cycleRevision = args.data.requestedProfileRevision as number;
        assert.equal(args.data.acknowledgedProfileRevision, null);
      },
    },
    auditEvent: {
      createMany: async () => {
        auditWrites++;
      },
    },
    groceryList: {
      updateMany: async () => {
        groceriesStale = true;
      },
    },
  } as unknown as Prisma.TransactionClient;
  await withdrawOutdatedMealReviews(tx, 'member', 4);
  assert.equal(cycleRevision, 4);
  assert.equal(mealWrites, 0);
  assert.equal(auditWrites, 0);
  assert.equal(groceriesStale, true);
});
