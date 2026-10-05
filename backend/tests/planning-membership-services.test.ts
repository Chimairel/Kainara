import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { healthDetailsRequirements } from '../src/domain/health-details.policy';
import { AppError } from '../src/errors/AppError';
import { MembershipService } from '../src/services/membership.service';
import { MembershipCheckoutService } from '../src/services/membership-checkout.service';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';
import { PlanningReadinessService } from '../src/services/planning-readiness.service';
import { ProfileCycleAdaptationService } from '../src/services/profile-cycle-adaptation.service';
import { UpcomingPlanPreparationService } from '../src/services/upcoming-plan-preparation.service';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';

test('Free weight activation writes a receipt, while mixed updates and medical changes cannot bypass access', async (t) => {
  const enabled = process.env.MEMBERSHIP_ENABLED;
  process.env.MEMBERSHIP_ENABLED = 'true';
  t.after(() => {
    if (enabled === undefined) delete process.env.MEMBERSHIP_ENABLED;
    else process.env.MEMBERSHIP_ENABLED = enabled;
  });
  let health = false;
  let activity = 'SEDENTARY';
  let writes = 0;
  const before = { weightKg: 60, dailyCalorieTarget: 2000, activityLevel: 'SEDENTARY', safetyRevision: 1 };
  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async () => [],
    userProfile: {
      findUniqueOrThrow: async () => ({ revision: 2, safetyRevision: 1, planningReportVersion: 1 }),
      update: async () => ({}),
    },
    nutritionReport: {
      findUniqueOrThrow: async () => ({ version: 2, profileRevision: 2, acknowledgedAt: null, isStale: false }),
      update: async () => {
        writes++;
        return { acknowledgedAt: new Date() };
      },
    },
    nutritionReportVersion: {
      findFirst: async ({ where }: { where: { version: number } }) => ({
        policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
        profileSnapshot: {
          profile:
            where.version === 1
              ? before
              : { ...before, weightKg: 62, dailyCalorieTarget: 2025, activityLevel: activity },
          conditions: [],
          allergens: [],
          otherConditions: null,
          otherAllergies: null,
        },
      }),
      updateMany: async () => ({ count: 1 }),
    },
  };
  t.mock.method(prisma, '$transaction', async (work: (db: Prisma.TransactionClient) => Promise<unknown>) =>
    work(tx as unknown as Prisma.TransactionClient)
  );
  t.mock.method(MembershipService, 'state', async () => ({ requiresCaseReview: health }));
  t.mock.method(MembershipService, 'assertEnhanced', async () => {
    throw new AppError('Lifestyle needed', 403, 'MEMBERSHIP_REQUIRED');
  });
  t.mock.method(MembershipService, 'assertHealth', async () => {
    throw new AppError('Health needed', 403, 'HEALTH_MEMBERSHIP_REQUIRED');
  });
  t.mock.method(PlanningReadinessService, 'getForUser', async () => null);
  t.mock.method(ProfileCycleAdaptationService, 'recordOrdinaryChange', async () => undefined);
  t.mock.method(ProfileCycleAdaptationService, 'acknowledgeProfileRevision', async () => undefined);
  t.mock.method(UpcomingPlanPreparationService, 'triggerNonBlocking', () => undefined);
  assert.ok((await NutritionReportService.acknowledgeReport('fixture', 2)).report.acknowledgedAt);
  assert.equal(writes, 1);
  activity = 'ACTIVE';
  await assert.rejects(
    NutritionReportService.acknowledgeReport('fixture', 2),
    (error: unknown) => error instanceof AppError && error.errorCode === 'MEMBERSHIP_REQUIRED'
  );
  activity = 'SEDENTARY';
  health = true;
  await assert.rejects(
    NutritionReportService.acknowledgeReport('fixture', 2),
    (error: unknown) => error instanceof AppError && error.errorCode === 'HEALTH_MEMBERSHIP_REQUIRED'
  );
  assert.equal(writes, 1, 'Rejected updates must not write a planning receipt.');
});

test('Lifestyle quote and checkout recheck health needs before storing a quote or contacting payment provider', async (t) => {
  const settings = {
    MEMBERSHIP_ENABLED: 'true',
    PAYMONGO_INTEGRATION_ENABLED: 'true',
    PAYMONGO_ENVIRONMENT: 'TEST',
    PAYMONGO_SECRET_KEY: 'sk_test_' + 'fixture'.repeat(5),
    DATABASE_URL: 'postgresql://fixture@localhost/fixture',
    FRONTEND_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  };
  const original = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.assign(process.env, settings);
  t.after(() => {
    for (const [key, value] of Object.entries(original))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  });
  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async () => [],
    user: { findUnique: async () => ({ role: 'USER', emailVerified: true, onboardingDone: true, tosAccepted: true }) },
    membershipTestCheckout: {
      create: () => assert.fail('Ineligible selection must not store a quote.'),
      findUnique: () => assert.fail('Even an older quote must recheck the current profile.'),
    },
  };
  t.mock.method(prisma, '$transaction', async (work: (db: Prisma.TransactionClient) => Promise<unknown>) =>
    work(tx as unknown as Prisma.TransactionClient)
  );
  t.mock.method(MembershipService, 'state', async () => ({ requiresCaseReview: true }));
  t.mock.method(globalThis, 'fetch', () => assert.fail('Blocked checkout must not contact the provider.'));
  const denied = (error: unknown) =>
    error instanceof AppError && error.statusCode === 403 && error.errorCode === 'HEALTH_PLANNING_REQUIRED';
  await assert.rejects(MembershipCheckoutService.quote('fixture', { tier: 'LIFESTYLE', period: 'MONTHLY' }), denied);
  await assert.rejects(
    MembershipCheckoutService.create('fixture', {
      tier: 'LIFESTYLE',
      period: 'MONTHLY',
      quoteId: 'quote-fixture',
      requestKey: 'e36689b9-0264-4463-8042-7c4cce43a4d6',
    }),
    denied
  );
});

test('supported allergy-only intake skips clinical forms and profile confirmation; medical intake still needs approval', async (t) => {
  let medical = false;
  const user = () => ({
    userProfile: { safetyRevision: 1, otherConditions: null, otherAllergies: null },
    healthConditions: medical ? [{ condition: 'DIABETES' }] : [],
    allergies: [{ allergen: 'SHELLFISH' }],
    clinicalContextResponses: [],
    safetyProfileEntries: [
      { domain: 'CONDITION', canonicalCode: medical ? 'DIABETES' : 'NONE', supportState: 'SUPPORTED' },
      { domain: 'ALLERGY', canonicalCode: 'SHELLFISH', supportState: 'SUPPORTED' },
    ],
  });
  const client = {
    user: { findUnique: async () => user() },
    clinicalProfileReview: { findMany: async () => [] },
  } as unknown as Pick<Prisma.TransactionClient, 'user' | 'clinicalProfileReview'>;
  t.mock.method(ClinicalEvidenceService, 'requirementsForUser', async () =>
    healthDetailsRequirements(user() as Parameters<typeof healthDetailsRequirements>[0])
  );
  assert.equal(await ClinicalProfileReviewService.hasCurrentApproval('fixture', client), true);
  assert.equal(await ClinicalEvidenceService.nextOnboardingDetailsPath('fixture', ['ALLERGY']), null);
  medical = true;
  assert.equal(await ClinicalProfileReviewService.hasCurrentApproval('fixture', client), false);
  assert.equal(
    await ClinicalEvidenceService.nextOnboardingDetailsPath('fixture', ['ALLERGY']),
    '/onboarding/allergy-details'
  );
  assert.equal(
    await ClinicalEvidenceService.nextOnboardingDetailsPath('fixture', ['CONDITION']),
    '/onboarding/condition-details'
  );
});
