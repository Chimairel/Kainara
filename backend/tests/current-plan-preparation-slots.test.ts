import assert from 'node:assert/strict';
import test from 'node:test';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../src/types';
import { getManilaDateKey, getManilaMidnight } from '../src/domain/meal-plan-cycle.policy';

test('current plan exposes only actual generation gaps, counting retained meals and unavailable approvals as occupied', async (context) => {
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  const date = getManilaMidnight(getManilaDateKey(new Date()));
  const retained = {
    id: 'eaten-lunch',
    mealName: 'Recorded lunch',
    mealType: 'LUNCH',
    scheduledDate: date,
    calories: 400,
    proteinG: 20,
    carbsG: 50,
    fatG: 10,
    mealLogs: [{ status: 'DONE', calories: 400, proteinG: 20, carbsG: 50, fatG: 10 }],
  };
  const unavailable = { ...retained, id: 'held-breakfast', mealType: 'BREAKFAST', status: 'APPROVED', mealLogs: [] };
  globals.prisma = {
    mealPlan: { findMany: async (args: any) => (args.where.id ? [retained] : [unavailable]) },
    mealPlanRepairReceipt: { findFirst: async () => ({ retainedMealIds: [retained.id] }) },
    mealPlanCycleSnapshot: { findUnique: async () => null },
    mealPlanGenerationJob: { findUnique: async () => ({ status: 'GENERATING' }) },
  };
  context.after(() => {
    globals.prisma = previous;
  });
  const { MealPlanCycleService } = await import('../src/services/meal-plan-cycle.service');
  context.mock.method(MealPlanCycleService, 'getCurrentCycleWithClearance', async () => ({
    cycle: { id: 'cycle', startDate: date, endDate: date, expectedSlotCount: 3 },
    clearedIds: [],
  }));
  const { getCurrentPlan } = await import('../src/controllers/meals/plan-read');
  let body: any;
  const res = {
    locals: {},
    once: () => undefined,
    setHeader: () => undefined,
    status: (code: number) => {
      assert.equal(code, 200);
      return res;
    },
    json: (value: unknown) => {
      body = value;
      return res;
    },
  };
  await getCurrentPlan({ user: { userId: 'fixture' } } as AuthenticatedRequest, res as unknown as Response);
  assert.equal(body.meta.retainedMealLogs[0].id, retained.id);
  assert.equal(body.meta.cycle.unavailableMealCount, 1);
  assert.equal(body.meta.awaitingGenerationCount, 1);
  assert.deepEqual(body.meta.awaitingGenerationSlots, [{ dayNumber: 1, mealType: 'DINNER', scheduledDate: date }]);
  assert.deepEqual(body.data, []);
});
