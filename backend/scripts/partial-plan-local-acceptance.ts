/** Synthetic SQL acceptance; refuses shared or hosted databases and all external providers. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { MealAiQueueService } from '../src/services/meal-ai-queue.service';
import { recoverPartialPlanJobs } from '../src/services/partial-plan-recovery.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { remainingGenerationSlots } from '../src/domain/meal-generation-continuation.policy';
import { getManilaDateKey, getManilaMidnight, getScheduledMealDate } from '../src/domain/meal-plan-cycle.policy';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55487');
  assert.match(target.pathname, /^\/kainara_partial_plan(?:_polish_\d+)?$/u);
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  globalThis.fetch = async () => assert.fail('No external provider may be contacted');
  assert.equal(await prisma.user.count(), 0, 'Use a fresh disposable database');
  const now = new Date();
  const startDate = getManilaMidnight(getManilaDateKey(now));
  const marker = randomUUID();
  const food = await prisma.foodItem.create({
    data: {
      name: 'Synthetic cooked grains',
      source: 'FNRI',
      category: 'Cereals & Grains',
      calories: 200,
      proteinG: 10,
      carbsG: 25,
      fatG: 6,
    },
  });
  for (const [type, calories] of [
    ['BREAKFAST', 500],
    ['LUNCH', 800],
    ['DINNER', 700],
  ] as const) {
    await prisma.rawRecipeCandidate.create({
      data: {
        sourceRecordId: `${marker}-${type}`,
        sourceUrl: 'https://panlasangpinoy.com/software-fixture/',
        recipeName: `Synthetic ${type.toLowerCase()} meal`,
        normalizedName: `synthetic ${type.toLowerCase()} meal`,
        contentSignature: createHash('sha256')
          .update(marker + type)
          .digest('hex'),
        cuisines: ['Filipino'],
        dietaryTags: ['OMNIVORE'],
        mealType: type,
        riceRole: 'STANDALONE',
        riceRoleReviewStatus: 'REVIEWED',
        calories,
        proteinG: calories / 20,
        carbsG: calories / 8,
        fatG: calories * 0.03,
        publishedNutrition: { calories, proteinG: calories / 20, carbsG: calories / 8, fatG: calories * 0.03 },
        ingredients: [{ name: food.name, quantity: calories / 2, unit: 'g', foodItemId: food.id }],
        applicableMealTypes: { create: { mealType: type, reviewStatus: 'REVIEWED' } },
      },
    });
  }
  const fixture = async (
    kind: 'general' | 'allergy' | 'frozen' | 'stale' | 'expired' | 'deadline' | 'future-deadline'
  ) => {
    const allergy = kind === 'allergy';
    const user = await prisma.user.create({
      data: {
        email: `${marker}-${kind}@example.invalid`,
        name: `Synthetic ${kind}`,
        passwordHash: 'NON_LOGIN_SOFTWARE_FIXTURE',
        role: 'USER',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        userProfile: {
          create: {
            age: 25,
            biologicalSex: 'MALE',
            heightCm: 168,
            weightKg: 65,
            goal: 'MAINTAIN',
            activityLevel: 'SEDENTARY',
            dietaryPreference: 'OMNIVORE',
            ricePreference: 'NO_RICE',
            dailyCalorieTarget: 2000,
            planningReportVersion: 1,
          },
        },
        allergies: allergy ? { create: { allergen: 'DAIRY' } } : undefined,
        safetyProfileEntries: {
          create: [
            {
              domain: 'CONDITION',
              canonicalCode: 'NONE',
              displayName: 'None',
              originalText: 'None',
              normalizedText: 'none',
              provenance: 'PREDEFINED',
              supportState: 'SUPPORTED',
              policyReference: 'synthetic-acceptance',
            },
            {
              domain: 'ALLERGY',
              canonicalCode: allergy ? 'DAIRY' : 'NONE',
              displayName: allergy ? 'Dairy' : 'None',
              originalText: allergy ? 'Dairy' : 'None',
              normalizedText: allergy ? 'dairy' : 'none',
              provenance: 'PREDEFINED',
              supportState: 'SUPPORTED',
              policyReference: 'synthetic-acceptance',
            },
          ],
        },
      },
    });
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    await prisma.nutritionReportVersion.create({
      data: {
        userId: user.id,
        version: 1,
        profileRevision: profile.revision,
        acknowledgedAt: now,
        policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
        content: {},
        profileSnapshot: { profile: JSON.parse(JSON.stringify(profile)) },
      },
    });
    const cycleStart =
      kind === 'expired'
        ? getScheduledMealDate(startDate, -7)
        : kind === 'future-deadline'
          ? getScheduledMealDate(startDate, 1)
          : startDate;
    const expectedSlotCount = kind === 'general' ? 21 : 9;
    const planType = kind === 'general' ? 'WEEKLY' : 'STARTER';
    const cycle = await prisma.mealPlanCycle.create({
      data: {
        id: `${marker}-${kind}`,
        userId: user.id,
        planType,
        startDate: cycleStart,
        endDate: getScheduledMealDate(cycleStart, expectedSlotCount / 3 - 1),
        expectedSlotCount,
        preparationOpensAt: cycleStart,
        shoppingDeadlineAt: kind === 'future-deadline' ? startDate : cycleStart,
        status: 'ACTIVE',
        shoppingStartedAt: kind === 'frozen' ? now : null,
        snapshot: {
          create: {
            userId: user.id,
            profileRevision: profile.revision,
            safetyRevision: kind === 'stale' ? profile.safetyRevision + 1 : profile.safetyRevision,
            nutritionReportVersion: 1,
            weightKg: profile.weightKg!,
            goal: profile.goal!,
            activityLevel: profile.activityLevel!,
            dailyCalorieTarget: 2000,
            dailyMacroTargets: {},
            planningGeographyLevel: 'NATIONAL',
          },
        },
      },
    });
    const job = await prisma.mealPlanGenerationJob.create({
      data: {
        userId: user.id,
        planType,
        cycleStartDate: cycleStart,
        planGroupId: cycle.id,
        status: ['general', 'deadline', 'future-deadline'].includes(kind) ? 'FAILED' : 'COMPLETED',
        lastErrorCode:
          kind === 'general'
            ? 'Error: NO_REVIEW_FREE_SOURCE'
            : ['deadline', 'future-deadline'].includes(kind)
              ? 'Error: SHOPPING_DEADLINE_PASSED'
              : null,
        progressPct: 100,
        completedAt: now,
      },
    });
    const cancelled = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        planGroupId: cycle.id,
        mealName: 'Cancelled source candidate',
        mealType: 'BREAKFAST',
        scheduledDate: cycleStart,
        status: 'CANCELLED',
        calories: 500,
        proteinG: 25,
        carbsG: 62.5,
        fatG: 15,
      },
    });
    await prisma.groceryList.create({
      data: { userId: user.id, planGroupId: cycle.id, weekLabel: 'Synthetic fixture', isStale: false },
    });
    return { user, cycle, job, cancelled };
  };
  const general = await fixture('general'),
    allergy = await fixture('allergy'),
    deadline = await fixture('deadline');
  const blocked = [await fixture('frozen'), await fixture('stale'), await fixture('expired')];
  const futureDeadline = await fixture('future-deadline');
  assert.equal(
    (await Promise.all([recoverPartialPlanJobs(now), recoverPartialPlanJobs(now)])).reduce(
      (sum, count) => sum + count,
      0
    ),
    3,
    'Concurrent recovery must only queue each partial job once'
  );
  assert.equal(await recoverPartialPlanJobs(now), 0, 'Recovery must be idempotent');
  assert.equal(
    (await prisma.mealPlanGenerationJob.findUniqueOrThrow({ where: { id: futureDeadline.job.id } })).status,
    'FAILED',
    'An upcoming cycle after its shopping deadline must remain paused until it becomes active'
  );
  for (const entry of blocked)
    assert.equal(
      (await prisma.mealPlanGenerationJob.findUniqueOrThrow({ where: { id: entry.job.id } })).status,
      'COMPLETED'
    );

  for (let turn = 0; turn < 20; turn++) {
    // Advance only due scheduling in the disposable fixture; no real timers or provider calls.
    await prisma.mealPlanGenerationJob.updateMany({
      where: { status: 'WAITING_FOR_AI' },
      data: { nextAttemptAt: new Date() },
    });
    const before = await prisma.mealPlan.findMany({ where: { status: { not: 'CANCELLED' } }, select: { id: true } });
    const worked = await MealAiQueueService.runOne();
    const added = await prisma.mealPlan.findMany({
      where: { status: { not: 'CANCELLED' }, id: { notIn: before.map((meal) => meal.id) } },
    });
    if (!worked) break;
    assert.equal(added.length, 3, 'A turn must save exactly the earliest missing day');
    assert.equal(new Set(added.map((meal) => meal.scheduledDate.getTime())).size, 1);
    assert.equal(new Set(added.map((meal) => meal.planGroupId)).size, 1);
  }
  for (const [entry, status] of [
    [general, 'APPROVED'],
    [allergy, 'PENDING_REVIEW'],
    [deadline, 'APPROVED'],
  ] as const) {
    const meals = await prisma.mealPlan.findMany({
      where: { planGroupId: entry.cycle.id, status: { not: 'CANCELLED' } },
    });
    assert.equal(meals.length, entry.cycle.expectedSlotCount);
    assert.ok(meals.every((meal) => meal.status === status && meal.candidateProvenance === 'RAW_RECIPE_CORPUS'));
    assert.equal(
      new Set(meals.map((meal) => `${meal.scheduledDate}:${meal.mealType}`)).size,
      entry.cycle.expectedSlotCount
    );
    assert.deepEqual(remainingGenerationSlots(startDate, entry.cycle.expectedSlotCount, meals, now), []);
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: entry.cancelled.id } })).status, 'CANCELLED');
    assert.equal(
      (await prisma.mealPlanGenerationJob.findUniqueOrThrow({ where: { id: entry.job.id } })).status,
      'COMPLETED'
    );
    assert.equal(
      (await prisma.groceryList.findUniqueOrThrow({ where: { planGroupId: entry.cycle.id } })).isStale,
      true
    );
    const cleared = await MealPlanCycleService.getClearedMealPlanIds(entry.user.id, entry.cycle.id);
    assert.equal(cleared.length, status === 'APPROVED' ? entry.cycle.expectedSlotCount : 0);
  }
  assert.equal(await prisma.aiUsageEvent.count(), 0);
  assert.equal(await prisma.mealLibrary.count(), 0);
  console.log(
    'PASS: completed-gap and active deadline-paused recovery, earliest-day progressive fill, preserved cancellations, fresh source evidence, general eligibility, allergy review hold, unique slots, blocked future/frozen/stale/expired cycles and no provider calls'
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
