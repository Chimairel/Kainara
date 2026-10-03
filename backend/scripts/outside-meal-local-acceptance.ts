import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  MealType,
  OutsideMealCompatibilityStatus,
  OutsideMealItemSource,
  OutsideMealNutritionStatus,
} from '@prisma/client';
import prisma from '../src/lib/prisma';
import { AppError } from '../src/errors/AppError';
import { MealLogService } from '../src/services/meal-log.service';
import { OutsideMealCaptureService } from '../src/services/outside-meal-capture.service';
import { getManilaDateKey, getManilaMidnight } from '../src/domain/meal-plan-cycle.policy';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '../src/domain/meal-library-safety-evidence.policy';
import { OutsideMealReviewService } from '../src/services/outside-meal-review.service';

type LogResult = Awaited<ReturnType<typeof MealLogService.logOutsideMeal>>;
type PreviewResult = Extract<LogResult, { previewRequired: boolean }>;
type CommitResult = Extract<LogResult, { log: unknown }>;

function assertPreview(result: LogResult): asserts result is PreviewResult {
  assert.ok('previewRequired' in result, 'Expected an outside-meal preview.');
}

function assertCommit(result: LogResult): asserts result is CommitResult {
  assert.ok('log' in result, 'Expected a committed outside-meal log.');
}

function requireDisposableDatabase(): void {
  const database = new URL(process.env.DATABASE_URL || '');
  const expectedPort = process.env.NUTRIMIND_OUTSIDE_ACCEPTANCE_PORT || '55461';
  if (!/^\d{2,5}$/.test(expectedPort)) throw new Error('Outside-meal acceptance port is invalid.');
  if (
    !['127.0.0.1', 'localhost'].includes(database.hostname) ||
    database.port !== expectedPort ||
    database.pathname !== '/nutrimind_outside'
  ) {
    throw new Error(
      `Outside-meal acceptance requires the disposable database at 127.0.0.1:${expectedPort}/nutrimind_outside.`
    );
  }
}

async function rejectsWithCode(run: () => Promise<unknown>, errorCode: string): Promise<void> {
  await assert.rejects(run, (error: unknown) => error instanceof AppError && error.errorCode === errorCode);
}

async function main(): Promise<void> {
  requireDisposableDatabase();
  const run = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: {
      name: 'Outside Meal Test User',
      email: `outside-meal-user-${run}@example.invalid`,
      passwordHash: 'synthetic-not-a-login-credential',
      role: 'USER',
      emailVerified: true,
      tosAccepted: true,
      onboardingDone: true,
      userProfile: {
        create: {
          age: 24,
          biologicalSex: 'MALE',
          heightCm: 170,
          weightKg: 70,
          targetWeightKg: 74,
          goal: 'GAIN_WEIGHT',
          activityLevel: 'LIGHTLY_ACTIVE',
          dietaryPreference: 'OMNIVORE',
          ricePreference: 'FLEXIBLE',
          dailyCalorieTarget: 2_780,
        },
      },
    },
  });
  const nutritionistUsers = await Promise.all(
    [1, 2].map((position) =>
      prisma.user.create({
        data: {
          name: `Outside Meal Nutritionist ${position}`,
          email: `outside-meal-rnd-${position}-${run}@example.invalid`,
          passwordHash: 'synthetic-not-a-login-credential',
          role: 'NUTRITIONIST',
          emailVerified: true,
          tosAccepted: true,
          onboardingDone: true,
        },
      })
    )
  );
  const nutritionists = await Promise.all(
    nutritionistUsers.map((account, position) =>
      prisma.nutritionistProfile.create({
        data: {
          userId: account.id,
          prcLicenseNumber: `PRC-OUTSIDE-${run}-${position + 1}`,
          prcLicenseExpiry: new Date('2030-12-31T00:00:00.000Z'),
          isVerified: true,
          verifiedAt: new Date(),
        },
      })
    )
  );
  const food = await prisma.foodItem.create({
    data: {
      name: `Acceptance boiled rice ${run}`,
      category: 'Cereal and grain products',
      calories: 130,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
      sodium: 1,
      source: 'FNRI',
    },
  });

  await prisma.outsideMealAiUsage.create({ data: { userId: user.id, itemCount: 5 } });
  await rejectsWithCode(
    () =>
      MealLogService.logOutsideMeal({
        userId: user.id,
        items: [{ name: `Unresolved quota estimate ${run}`, portionGrams: 150 }],
        mealType: MealType.SNACK,
        useAiEstimate: true,
        estimationContext: 'One cooked serving with mixed ingredients and sauce.',
      }),
    'DAILY_LIMIT_REACHED'
  );
  await prisma.outsideMealAiUsage.deleteMany({ where: { userId: user.id } });

  const requestKey = `outside-meal-acceptance:${run}`;
  const input = {
    userId: user.id,
    items: [
      { name: food.name, portionGrams: 150 },
      {
        name: 'Packaged nutrition bar',
        reportedNutrition: { calories: 250, proteinG: 10, carbsG: 32, fatG: 9 },
      },
      { name: `Unknown fiesta dish ${run}` },
    ],
    mealType: MealType.SNACK,
    requestKey,
  };
  const preview = await MealLogService.logOutsideMeal(input);
  assertPreview(preview);
  assert.equal(preview.previewRequired, true);
  assert.deepEqual(
    preview.items.map((item) => item.source),
    [OutsideMealItemSource.FNRI, OutsideMealItemSource.USER_REPORTED, OutsideMealItemSource.UNRESOLVED]
  );
  assert.equal(preview.summary.totals.calories, 445);
  assert.equal(preview.summary.unresolvedItemCount, 1);
  assert.equal(preview.summary.provisionalCalories, 445);
  const parallelInputs = { ...input, requestKey: `outside-parallel:${run}` };
  const parallelPreviews = await Promise.all([1, 2].map(() => MealLogService.logOutsideMeal(parallelInputs)));
  assertPreview(parallelPreviews[0]);
  assertPreview(parallelPreviews[1]);
  assert.equal(parallelPreviews[0].confirmationId, parallelPreviews[1].confirmationId);
  const replay = await MealLogService.logOutsideMeal(input);
  assertPreview(replay);
  assert.equal(replay.confirmationId, preview.confirmationId);
  await rejectsWithCode(
    () =>
      MealLogService.logOutsideMeal({
        userId: user.id,
        items: [{ name: 'Different food' }],
        mealType: MealType.SNACK,
        requestKey,
      }),
    'REQUEST_KEY_COLLISION'
  );

  const nutritionDay = getManilaMidnight(getManilaDateKey(new Date()));
  await prisma.dailyNutritionLog.create({
    data: {
      userId: user.id,
      logDate: nutritionDay,
      totalCalories: 0,
      totalProteinG: 0,
      totalCarbsG: 0,
      totalFatG: 0,
      targetCalories: 2780,
      adherencePct: 0,
    },
  });

  const committed = await MealLogService.logOutsideMeal({
    userId: user.id,
    mealType: MealType.SNACK,
    warningAcknowledged: true,
    confirmationId: preview.confirmationId,
  });
  assertCommit(committed);
  assert.equal(committed.log.calories, 445);
  assert.equal(committed.log.provisionalCalories, 445);
  assert.equal(committed.log.nutritionCompleteness, 'PARTIAL');
  assert.equal(committed.log.outsideItems.length, 3);
  const unresolved = committed.log.outsideItems.find((item) => item.source === OutsideMealItemSource.UNRESOLVED);
  assert.ok(unresolved);
  assert.equal(unresolved.includedInTotals, false);
  assert.equal(unresolved.calories, null);
  const committedReplay = await MealLogService.logOutsideMeal({
    userId: user.id,
    mealType: MealType.SNACK,
    warningAcknowledged: true,
    confirmationId: preview.confirmationId,
  });
  assertCommit(committedReplay);
  assert.equal(committedReplay.log.id, committed.log.id);
  await assert.rejects(() =>
    prisma.outsideMealLogItem.create({
      data: {
        mealLogId: committed.log.id,
        position: 99,
        name: 'Invalid included item',
        source: OutsideMealItemSource.UNRESOLVED,
        nutritionStatus: OutsideMealNutritionStatus.UNRESOLVED,
        compatibilityStatus: OutsideMealCompatibilityStatus.INSUFFICIENT_EVIDENCE,
        includedInTotals: true,
      },
    })
  );

  const daily = await prisma.dailyNutritionLog.findUniqueOrThrow({
    where: { userId_logDate: { userId: user.id, logDate: nutritionDay } },
  });
  assert.equal(daily.totalCalories, 445, 'Saving must update the existing daily summary');
  const concurrentPreview = await MealLogService.logOutsideMeal({
    userId: user.id,
    mealType: MealType.SNACK,
    items: [{ name: 'Concurrent label', reportedNutrition: { calories: 100, proteinG: 5, carbsG: 15, fatG: 2 } }],
  });
  assertPreview(concurrentPreview);
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      MealLogService.logOutsideMeal({
        userId: user.id,
        mealType: MealType.SNACK,
        warningAcknowledged: true,
        confirmationId: concurrentPreview.confirmationId,
      })
    )
  );
  const committedConcurrent = concurrent.map((result) => {
    assertCommit(result);
    return result;
  });
  assert.equal(
    committedConcurrent[0].log.id,
    committedConcurrent[1].log.id,
    'Concurrent confirmations must converge on one saved log'
  );
  assert.equal(await prisma.mealLog.count({ where: { outsidePreviewId: concurrentPreview.confirmationId } }), 1);
  const itemToRename = committedConcurrent[0].log.outsideItems[0];
  await OutsideMealCaptureService.editItem(user.id, committedConcurrent[0].log.id, itemToRename.id, {
    name: 'Corrected label',
    reportedNutrition: { calories: 120, proteinG: 5, carbsG: 20, fatG: 2 },
  });
  assert.equal(
    (await prisma.mealLog.findUniqueOrThrow({ where: { id: committedConcurrent[0].log.id } })).mealName,
    'Corrected label'
  );
  await OutsideMealCaptureService.voidLog(user.id, committedConcurrent[0].log.id, 'Synthetic duplicate test cleanup');
  assert.equal(
    (
      await prisma.dailyNutritionLog.findUniqueOrThrow({
        where: { userId_logDate: { userId: user.id, logDate: nutritionDay } },
      })
    ).totalCalories,
    445
  );

  const dishFood = await prisma.foodItem.create({
    data: {
      name: `Synthetic chicken composition ${run}`,
      category: 'Meat',
      source: 'FNRI',
      calories: 130,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
    },
  });
  const library = await prisma.mealLibrary.create({
    data: {
      mealName: `Synthetic certified chicken ${run}`,
      mealType: 'LUNCH',
      calories: 130,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
      sodiumMg: 1,
      dietaryTags: ['OMNIVORE'],
      recipeSignature: createHash('sha256').update(run).digest('hex'),
      status: 'APPROVED',
      verifiedByNutritionistId: nutritionists[0].id,
      safetyReviewedByNutritionistId: nutritionists[0].id,
      safetyEvidenceStatus: 'COMPLETE',
      safetyEvidenceOrigin: 'NUTRITIONIST_REVIEW',
      nutritionEvidenceSource: 'FNRI_RECONCILED',
      safetyEvidenceRevision: 1,
      certifiedEvidenceRevision: 1,
      safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
      safetyReviewedAt: new Date(),
      conditionDeclarationState: 'REVIEWED_NONE_DECLARED',
      allergenDeclarationState: 'REVIEWED_NONE_DECLARED',
      crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
      riceRole: 'PAIR_WITH_RICE',
      riceRoleReviewStatus: 'REVIEWED',
      ingredients: {
        create: {
          position: 0,
          ingredientName: dishFood.name,
          foodItemId: dishFood.id,
          dataSource: 'FNRI',
          quantity: 100,
          unit: 'g',
        },
      },
    },
  });
  const fullServing = await MealLogService.logOutsideMeal({
    userId: user.id,
    mealType: MealType.LUNCH,
    items: [{ name: library.mealName, mealLibraryId: library.id }],
  });
  assertPreview(fullServing);
  assert.equal(fullServing.items[0].source, 'VERIFIED_LIBRARY');
  const measuredServing = await MealLogService.logOutsideMeal({
    userId: user.id,
    mealType: MealType.LUNCH,
    items: [{ name: library.mealName, mealLibraryId: library.id, portionGrams: 50 }],
  });
  assertPreview(measuredServing);
  assert.equal(
    measuredServing.items[0].includedInTotals,
    false,
    'Unknown recipe weight must not use full-serving values'
  );
  assert.equal(measuredServing.items[0].source, 'UNRESOLVED');
  await prisma.foodItem.upsert({
    where: { source_sourceRecordId: { source: 'FNRI', sourceRecordId: 'synthetic-rice' } },
    update: {},
    create: {
      name: 'Rice, well-milled, boiled',
      source: 'FNRI',
      sourceRecordId: 'synthetic-rice',
      calories: 130,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
    },
  });
  const suggestions = await OutsideMealCaptureService.suggestions(user.id, 'Synthetic certified');
  const suggested = [...suggestions.eligible, ...suggestions.otherKnown].find((item) => item.id === library.id) as
    { riceReference?: unknown; ricePairing?: string } | undefined;
  assert.ok(suggested?.riceReference, 'Outside capture must receive the saved rice pairing and composition');
  assert.equal(suggested.ricePairing, 'ULAM');
  const paired = await MealLogService.logOutsideMeal({
    userId: user.id,
    mealType: MealType.LUNCH,
    items: [
      { name: library.mealName, mealLibraryId: library.id },
      { name: 'Rice, well-milled, boiled', portionGrams: 75 },
    ],
  });
  assertPreview(paired);
  assert.equal(paired.summary.totals.calories, 227.5);
  assert.equal(
    await prisma.mealLibrary.count({ where: { mealName: library.mealName } }),
    1,
    'Adding rice must not create a library recipe'
  );

  const aiPreview = await prisma.outsideMealPreview.create({
    data: {
      userId: user.id,
      mealName: `AI estimated turon ${run}`,
      mealType: MealType.SNACK,
      estimate: { calories: 410, proteinG: 5, carbsG: 66, fatG: 14 },
      warnings: ['AI estimate — counted provisionally until a nutritionist reviews it.'],
      reasons: ['AI estimate — counted provisionally until a nutritionist reviews it.'],
      usedAi: true,
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      items: [
        {
          name: `AI estimated turon ${run}`,
          portionGrams: null,
          source: OutsideMealItemSource.GEMINI_ESTIMATED,
          nutritionStatus: OutsideMealNutritionStatus.PENDING_REVIEW,
          compatibilityStatus: OutsideMealCompatibilityStatus.REVIEW_REQUIRED,
          includedInTotals: true,
          calories: 410,
          proteinG: 5,
          carbsG: 66,
          fatG: 14,
          calorieLow: 330,
          calorieHigh: 490,
          foodItemId: null,
          mealLibraryId: null,
          ingredients: ['banana', 'brown sugar', 'wrapper', 'oil'],
          warnings: ['AI estimate — counted provisionally until a nutritionist reviews it.'],
        },
      ],
    },
  });
  const aiLog = await MealLogService.logOutsideMeal({
    userId: user.id,
    mealType: MealType.SNACK,
    warningAcknowledged: true,
    confirmationId: aiPreview.id,
  });
  assertCommit(aiLog);
  assert.equal(aiLog.log.calories, 410);
  assert.equal(aiLog.log.provisionalCalories, 410);
  const review = await prisma.outsideMealReview.findFirstOrThrow({
    where: { outsideMealLogItem: { mealLogId: aiLog.log.id } },
  });
  const queue = await OutsideMealReviewService.queue(nutritionists[0].id);
  assert.ok(queue.some((entry) => entry.id === review.id));
  await OutsideMealReviewService.claim(nutritionists[0].id, review.id);
  await rejectsWithCode(() => OutsideMealReviewService.claim(nutritionists[1].id, review.id), 'REVIEW_CLAIM_CONFLICT');
  const decision = await OutsideMealReviewService.resolve(nutritionists[0].id, review.id, {
    action: 'CORRECT',
    calories: 330,
    proteinG: 4,
    carbsG: 55,
    fatG: 11,
    reason: 'Adjusted to one standard fried turon serving.',
  });
  assert.equal(decision.revision, 1);
  assert.equal(decision.summary.totals.calories, 330);
  assert.equal(decision.summary.provisionalCalories, 0);
  const correctedLog = await prisma.mealLog.findUniqueOrThrow({
    where: { id: aiLog.log.id },
    include: { outsideItems: { include: { revisions: { orderBy: { revision: 'asc' } } } } },
  });
  assert.equal(correctedLog.calories, 330);
  assert.equal(correctedLog.provisionalCalories, 0);
  assert.equal(correctedLog.dataSource, 'NUTRITIONIST_REVIEWED');
  assert.equal(correctedLog.outsideItems[0].nutritionStatus, 'CORRECTED');
  assert.equal(correctedLog.outsideItems[0].revisions.length, 2);
  assert.equal(await prisma.notification.count({ where: { userId: user.id, type: 'OUTSIDE_MEAL_REVIEWED' } }), 1);
  assert.equal(await prisma.auditEvent.count({ where: { entityId: correctedLog.outsideItems[0].id } }), 1);

  let geminiCalls = 0;
  let geminiProviderAttempts = 0;
  if (process.env.OUTSIDE_MEAL_ACCEPTANCE_USE_GEMINI === '1') {
    const livePreview = await MealLogService.logOutsideMeal({
      userId: user.id,
      items: [{ name: 'one medium turon with jackfruit' }],
      mealType: MealType.SNACK,
      useAiEstimate: true,
      requestKey: `outside-meal-live-gemini:${run}`,
    });
    assertPreview(livePreview);
    assert.equal(livePreview.usedAi, true);
    assert.equal(livePreview.items[0].source, OutsideMealItemSource.GEMINI_ESTIMATED);
    assert.equal(livePreview.items[0].nutritionStatus, OutsideMealNutritionStatus.PENDING_REVIEW);
    assert.ok(livePreview.summary.provisionalCalories > 0);
    geminiProviderAttempts = (
      await prisma.aiUsageEvent.findFirstOrThrow({
        where: { status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
      })
    ).attempts;
    const liveCommit = await MealLogService.logOutsideMeal({
      userId: user.id,
      mealType: MealType.SNACK,
      warningAcknowledged: true,
      confirmationId: livePreview.confirmationId,
    });
    assertCommit(liveCommit);
    assert.ok(liveCommit.log.provisionalCalories > 0);
    assert.equal(await prisma.outsideMealAiUsage.count({ where: { userId: user.id } }), 1);
    const liveReview = await prisma.outsideMealReview.findFirstOrThrow({
      where: { outsideMealLogItem: { mealLogId: liveCommit.log.id } },
    });
    await OutsideMealReviewService.claim(nutritionists[0].id, liveReview.id);
    const verified = await OutsideMealReviewService.resolve(nutritionists[0].id, liveReview.id, {
      action: 'VERIFY',
      reason: 'Acceptance verification of the provider-generated estimate.',
    });
    assert.equal(verified.summary.provisionalCalories, 0);
    geminiCalls = 1;
  }

  console.log(
    JSON.stringify({
      test: geminiCalls ? 'TEST-183' : 'TEST-182',
      outcome: 'PASS',
      freeSources: ['FNRI', 'USER_REPORTED', 'UNRESOLVED'],
      unresolvedExcluded: true,
      previewReplayProtected: true,
      reviewClaimContentionProtected: true,
      provisionalCaloriesBeforeReview: 410,
      correctedCaloriesAfterReview: 330,
      notifications: 1,
      concurrentConfirmations: true,
      currentDailySummary: true,
      measuredRecipeExcludedWithoutWeight: true,
      savedRicePairing: true,
      geminiCalls,
      geminiProviderAttempts,
    })
  );
}

main().finally(() => prisma.$disconnect());
