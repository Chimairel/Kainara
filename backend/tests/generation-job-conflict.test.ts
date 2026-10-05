import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { AppError } from '../src/errors/AppError';

test('a live generation job returns a conflict before admission or generation', async (context) => {
  const shared = globalThis as unknown as { prisma: unknown };
  const previous = shared.prisma;
  shared.prisma = {
    mealPlanCycle: { findFirst: async () => null },
    mealPlanGenerationJob: {
      create: async () => {
        throw new Prisma.PrismaClientKnownRequestError('Duplicate job', { code: 'P2002', clientVersion: '5.14.0' });
      },
      findUnique: async () => ({ id: 'existing-live-job' }),
      updateMany: async () => ({ count: 0 }),
    },
  };
  context.after(() => {
    shared.prisma = previous;
  });
  const { MealGenerationService } = await import('../src/services/meal-generation.service');
  const { MembershipService } = await import('../src/services/membership.service');
  const { ClinicalEvidenceService } = await import('../src/services/clinical-evidence.service');
  const { ClinicalProfileReviewService } = await import('../src/services/clinical-profile-review.service');
  context.mock.method(ClinicalEvidenceService, 'assertReadyForMealPlanning', async () => []);
  context.mock.method(ClinicalProfileReviewService, 'assertReadyForMealPlanning', async () => undefined);
  context.mock.method(MembershipService, 'assertNewPlan', async () => undefined);
  const admission = context.mock.method(MembershipService, 'admitPlan', async () => {
    throw new Error('Must not admit a duplicate');
  });
  const generate = context.mock.method(MealGenerationService, 'generate7DayPlan', async () => {
    throw new Error('Must not generate a duplicate');
  });
  await assert.rejects(
    () =>
      MealGenerationService.generateWindowOnce('fixture', {
        planType: 'WEEKLY',
        startDate: new Date('2026-10-04T00:00:00+08:00'),
        numDays: 7,
      }),
    (error: unknown) =>
      error instanceof AppError && error.statusCode === 409 && error.errorCode === 'GENERATION_IN_PROGRESS'
  );
  assert.equal(admission.mock.callCount(), 0);
  assert.equal(generate.mock.callCount(), 0);
});
