import assert from 'node:assert/strict';
import test from 'node:test';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import type { Prisma } from '@prisma/client';

test('current lifecycle reads exclude completed history before loading meal evidence', async (t) => {
  let observed: any;
  const findMany = t.mock.fn(async (query: Prisma.MealPlanCycleFindManyArgs) => {
    observed = query;
    return [];
  });
  const users = t.mock.fn(async () => {
    throw new Error('History must not be rechecked');
  });
  const client = { mealPlanCycle: { findMany }, user: { findUnique: users } } as unknown as Parameters<
    typeof MealPlanCycleService.synchronizeLifecycle
  >[2];
  await MealPlanCycleService.synchronizeLifecycle('member', new Date(), client);
  assert.deepEqual(observed.where.status, { notIn: ['SUPERSEDED', 'COMPLETED'] });
  assert.equal(users.mock.callCount(), 0);
});
