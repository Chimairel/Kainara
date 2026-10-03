import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { calculateDailyTarget } from '../src/lib/calculations';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../src/domain/onboarding.policy';
import { UserProfileService } from '../src/services/user-profile.service';
import { onboardingWeightId } from '../src/services/weight-history.service';

test('completing onboarding records the member input inside the existing transaction only once', async (context) => {
  const profile = {
    userId: 'fixture-member',
    revision: 1,
    safetyRevision: 0,
    age: 25,
    biologicalSex: 'MALE',
    heightCm: 170,
    weightKg: 57,
    targetWeightKg: 65,
    goal: 'BUILD_MUSCLE' as const,
    activityLevel: 'SEDENTARY' as const,
    dietaryPreference: 'OMNIVORE',
    ricePreference: 'FLEXIBLE',
    foodCulture: 'Filipino',
    shoppingDayOfWeek: 6,
    dailyCalorieTarget: 0,
    otherConditions: null,
    otherAllergies: null,
  };
  profile.dailyCalorieTarget = calculateDailyTarget({ ...profile, biologicalSex: 'MALE' }).dailyCalorieTarget;
  const user = {
    onboardingDone: false,
    tosAccepted: true,
    acceptedTermsVersion: CURRENT_TERMS_VERSION,
    acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
    userProfile: profile,
    healthConditions: [],
    allergies: [],
    clinicalContextResponses: [],
    nutritionReport: null,
    safetyProfileEntries: [{ domain: 'CONDITION' }, { domain: 'ALLERGY' }],
  };
  let baselineWrites = 0;
  let insideTransaction = false;
  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async () => [],
    userProfile: { findUniqueOrThrow: async () => profile },
    clinicalContextResponse: { findMany: async () => [] },
    user: {
      update: async () => {
        user.onboardingDone = true;
        return user;
      },
    },
    weightLog: {
      upsert: async (args: { create: { id: string; weightKg: number; userId: string } }) => {
        assert.equal(insideTransaction, true);
        assert.equal(args.create.id, onboardingWeightId(profile.userId));
        assert.equal(args.create.userId, profile.userId);
        assert.equal(args.create.weightKg, 57);
        baselineWrites++;
        return args.create;
      },
    },
    nutritionReport: { updateMany: async () => ({ count: 0 }) },
  } as unknown as Prisma.TransactionClient;
  const originalFind = prisma.user.findUnique;
  context.after(() => {
    prisma.user.findUnique = originalFind;
  });
  prisma.user.findUnique = (async () => user) as unknown as typeof prisma.user.findUnique;
  context.mock.method(prisma, '$transaction', async (work: (client: Prisma.TransactionClient) => Promise<unknown>) => {
    insideTransaction = true;
    try {
      return await work(tx);
    } finally {
      insideTransaction = false;
    }
  });
  assert.equal((await UserProfileService.completeOnboarding(profile.userId)).onboardingDone, true);
  await UserProfileService.completeOnboarding(profile.userId);
  assert.equal(baselineWrites, 1);
});
