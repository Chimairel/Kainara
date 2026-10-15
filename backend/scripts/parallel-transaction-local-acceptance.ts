import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { swapMacroContext } from '../src/services/meal-macro-context.service';
import { membershipTransitionContext } from '../src/services/membership-transition.service';
import { NutritionistApplicationService } from '../src/services/nutritionist-application.service';
import { AppError } from '../src/errors/AppError';
import { recalculateDailyNutritionLog } from '../src/services/meal-swap-nutrition.service';
import { getStartOfManilaBusinessDay } from '../src/domain/meal-actionability.policy';

/** Real Prisma-engine regression checks; synthetic writes roll back; no provider calls. */
async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55432');
  assert.equal(target.pathname, '/kainara_local_development');
  const missing = `parallel-query-regression-${randomUUID()}`;

  await prisma.$transaction(async (tx) => {
    const context = await swapMacroContext(
      tx,
      missing,
      { id: missing, planGroupId: missing, scheduledDate: new Date(), mealType: 'LUNCH' },
      null
    );
    assert.equal(context.target, null);
    assert.deepEqual(context.dayMeals, []);
    const membership = await membershipTransitionContext(missing, missing, tx);
    assert.ok(membership);
  });
  console.log('PASS: swap macro and membership context reads complete inside real transactions.');

  const rollback = new Error('ROLLBACK_PARALLEL_READ_FIXTURE');
  await assert.rejects(prisma.$transaction(async (tx) => {
    const user = await tx.user.create({data: {
      email: `${missing}@example.invalid`, name: '[TEST] Parallel transaction regression', passwordHash: 'disabled',
    }});
    const today = getStartOfManilaBusinessDay();
    await tx.mealPlanCycle.create({data: {
      id: missing, userId: user.id, planType: 'WEEKLY', startDate: today, endDate: today,
      preparationOpensAt: today, shoppingDeadlineAt: today, expectedSlotCount: 1,
    }});
    await tx.mealPlan.create({data: {
      userId: user.id, planGroupId: missing, mealType: 'LUNCH', mealName: 'Query fixture',
      scheduledDate: today, calories: 100, proteinG: 5, carbsG: 15, fatG: 2,
    }});
    const log = await tx.dailyNutritionLog.create({data: {
      userId: user.id, logDate: today, totalCalories: 100, totalProteinG: 5, totalCarbsG: 15,
      totalFatG: 2, targetCalories: 2000, adherencePct: 0,
    }});
    await recalculateDailyNutritionLog(user.id, today, tx);
    const saved = await tx.dailyNutritionLog.findFirstOrThrow({where: {id: log.id}});
    assert.equal(saved.totalCalories, 0, 'Unconsumed meals do not become consumed nutrition.');
    assert.equal(saved.targetCalories, 2000, 'Missing profile/snapshot retains the existing fallback.');
    throw rollback;
  }), (error: unknown) => error === rollback);
  assert.equal(await prisma.user.count({where: {email: `${missing}@example.invalid`}}), 0);
  console.log('PASS: existing daily-log recalculation; synthetic user/cycle/meal/log all rolled back.');

  // The full admission transaction must reach the existing email-proof gate,
  // rather than crashing in its parallel identity reads. No proof is consumed.
  await assert.rejects(
    NutritionistApplicationService.submit({
      fullName: 'Parallel query regression',
      email: `${missing}@example.invalid`,
      emailVerificationProof: missing,
      phoneNumber: '09000000000',
      prcLicenseNumber: missing,
      prcLicenseExpiry: '2030-01-01',
      specialization: 'General nutrition',
      yearsOfExperience: 1,
      university: 'Regression fixture',
      professionalBio: 'Regression fixture',
      photoRecentAttested: true,
      availableCallSlots: [],
      consent: true,
    }),
    (error: unknown) => error instanceof AppError && error.errorCode === 'APPLICANT_EMAIL_UNVERIFIED'
  );
  assert.equal(await prisma.nutritionistApplication.count({ where: { email: `${missing}@example.invalid` } }), 0);
  console.log('PASS: RND application retains its email-proof gate and creates no application.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Transaction acceptance failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
