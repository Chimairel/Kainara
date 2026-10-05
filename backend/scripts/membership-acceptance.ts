import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/membership_acceptance')
    throw new Error('Membership acceptance requires the disposable local membership_acceptance database.');
  process.env.MEMBERSHIP_ENABLED = 'true';
  // This suite verifies unavailable checkout; the separate checkout suite tests payments.
  process.env.PAYMONGO_INTEGRATION_ENABLED = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'membership-acceptance-access-fixture';
  process.env.JWT_REFRESH_SECRET = 'membership-acceptance-refresh-fixture';
  const { default: prisma } = await import('../src/lib/prisma');
  const { MembershipService: membership } = await import('../src/services/membership.service');
  const { MealPlanCycleService } = await import('../src/services/meal-plan-cycle.service');
  const { UserProfileService } = await import('../src/services/user-profile.service');
  const { MealLogService } = await import('../src/services/meal-log.service');
  const { membershipWeek, MEMBERSHIP_TRIAL_DAYS } = await import('../src/domain/membership.policy');
  const { getManilaDateKey, getManilaMidnight, getScheduledMealDate, getMealPlanCycleTiming } =
    await import('../src/domain/meal-plan-cycle.policy');
  const { default: router } = await import('../src/routes/membership.routes');
  const { errorHandler } = await import('../src/middleware/errorHandler');
  const ids: string[] = [];
  const now = new Date();
  const day = getManilaMidnight(getManilaDateKey(now));
  const past = new Date(now.getTime() - (MEMBERSHIP_TRIAL_DAYS + 2) * 86_400_000);
  const expired = new Date(now.getTime() - (MEMBERSHIP_TRIAL_DAYS + 1) * 86_400_000);
  let server: ReturnType<express.Express['listen']> | undefined;
  const create = async (role: 'USER' | 'ADMIN' | 'NUTRITIONIST' = 'USER') => {
    const id = `membership-fixture-${randomUUID()}`;
    ids.push(id);
    await prisma.user.create({
      data: {
        id,
        role,
        email: `${id}@example.invalid`,
        name: 'Disposable membership fixture',
        passwordHash: 'fixture-not-a-login-password',
        emailVerified: true,
        onboardingDone: true,
        userProfile: {
          create: {
            age: 26,
            biologicalSex: 'MALE',
            heightCm: 170,
            weightKg: 65,
            goal: 'MAINTAIN',
            activityLevel: 'SEDENTARY',
            dietaryPreference: 'OMNIVORE',
          },
        },
      },
    });
    return id;
  };
  const setExpired = (userId: string) =>
    prisma.membershipAccount.upsert({
      where: { userId },
      create: { userId, createdAt: past, trialStartedAt: expired },
      update: { createdAt: past, trialStartedAt: expired },
    });
  try {
    const free = await create();
    assert.equal((await membership.view(free)).enabled, true);
    assert.equal((await membership.state(free)).level, 'TRIAL_PENDING');
    await Promise.all([membership.startTrial(free, now), membership.startTrial(free, now)]);
    const start = (await membership.state(free)).account.trialStartedAt!;
    await membership.startTrial(free, new Date());
    assert.equal((await membership.state(free)).account.trialStartedAt!.getTime(), start.getTime());
    await setExpired(free);
    assert.equal((await membership.state(free)).level, 'FREE');
    await membership.assertNewPlan(free, getScheduledMealDate(day, 7));
    await assert.rejects(membership.assertEnhanced(free), { errorCode: 'MEMBERSHIP_REQUIRED' });
    // Saving body and optional goals remains available; report activation now gates applying them.
    await UserProfileService.updateUserProfile(free, { heightCm: 171 });
    await UserProfileService.updateUserProfile(free, { goal: 'LOSE_WEIGHT' });

    const reserve = (key: string, feature: 'AI_ESTIMATE' | 'OUTSIDE_REVIEW' = 'AI_ESTIMATE', owner = free) =>
      prisma.$transaction((tx) => membership.reserve(owner, feature, key, key, tx), { timeout: 15_000 });
    const concurrent = await Promise.allSettled(Array.from({ length: 6 }, (_, n) => reserve(`parallel-${n}`)));
    assert.equal(concurrent.filter((r) => r.status === 'fulfilled').length, 2);
    assert.equal(
      concurrent.filter((r) => r.status === 'rejected' && r.reason.errorCode === 'MEMBERSHIP_USAGE_LIMIT').length,
      4
    );
    const reservations = concurrent.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
    await membership.release(reservations[0].id);
    const success = (await reserve('successful-estimate'))!;
    await membership.complete(success.id);
    assert.equal((await reserve('successful-estimate'))!.replayed, true);
    await assert.rejects(
      prisma.$transaction((tx) => membership.reserve(free, 'AI_ESTIMATE', 'successful-estimate', 'different', tx)),
      { errorCode: 'REQUEST_KEY_COLLISION' }
    );
    await assert.rejects(reserve('second-copy'), { errorCode: 'MEMBERSHIP_USAGE_LIMIT' });
    await assert.rejects(reserve('free-review', 'OUTSIDE_REVIEW'), { errorCode: 'MEMBERSHIP_REQUIRED' });
    await prisma.membershipUsage.update({
      where: { id: reservations[1].id },
      data: { reservedUntil: new Date(Date.now() - 1) },
    });
    const retry = (await reserve('released-lease'))!;
    await membership.release(retry.id);
    const view = await membership.view(free);
    assert.ok(view.enabled);
    assert.equal(view.usage.AI_ESTIMATE.used, 1);
    assert.equal(view.usage.AI_ESTIMATE.remaining, 1);
    assert.equal(view.price, null);
    assert.equal(view.purchasesAvailable, false);

    // Run the actual estimate/preview path with a provider fixture, without calling Gemini.
    const estimateOwner = await create();
    await setExpired(estimateOwner);
    const estimator = MealLogService as unknown as {
      estimateWithAi: (items: { name: string }[]) => Promise<
        Array<{
          name: string;
          calories: number;
          calorieLow: number;
          calorieHigh: number;
          proteinG: number;
          carbsG: number;
          fatG: number;
          ingredients: string[];
        }>
      >;
    };
    const originalEstimator = estimator.estimateWithAi;
    let providerCalls = 0;
    const aiInput = (key: string) => ({
      userId: estimateOwner,
      mealName: 'Uncatalogued fixture food',
      mealType: 'LUNCH' as const,
      useAiEstimate: true,
      requestKey: key,
    });
    try {
      estimator.estimateWithAi = async () => {
        providerCalls++;
        throw new Error('Fixture provider outage');
      };
      await assert.rejects(MealLogService.logOutsideMeal(aiInput(`failed:${randomUUID()}`)), /Fixture provider outage/);
      assert.equal(await prisma.membershipUsage.count({ where: { userId: estimateOwner } }), 0);
      estimator.estimateWithAi = async (items) => {
        providerCalls++;
        return items.map((item) => ({
          name: item.name,
          calories: 400,
          calorieLow: 350,
          calorieHigh: 450,
          proteinG: 20,
          carbsG: 50,
          fatG: 13,
          ingredients: ['rice'],
        }));
      };
      const key = `success:${randomUUID()}`;
      await MealLogService.logOutsideMeal(aiInput(key));
      await MealLogService.logOutsideMeal(aiInput(key));
      assert.equal(providerCalls, 2); // One failure and one success; replay never calls the provider.
      await MealLogService.logOutsideMeal(aiInput(`second:${randomUUID()}`));
      await assert.rejects(MealLogService.logOutsideMeal(aiInput(`blocked:${randomUUID()}`)), {
        errorCode: 'MEMBERSHIP_USAGE_LIMIT',
      });
      assert.equal(providerCalls, 3);
      await MealLogService.logOutsideMeal({
        userId: estimateOwner,
        mealName: 'Manual fixture food',
        mealType: 'LUNCH',
        useAiEstimate: false,
      });
    } finally {
      estimator.estimateWithAi = originalEstimator;
    }

    const caseUser = await create();
    await setExpired(caseUser);
    await prisma.allergy.create({ data: { userId: caseUser, allergen: 'EGGS' } });
    // Supported allergies alone use general planning; diabetes makes this a case episode.
    await prisma.healthCondition.create({ data: { userId: caseUser, condition: 'DIABETES' } });
    await assert.rejects(membership.assertNewPlan(caseUser, day), { errorCode: 'CASE_MEMBERSHIP_REQUIRED' });
    const timing = getMealPlanCycleTiming('WEEKLY', day, 7);
    const cycle = await prisma.mealPlanCycle.create({
      data: {
        id: randomUUID(),
        userId: caseUser,
        planType: 'WEEKLY',
        ...timing,
        expectedSlotCount: 21,
        status: 'REVALIDATION_REQUIRED',
        profileAdaptationState: 'SAFETY_REVALIDATION_REQUIRED',
        pendingProfileChangeKinds: ['SAFETY'],
      },
    });
    // This is follow-up on an already admitted case episode, not a new condition on a general plan.
    const admittedWeek = membershipWeek(day);
    await prisma.membershipUsage.create({
      data: {
        userId: caseUser,
        createdAt: now,
        feature: 'PLAN_REVIEW',
        requestKey: 'previous-case',
        payloadHash: '0'.repeat(64),
        windowStart: admittedWeek.start,
        windowEnd: admittedWeek.end,
        reservedUntil: new Date(now.getTime() + 60000),
        completedAt: now,
        resultEntityId: cycle.id,
      },
    });
    await membership.assertNewPlan(caseUser, day);
    assert.deepEqual(await membership.admitPlan(caseUser, day, true, 'safety-repair'), []);
    await assert.rejects(membership.assertNewPlan(caseUser, getScheduledMealDate(day, 7)), {
      errorCode: 'CASE_MEMBERSHIP_REQUIRED',
    });
    await prisma.mealPlanCycle.delete({ where: { id: cycle.id } });

    const member = await create();
    await setExpired(member);
    const grant = await prisma.membershipGrant.create({
      data: {
        userId: member,
        source: 'ADMIN_ADJUSTMENT',
        evidenceReference: `disposable:${randomUUID()}`,
        verifiedAt: now,
        effectiveFrom: past,
        effectiveUntil: new Date(now.getTime() + 30 * 86_400_000),
      },
    });
    assert.equal((await membership.state(member)).level, 'MEMBER');
    for (let i = 0; i < 10; i++)
      await membership.complete((await reserve(`member-estimate-${i}`, 'AI_ESTIMATE', member))!.id);
    await assert.rejects(reserve('member-estimate-over', 'AI_ESTIMATE', member), {
      errorCode: 'MEMBERSHIP_USAGE_LIMIT',
    });
    const week = membershipWeek(now);
    const episode = await prisma.$transaction((tx) =>
      membership.reserve(member, 'PLAN_REVIEW', 'same-plan-week', 'same-plan-week', tx, now, now)
    );
    await membership.complete(episode!.id);
    assert.equal(
      (await prisma.$transaction((tx) =>
        membership.reserve(member, 'PLAN_REVIEW', 'same-plan-week', 'same-plan-week', tx)
      ))!.replayed,
      true
    );
    await assert.rejects(
      prisma.$transaction((tx) =>
        membership.reserve(member, 'PLAN_REVIEW', 'another-plan-week', 'another-plan-week', tx)
      ),
      { errorCode: 'MEMBERSHIP_USAGE_LIMIT' }
    );
    assert.equal(
      await prisma.membershipUsage.count({
        where: { userId: member, feature: 'PLAN_REVIEW', windowStart: week.start },
      }),
      1
    );
    await prisma.allergy.create({ data: { userId: member, allergen: 'EGGS' } });
    await prisma.healthCondition.create({ data: { userId: member, condition: 'DIABETES' } });
    await assert.rejects(membership.admitPlan(member, day, true, 'optional-case-replan', 'case-replan-retry'), {
      errorCode: 'MEMBERSHIP_USAGE_LIMIT',
    });
    assert.equal(await prisma.membershipUsage.count({ where: { userId: member, feature: 'REPLAN' } }), 0);
    await assert.rejects(
      prisma.$transaction((tx) => membership.reserve(member, 'REPLAN', 'retired-replan', day.toISOString(), tx)),
      { errorCode: 'PLAN_REPLACEMENT_UNAVAILABLE' }
    );
    await prisma.membershipGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
    assert.equal((await membership.state(member)).level, 'FREE');
    // Admitted episode follow-up can finish after expiry, without a second credit.
    assert.equal(
      (await prisma.$transaction((tx) =>
        membership.reserve(member, 'PLAN_REVIEW', 'same-plan-week', 'same-plan-week', tx)
      ))!.replayed,
      true
    );

    const pending = await create();
    const current = await prisma.mealPlanCycle.create({
      data: {
        id: randomUUID(),
        userId: pending,
        planType: 'STARTER',
        ...getMealPlanCycleTiming('STARTER', day, 2),
        expectedSlotCount: 6,
        status: 'UNDER_REVIEW',
        mealPlans: {
          create: {
            userId: pending,
            planType: 'STARTER',
            mealType: 'BREAKFAST',
            scheduledDate: day,
            mealName: 'Disposable cleared meal fixture',
            status: 'APPROVED',
            calories: 400,
            proteinG: 20,
            carbsG: 50,
            fatG: 10,
          },
        },
      },
    });
    const originalClearance = MealPlanCycleService.getClearedMealPlanIds;
    const meal = await prisma.mealPlan.findFirstOrThrow({ where: { planGroupId: current.id } });
    try {
      // Only the clearance decision is stubbed: this tests clock/lifecycle storage, not clinical approval.
      MealPlanCycleService.getClearedMealPlanIds = async () => [];
      await MealPlanCycleService.synchronizeLifecycle(pending);
      assert.equal((await membership.state(pending)).account.trialStartedAt, null);
      MealPlanCycleService.getClearedMealPlanIds = async () => [meal.id];
      await MealPlanCycleService.synchronizeLifecycle(pending);
      assert.equal((await membership.state(pending)).level, 'TRIAL');
      // Replacement of the same plan week cannot reset a swap allowance.
      await setExpired(pending);
      await prisma.swapLog.createMany({
        data: Array.from({ length: 3 }, () => ({
          mealPlanId: meal.id,
          originalMealName: 'Fixture old',
          originalCalories: 400,
          newMealName: 'Fixture new',
          newCalories: 400,
          calorieDelta: 0,
        })),
      });
      await assert.rejects(
        prisma.$transaction((tx) => membership.assertSwap(pending, current.id, tx)),
        { errorCode: 'MEMBERSHIP_SWAP_LIMIT' }
      );
      await prisma.mealPlanCycle.update({ where: { id: current.id }, data: { status: 'SUPERSEDED' } });
      const replacement = await prisma.mealPlanCycle.create({
        data: {
          id: randomUUID(),
          userId: pending,
          planType: 'STARTER',
          ...getMealPlanCycleTiming('STARTER', day, 2),
          expectedSlotCount: 6,
          cycleRevision: 2,
        },
      });
      await assert.rejects(
        prisma.$transaction((tx) => membership.assertSwap(pending, replacement.id, tx)),
        { errorCode: 'MEMBERSHIP_SWAP_LIMIT' }
      );
      const futureOwner = await create();
      const futureDay = getScheduledMealDate(day, 7);
      const future = await prisma.mealPlanCycle.create({
        data: {
          id: randomUUID(),
          userId: futureOwner,
          planType: 'WEEKLY',
          ...getMealPlanCycleTiming('WEEKLY', futureDay, 7),
          expectedSlotCount: 21,
          mealPlans: {
            create: {
              userId: futureOwner,
              planType: 'WEEKLY',
              mealType: 'BREAKFAST',
              scheduledDate: futureDay,
              mealName: 'Disposable future cleared meal fixture',
              status: 'APPROVED',
              calories: 400,
              proteinG: 20,
              carbsG: 50,
              fatG: 10,
            },
          },
        },
      });
      // Even a clearance set returned for a future cycle cannot start its trial.
      const futureMeal = await prisma.mealPlan.findFirstOrThrow({ where: { planGroupId: future.id } });
      MealPlanCycleService.getClearedMealPlanIds = async () => [futureMeal.id];
      await MealPlanCycleService.synchronizeLifecycle(futureOwner);
      assert.equal((await membership.state(futureOwner)).account.trialStartedAt, null);
      await prisma.mealPlanCycle.delete({ where: { id: future.id } });
    } finally {
      MealPlanCycleService.getClearedMealPlanIds = originalClearance;
    }

    const app = express();
    app.use(express.json());
    app.use('/membership', router);
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/membership`;
    assert.equal((await fetch(base)).status, 401);
    const token = (id: string, role: string) =>
      jwt.sign({ userId: id, email: `${id}@example.invalid`, role }, process.env.JWT_SECRET!, { expiresIn: '5m' });
    const checkout = await fetch(`${base}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token(free, 'USER')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'HEALTH', period: 'MONTHLY', requestKey: randomUUID() }),
    });
    assert.equal(checkout.status, 503);
    assert.equal(((await checkout.json()) as { errorCode: string }).errorCode, 'MEMBERSHIP_PURCHASES_UNAVAILABLE');
    for (const role of ['ADMIN', 'NUTRITIONIST'] as const) {
      const id = await create(role);
      assert.equal((await fetch(base, { headers: { Authorization: `Bearer ${token(id, role)}` } })).status, 403);
    }
    await prisma.user.delete({ where: { id: member } });
    assert.equal(await prisma.membershipUsage.count({ where: { userId: member } }), 0);
    assert.equal(await prisma.membershipGrant.count({ where: { userId: member } }), 0);
    console.log(
      'Membership acceptance passed: durable trial, pending/starter lifecycle, free corrections, case gates, concurrent quota, retries/refunds, review follow-up, verified grants, disabled checkout and role/account boundaries.'
    );
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
