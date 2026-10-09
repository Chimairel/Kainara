import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { assertGenerationIntegrity } from '../src/services/generation-integrity.service';

const start = new Date('2026-10-10T00:00:00+08:00'),
  end = new Date('2026-10-13T00:00:00+08:00');
function client(purchased = 0) {
  return {
    foodItem: { findMany: async () => [] },
    mealPlan: { findMany: async () => [{ id: 'logged', planGroupId: 'old', mealLogs: [{ id: 'log' }] }] },
    groceryItem: { count: async () => purchased },
  } as unknown as Prisma.TransactionClient;
}
test('ordinary generation keeps its history protection; repairs allow only explicitly reconciled records', async () => {
  await assert.rejects(
    () => assertGenerationIntegrity(client(), 'member', start, end, new Map()),
    /purchases or logged meals/
  );
  await assert.rejects(
    () =>
      assertGenerationIntegrity(client(), 'member', start, end, new Map(), {
        retainedMealIds: ['other'],
        purchasedItemIds: [],
      }),
    /purchases or logged meals/
  );
  await assertGenerationIntegrity(client(), 'member', start, end, new Map(), {
    retainedMealIds: ['logged'],
    purchasedItemIds: [],
  });
  await assert.rejects(
    () =>
      assertGenerationIntegrity(client(1), 'member', start, end, new Map(), {
        retainedMealIds: ['logged'],
        purchasedItemIds: [],
      }),
    /purchases or logged meals/
  );
});
