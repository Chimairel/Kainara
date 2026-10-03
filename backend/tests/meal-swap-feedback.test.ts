import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { recordMealSwapNotification } from '../src/services/meal-swap-feedback.service';
import { MealSwapService } from '../src/services/meal-swap.service';

test('swap feedback uses the actual allowance and supports the final and unlimited swaps', async () => {
  for (const allowance of [{ limit: 6, used: 4 }, { limit: 3, used: 2 }, undefined]) {
    const rows: unknown[] = [];
    const tx = {
      notification: {
        create: async (input: unknown) => {
          rows.push(input);
        },
      },
    } as unknown as Prisma.TransactionClient;
    const remaining = await recordMealSwapNotification(tx, 'fixture-owner', allowance);
    assert.equal(remaining, allowance ? allowance.limit - allowance.used - 1 : null);
    assert.equal(rows.length, 1);
    const data = (rows[0] as { data: { userId: string; message: string; type: string } }).data;
    assert.equal(data.userId, 'fixture-owner');
    assert.equal(data.type, 'MEMBERSHIP_UPDATED');
    assert.match(data.message, /used 1 meal swap/);
    if (remaining === 1) assert.match(data.message, /1 swap left/);
    if (remaining === 0) assert.match(data.message, /0 swaps left/);
    if (remaining === null) assert.doesNotMatch(data.message, /left|unlimited/);
  }
});

for (const replacement of ['fixture-library', 'source:fixture-source']) {
  test(`a replay of ${replacement} returns success without another notification or allowance use`, async (context) => {
    const tx = {
      $executeRaw: async () => 1,
      $queryRaw: async () => [],
      swapLog: { findUnique: async () => ({ mealPlanId: 'fixture-slot', newLibraryMealId: replacement }) },
      mealPlan: { findUniqueOrThrow: async () => ({ id: 'fixture-slot' }) },
      notification: {
        create: async () => {
          throw new Error('Replay must not write a notification');
        },
      },
    } as unknown as Prisma.TransactionClient;
    context.mock.method(prisma, '$transaction', async (work: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      work(tx)
    );
    const result = await MealSwapService.swapMeal(
      'fixture-owner',
      'fixture-slot',
      replacement,
      false,
      true,
      'expired-but-already-applied',
      'fixture-key'
    );
    assert.equal(result.success, true);
    assert.equal(result.swapsRemaining, null);
  });

  test(`an invalid ${replacement} request fails before notification creation`, async (context) => {
    const tx = {
      $executeRaw: async () => 1,
      $queryRaw: async () => [],
      notification: {
        create: async () => {
          throw new Error('Invalid swap must not write a notification');
        },
      },
    } as unknown as Prisma.TransactionClient;
    context.mock.method(prisma, '$transaction', async (work: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      work(tx)
    );
    await assert.rejects(MealSwapService.swapMeal('fixture-owner', 'fixture-slot', replacement), /Preview this swap/);
  });
}
