import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { MembershipService } from '../src/services/membership.service';
import { MealGenerationService } from '../src/services/meal-generation.service';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';

const start = new Date('2026-10-04T16:00:00.000Z');
const membershipState = (enhanced: boolean, healthAccess: boolean, requiresCaseReview = false) =>
  ({ enhanced, healthAccess, requiresCaseReview, healthUntil: new Date('2099-01-01') }) as Awaited<
    ReturnType<typeof MembershipService.state>
  >;

test('swap enforcement allows the last swap and denies another under the current tier, preserving cycle usage', async (t) => {
  const priorEnabled = process.env.MEMBERSHIP_ENABLED;
  const priorLifestyle = process.env.MEMBERSHIP_LIFESTYLE_CYCLE_SWAPS;
  const priorHealth = process.env.MEMBERSHIP_HEALTH_CYCLE_SWAPS;
  process.env.MEMBERSHIP_ENABLED = 'true';
  delete process.env.MEMBERSHIP_LIFESTYLE_CYCLE_SWAPS;
  delete process.env.MEMBERSHIP_HEALTH_CYCLE_SWAPS;
  try {
    let used = 0;
    let access = membershipState(false, false);
    const countedPeriods: unknown[] = [];
    const tx = {
      mealPlanCycle: { findFirstOrThrow: async () => ({ startDate: start, planType: 'WEEKLY' }) },
      swapLog: {
        count: async (query: unknown) => {
          countedPeriods.push(query);
          return used;
        },
      },
    } as unknown as Prisma.TransactionClient;
    t.mock.method(MembershipService, 'state', async () => access);
    for (const [enhanced, healthAccess, cap] of [
      [false, false, 3],
      [true, false, 10],
      [true, true, 21],
    ] as const) {
      access = membershipState(enhanced, healthAccess);
      used = cap - 1;
      assert.deepEqual(await MembershipService.assertSwap('member', 'revision-2', tx), { limit: cap, used });
      used++;
      await assert.rejects(MembershipService.assertSwap('member', 'revision-2', tx), {
        errorCode: 'MEMBERSHIP_SWAP_LIMIT',
      });
    }
    assert.ok(
      countedPeriods.every(
        (query) =>
          JSON.stringify(query) ===
          JSON.stringify({
            where: {
              mealPlan: { userId: 'member', cycle: { userId: 'member', startDate: start, planType: 'WEEKLY' } },
            },
          })
      )
    );
    // A downgrade does not discard the swaps already used in this cycle.
    access = membershipState(true, false);
    used = 12;
    await assert.rejects(MembershipService.assertSwap('member', 'revision-3', tx), {
      errorCode: 'MEMBERSHIP_SWAP_LIMIT',
    });
  } finally {
    for (const [key, value] of [
      ['MEMBERSHIP_ENABLED', priorEnabled],
      ['MEMBERSHIP_LIFESTYLE_CYCLE_SWAPS', priorLifestyle],
      ['MEMBERSHIP_HEALTH_CYCLE_SWAPS', priorHealth],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  }
});

test('member whole-plan replacement and legacy replan reservations fail before any database work', async (t) => {
  const readiness = t.mock.method(ClinicalEvidenceService, 'assertReadyForMealPlanning', async () => {
    throw new Error('Unexpected account read');
  });
  await assert.rejects(MealGenerationService.generatePlanForUser('member', start, { replaceExisting: true }), {
    errorCode: 'PLAN_REPLACEMENT_UNAVAILABLE',
  });
  await assert.rejects(MembershipService.reserve('member', 'REPLAN', 'old-request', 'payload', prisma), {
    errorCode: 'PLAN_REPLACEMENT_UNAVAILABLE',
  });
  assert.equal(readiness.mock.callCount(), 0);
});

test('internal rebuilds reserve only case review, and admitted safety repairs still need no credits', async (t) => {
  const priorEnabled = process.env.MEMBERSHIP_ENABLED;
  const priorReview = process.env.MEMBERSHIP_WEEKLY_PLAN_REVIEWS;
  process.env.MEMBERSHIP_ENABLED = 'true';
  delete process.env.MEMBERSHIP_WEEKLY_PLAN_REVIEWS;
  try {
    let access = membershipState(true, true);
    let repair = false;
    const created: string[] = [];
    const tx = {
      $executeRaw: async () => 0,
      $queryRaw: async () => [],
      membershipUsage: {
        findUnique: async () => null,
        count: async () => 0,
        create: async ({ data }: { data: { feature: string } }) => {
          created.push(data.feature);
          return { id: 'reservation' };
        },
      },
    } as unknown as Prisma.TransactionClient;
    t.mock.method(prisma, '$transaction', async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(tx)
    );
    t.mock.method(MembershipService, 'state', async () => access);
    t.mock.method(MembershipService, 'isSafetyRepair', async () => repair);
    assert.deepEqual(await MembershipService.admitPlan('general-member', start, true, 'system-rebuild'), []);
    access = membershipState(true, true, true);
    assert.deepEqual(await MembershipService.admitPlan('case-member', start, true, 'system-case-rebuild'), [
      { id: 'reservation', replayed: false },
    ]);
    assert.deepEqual(created, ['PLAN_REVIEW']);
    access = membershipState(false, false, true);
    await assert.rejects(MembershipService.admitPlan('expired-case', start, false, 'next-cycle'), {
      errorCode: 'CASE_MEMBERSHIP_REQUIRED',
    });
    repair = true;
    assert.deepEqual(await MembershipService.admitPlan('expired-case', start, true, 'safety-repair'), []);
    assert.deepEqual(created, ['PLAN_REVIEW']);
  } finally {
    if (priorEnabled === undefined) delete process.env.MEMBERSHIP_ENABLED;
    else process.env.MEMBERSHIP_ENABLED = priorEnabled;
    if (priorReview === undefined) delete process.env.MEMBERSHIP_WEEKLY_PLAN_REVIEWS;
    else process.env.MEMBERSHIP_WEEKLY_PLAN_REVIEWS = priorReview;
  }
});
