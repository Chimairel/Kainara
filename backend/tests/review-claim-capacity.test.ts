import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { assertCaseClaimCapacity } from '../src/services/review-claim-capacity.service';

  test('locks the reviewer before checking a second case across tabs', async () => {
    const order: string[] = [];
    const tx = { $queryRaw: async () => { order.push('lock'); return [{ id: 'rnd' }]; },
      mealPlan: { findFirst: async () => { order.push('check'); return { id: 'existing' }; } } };
    await assert.rejects(assertCaseClaimCapacity(tx as unknown as Prisma.TransactionClient, 'rnd', 'new'), { errorCode: 'REVIEW_CLAIM_LIMIT' });
    assert.deepEqual(order, ['lock', 'check']);
  });
  test('ignores the same case, expired claims and terminal work', async () => {
    const now = new Date('2026-10-15T00:00:00Z');
    let received: Record<string, unknown> = {};
    const findFirst = async (input: Record<string, unknown>) => { received = input; return null; };
    const tx = { $queryRaw: async () => [], mealPlan: { findFirst } };
    await assertCaseClaimCapacity(tx as unknown as Prisma.TransactionClient, 'rnd', 'same', now);
    const where = received.where as Record<string, unknown>;
    assert.equal(where.status, 'PENDING_REVIEW');
    assert.deepEqual(where.id, { not: 'same' });
    assert.equal(where.claimedByNutritionistId, 'rnd');
    assert.deepEqual(where.claimedAt, { gte: new Date('2026-10-14T23:30:00Z') });
  });
