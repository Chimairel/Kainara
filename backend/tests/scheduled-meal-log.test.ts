import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { updateScheduledMealStatus } from '../src/services/scheduled-meal-log.service';

for (const scenario of ['missing', 'pending', 'uncleared', 'ready'] as const) {
  test(`scheduled logging preserves transactional guards: ${scenario}`, async (context) => {
    const order: string[] = [];
    const scheduledDate = new Date();
    const row = {
      id: 'slot',
      userId: 'patient',
      planGroupId: 'cycle',
      scheduledDate,
      status: scenario === 'pending' ? 'PENDING_REVIEW' : 'APPROVED',
      requiresSafetyRevalidation: false,
      mealName: 'Fixture meal',
      mealType: 'LUNCH',
      calories: 400,
      proteinG: 20,
      carbsG: 50,
      fatG: 10,
    };
    let written: Prisma.MealLogUpsertArgs | undefined;
    const tx = {
      $executeRaw: async () => {
        order.push('global lock');
        return 1;
      },
      $queryRaw: async () => {
        order.push('profile lock');
        return [];
      },
      mealPlan: {
        findFirst: async (args: Prisma.MealPlanFindFirstArgs) => {
          order.push('owned plan');
          assert.equal(args.where?.userId, 'patient');
          assert.equal(args.where?.id, 'slot');
          return scenario === 'missing' ? null : row;
        },
      },
      mealLog: {
        upsert: async (args: Prisma.MealLogUpsertArgs) => {
          order.push('write');
          written = args;
          return { id: 'log' };
        },
      },
    };
    context.mock.method(prisma, '$transaction', async (work: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      work(tx as unknown as Prisma.TransactionClient)
    );
    context.mock.method(
      MealPlanCycleService,
      'getClearedMealPlanIds',
      async (_user: string, _cycle: string, _now: Date, client: unknown) => {
        assert.equal(client, tx);
        order.push('clearance');
        return scenario === 'uncleared' ? [] : ['slot'];
      }
    );
    if (scenario !== 'ready') {
      await assert.rejects(
        () => updateScheduledMealStatus('patient', 'slot', 'DONE'),
        scenario === 'missing' ? /not found/ : scenario === 'pending' ? /not currently loggable/ : /safety revalidation/
      );
      assert.equal(written, undefined);
    } else {
      await updateScheduledMealStatus('patient', 'slot', 'DONE', 'Fixture note');
      assert.deepEqual(order, ['global lock', 'profile lock', 'owned plan', 'clearance', 'write']);
      assert.equal(written?.create.loggedAt, scheduledDate);
      assert.equal(written?.update.status, 'DONE');
      assert.equal(written?.create.notes, 'Fixture note');
    }
  });
}
