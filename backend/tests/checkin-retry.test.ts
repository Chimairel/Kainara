import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { CheckinService } from '../src/services/checkin.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';

for (const changed of [false, true]) {
  test(`a saved cycle check-in is returned without another write on retry (changed=${changed})`, async (context) => {
    const startDate = new Date('2026-09-28T00:00:00Z');
    const saved = { id: 'saved-checkin', userId: 'patient', cycleStartDate: startDate, submittedWeightKg: 60 };
    context.mock.method(CheckinService, 'getCheckinStatus', async () => ({ isDue: false }));
    context.mock.method(MealPlanCycleService, 'getCurrentCycle', async () => ({ id: 'cycle', startDate }));
    const originalFind = prisma.weeklyCheckin.findUnique;
    context.after(() => {
      prisma.weeklyCheckin.findUnique = originalFind;
    });
    prisma.weeklyCheckin.findUnique = (async (args: Prisma.WeeklyCheckinFindUniqueArgs) => {
      assert.deepEqual(args.where.userId_cycleStartDate, { userId: 'patient', cycleStartDate: startDate });
      return saved;
    }) as unknown as typeof prisma.weeklyCheckin.findUnique;
    context.mock.method(prisma, '$transaction', async () => {
      throw new Error('A retry must not write.');
    });
    const result = await CheckinService.submitCheckin(
      'patient',
      changed ? { changed: true, updates: { weightKg: 80 } } : { changed: false }
    );
    assert.equal(result.duplicate, true);
    assert.equal(result.id, saved.id);
    assert.equal(result.submittedWeightKg, 60);
  });
}

test('an unrecorded check-in is still rejected before its due date', async (context) => {
  context.mock.method(CheckinService, 'getCheckinStatus', async () => ({ isDue: false }));
  context.mock.method(MealPlanCycleService, 'getCurrentCycle', async () => ({ id: 'cycle', startDate: new Date() }));
  const originalFind = prisma.weeklyCheckin.findUnique;
  context.after(() => {
    prisma.weeklyCheckin.findUnique = originalFind;
  });
  prisma.weeklyCheckin.findUnique = (async () => null) as unknown as typeof prisma.weeklyCheckin.findUnique;
  context.mock.method(prisma, '$transaction', async () => {
    throw new Error('A premature check-in must not write.');
  });
  await assert.rejects(() => CheckinService.submitCheckin('patient', { changed: false }), /not due yet/);
});
