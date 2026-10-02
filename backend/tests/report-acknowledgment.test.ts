import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { PlanningReadinessService } from '../src/services/planning-readiness.service';
import { UpcomingPlanPreparationService } from '../src/services/upcoming-plan-preparation.service';
import { ProfileCycleAdaptationService } from '../src/services/profile-cycle-adaptation.service';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';
import { AppError } from '../src/errors/AppError';

test('report acknowledgment preserves one receipt and separates committed saves from advisory failures', async () => {
  const originalTransaction = prisma.$transaction;
  const originalNotification = prisma.notification.create;
  const originalReadiness = PlanningReadinessService.getForUser;
  const originalTrigger = UpcomingPlanPreparationService.triggerNonBlocking;
  const originalAdaptation = ProfileCycleAdaptationService.acknowledgeProfileRevision;
  let report = { version: 3, profileRevision: 5, isStale: false, acknowledgedAt: null as Date | null };
  let profileRevision = 5;
  let policyVersion = NUTRITION_GUIDANCE_POLICY_VERSION;
  let adapts = 0;
  let notifications = 0;
  let triggers = 0;
  let writes = 0;
  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async () => [],
    nutritionReport: {
      findUniqueOrThrow: async () => ({ ...report }),
      update: async ({ data }: { data: { acknowledgedAt: Date } }) => {
        writes++;
        report = { ...report, ...data };
        return { ...report };
      },
    },
    userProfile: { findUniqueOrThrow: async () => ({ revision: profileRevision }) },
    nutritionReportVersion: {
      findFirst: async () => ({ policyVersion }),
      updateMany: async () => ({ count: 1 }),
    },
  };
  // Model the existing profile row lock: concurrent requests serialize.
  let previous = Promise.resolve<unknown>(undefined);
  prisma.$transaction = ((callback: (client: Prisma.TransactionClient) => Promise<unknown>) => {
    const request = previous.then(() => callback(tx as unknown as Prisma.TransactionClient));
    previous = request.catch(() => undefined);
    return request;
  }) as unknown as typeof originalTransaction;
  prisma.notification.create = (async () => {
    notifications++;
    return {};
  }) as unknown as typeof originalNotification;
  ProfileCycleAdaptationService.acknowledgeProfileRevision = async () => {
    adapts++;
  };
  UpcomingPlanPreparationService.triggerNonBlocking = () => {
    triggers++;
  };
  PlanningReadinessService.getForUser = async () => ({
    status: 'REQUEST_ALLOWED',
    canRequestPlan: true,
    title: 'Ready',
    message: 'Ready',
    actionPath: '/meals',
  });
  try {
    const [first, second, third] = await Promise.all(
      Array.from({ length: 3 }, () => NutritionReportService.acknowledgeReport('fixture', 3))
    );
    assert.ok(first.report.acknowledgedAt);
    assert.equal(second.report.acknowledgedAt?.getTime(), first.report.acknowledgedAt?.getTime());
    assert.equal(third.report.acknowledgedAt?.getTime(), first.report.acknowledgedAt?.getTime());
    assert.equal(writes, 1);
    assert.equal(adapts, 1);
    assert.equal(notifications, 1);
    assert.equal(triggers, 1);
    await assert.rejects(
      NutritionReportService.acknowledgeReport('fixture', 2),
      (error: unknown) => error instanceof AppError && error.statusCode === 409
    );
    profileRevision = 6;
    await assert.rejects(NutritionReportService.acknowledgeReport('fixture', 3), /out of date/);
    profileRevision = 5;
    policyVersion = 'retired';
    await assert.rejects(NutritionReportService.acknowledgeReport('fixture', 3), /out of date/);
    policyVersion = NUTRITION_GUIDANCE_POLICY_VERSION;
    assert.equal(writes, 1, 'Replays must still validate version, profile revision and policy.');
    report = { ...report, version: 4, acknowledgedAt: null };
    PlanningReadinessService.getForUser = async () => {
      throw new Error('Simulated unavailable advisory read');
    };
    const saved = await NutritionReportService.acknowledgeReport('fixture', 4);
    assert.ok(saved.report.acknowledgedAt);
    assert.equal(saved.planningReadiness, null);
    assert.equal(writes, 2);
    assert.equal(notifications, 1);
    assert.equal(triggers, 2);
  } finally {
    prisma.$transaction = originalTransaction;
    prisma.notification.create = originalNotification;
    PlanningReadinessService.getForUser = originalReadiness;
    UpcomingPlanPreparationService.triggerNonBlocking = originalTrigger;
    ProfileCycleAdaptationService.acknowledgeProfileRevision = originalAdaptation;
    await prisma.$disconnect();
  }
});
