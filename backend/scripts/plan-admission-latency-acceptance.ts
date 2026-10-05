import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55473');
  assert.equal(target.pathname, '/membership_acceptance');
  assert.equal(process.env.NODE_ENV, 'test');
  process.env.MEMBERSHIP_ENABLED = 'true';
  process.env.PAYMONGO_INTEGRATION_ENABLED = 'true';
  process.env.PAYMONGO_ENVIRONMENT = 'TEST';
  process.env.PAYMONGO_SECRET_KEY = 'sk_test_' + 'synthetic_fixture_only'.repeat(2);
  process.env.FRONTEND_URL = 'http://localhost:3000';
  const { default: prisma } = await import('../src/lib/prisma');
  const { MembershipService: membership } = await import('../src/services/membership.service');
  const { membershipWeek } = await import('../src/domain/membership.policy');
  const { getManilaDateKey, getManilaMidnight } = await import('../src/domain/meal-plan-cycle.policy');
  const { testCheckoutConfig } = await import('../src/domain/membership-checkout.policy');
  assert.ok(testCheckoutConfig(), 'Exercise the checkout read from the reported error.');
  const ids: string[] = [];
  const originalState = membership.state;
  const now = new Date();
  const day = getManilaMidnight(getManilaDateKey(now));
  const create = async (restricted = true) => {
    const id = `admission-fixture-${randomUUID()}`;
    ids.push(id);
    await prisma.user.create({
      data: {
        id,
        role: 'USER',
        name: 'Synthetic admission fixture',
        email: `${id}@example.invalid`,
        passwordHash: 'not-a-login-password',
        onboardingDone: true,
        userProfile: { create: {} },
        ...(restricted ? { healthConditions: { create: { condition: 'HEART_CONDITION' } } } : {}),
      },
    });
    return id;
  };
  try {
    // Delay real reads inside the actual admission transaction beyond Prisma's
    // default lifetime, then verify that the reservation commits exactly once.
    const slow = await create();
    let stateReads = 0;
    membership.state = async (userId, at, client) => {
      stateReads++;
      assert.ok(client, 'Entitlement must be read on the locked transaction.');
      await client.$queryRaw`SELECT 1 FROM pg_sleep(5.5)`;
      return originalState.call(membership, userId, at, client);
    };
    const started = Date.now();
    const admission = await membership.admitPlan(slow, day, false, 'slow-job');
    membership.state = originalState;
    assert.ok(Date.now() - started >= 5500);
    assert.equal(stateReads, 1);
    assert.equal(admission.length, 1);
    assert.equal(await prisma.membershipUsage.count({ where: { userId: slow, feature: 'PLAN_REVIEW' } }), 1);
    await assert.rejects(membership.admitPlan(slow, day, false, 'same-week-peer'), {
      errorCode: 'MEMBERSHIP_REQUEST_IN_PROGRESS',
    });
    await membership.complete(admission[0].id);
    assert.deepEqual(await membership.admitPlan(slow, day, false, 'completed-replay'), []);
    // Failed generation can release an unfinished reservation and safely retry.
    const retry = await create();
    const first = await membership.admitPlan(retry, day, false, 'failed-job');
    await membership.release(first[0].id);
    assert.equal((await membership.admitPlan(retry, day, false, 'retry-job')).length, 1);

    // Per-member locking must serialize simultaneous plan review admissions.
    const concurrent = await create();
    const outcomes = await Promise.allSettled([
      membership.admitPlan(concurrent, day, false, 'peer-a'),
      membership.admitPlan(concurrent, day, false, 'peer-b'),
    ]);
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    const failure = outcomes.find((outcome) => outcome.status === 'rejected');
    assert.equal(failure?.status === 'rejected' && failure.reason.errorCode, 'MEMBERSHIP_REQUEST_IN_PROGRESS');
    assert.equal(await prisma.membershipUsage.count({ where: { userId: concurrent } }), 1);

    // Internal rebuilds retain case-review admission without creating replan reservations.
    const replan = await create();
    const reservations = await membership.admitPlan(replan, day, true, 'replan-job', 'replan-key');
    assert.equal(reservations.length, 1);
    for (const row of reservations) await membership.complete(row.id);
    await assert.rejects(membership.admitPlan(replan, day, true, 'other-job', 'other-key'), {
      errorCode: 'MEMBERSHIP_USAGE_LIMIT',
    });
    assert.equal(await prisma.membershipUsage.count({ where: { userId: replan, feature: 'REPLAN' } }), 0);
    assert.equal(await prisma.membershipUsage.count({ where: { userId: replan, feature: 'PLAN_REVIEW' } }), 1);

    // Expired case access remains blocked, while admitted safety repair is free.
    const expired = await create();
    await prisma.membershipAccount.create({
      data: {
        userId: expired,
        createdAt: new Date(now.getTime() - 31 * 86_400_000),
        trialStartedAt: new Date(now.getTime() - 31 * 86_400_000),
      },
    });
    await assert.rejects(membership.admitPlan(expired, day, false, 'expired-job'), {
      errorCode: 'CASE_MEMBERSHIP_REQUIRED',
    });
    assert.equal(await prisma.membershipUsage.count({ where: { userId: expired } }), 0);
    const week = membershipWeek(day);
    const cycle = await prisma.mealPlanCycle.create({
      data: {
        id: randomUUID(),
        userId: expired,
        planType: 'STARTER',
        startDate: day,
        endDate: day,
        preparationOpensAt: day,
        shoppingDeadlineAt: day,
        expectedSlotCount: 3,
        profileAdaptationState: 'SAFETY_REVALIDATION_REQUIRED',
      },
    });
    await prisma.membershipUsage.create({
      data: {
        userId: expired,
        feature: 'PLAN_REVIEW',
        requestKey: 'previous-case',
        payloadHash: '0'.repeat(64),
        createdAt: now,
        windowStart: week.start,
        windowEnd: week.end,
        reservedUntil: new Date(now.getTime() + 60_000),
        completedAt: now,
        resultEntityId: cycle.id,
      },
    });
    assert.deepEqual(await membership.admitPlan(expired, day, true, 'repair-job'), []);
    const general = await create(false);
    assert.deepEqual(await membership.admitPlan(general, day, false, 'general-job'), []);
    console.log('Plan admission latency, concurrency, replay, retry, caps, rollback, expiry and safety repair passed.');
  } finally {
    membership.state = originalState;
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
