import assert from 'node:assert/strict';
import test from 'node:test';
import type { UserProfile } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { UserProfileService } from '../src/services/user-profile.service';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';

test('session profile reuses its fetched profile while enforcing accepted report safety and policy', async () => {
  const originalUserRead = prisma.user.findUnique;
  const originalReportRead = prisma.nutritionReportVersion.findFirst;
  const enabled = process.env.MEMBERSHIP_ENABLED;
  process.env.MEMBERSHIP_ENABLED = 'true';
  const profile = {
    age: 26,
    biologicalSex: 'MALE',
    heightCm: 170,
    weightKg: 65,
    goal: 'MAINTAIN',
    activityLevel: 'SEDENTARY',
    dailyCalorieTarget: 2000,
    safetyRevision: 1,
    revision: 1,
    planningReportVersion: 3,
  } as UserProfile;
  const fixture = {
    id: 'session-profile-fixture',
    email: 'fixture@preview.invalid',
    name: 'Fixture',
    role: 'USER',
    isSuspended: false,
    emailVerified: true,
    onboardingDone: true,
    tosAccepted: true,
    acceptedTermsVersion: '2026-09-27',
    acceptedPrivacyVersion: '2026-09-27',
    userProfile: profile,
    healthConditions: [],
    allergies: [],
    safetyProfileEntries: [],
    accounts: [],
    nutritionReport: null,
  };
  let userReads = 0;
  let reportReads = 0;
  let accepted: object | null = {
    profileSnapshot: { profile },
    acknowledgedAt: new Date(),
    policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
    profileRevision: 1,
  };
  prisma.user.findUnique = (async () => {
    userReads++;
    return fixture;
  }) as unknown as typeof originalUserRead;
  prisma.nutritionReportVersion.findFirst = (async (query: { where: { version?: number } }) => {
    reportReads++;
    assert.equal(query.where.version, 3, 'Validate the selected report, not a newer draft.');
    return accepted;
  }) as unknown as typeof originalReportRead;
  try {
    assert.equal(
      (await UserProfileService.getAuthenticatedProfileDetails(fixture.id))?.profile.reportAcknowledged,
      true
    );
    assert.equal(userReads, 1, 'No duplicate user/relations query during report validation.');
    assert.equal(reportReads, 1);
    const connectionError = Object.assign(new Error('Connection closed'), { code: 'P1017' });
    const healthyReportRead = prisma.nutritionReportVersion.findFirst;
    prisma.nutritionReportVersion.findFirst = (async () => {
      throw connectionError;
    }) as unknown as typeof originalReportRead;
    await assert.rejects(
      UserProfileService.getAuthenticatedProfileDetails(fixture.id),
      (error) => error === connectionError,
      'A failed database lookup is not an unacknowledged report.'
    );
    prisma.nutritionReportVersion.findFirst = healthyReportRead;
    fixture.userProfile = { ...profile, safetyRevision: 2 };
    assert.equal(
      (await UserProfileService.getAuthenticatedProfileDetails(fixture.id))?.profile.reportAcknowledged,
      false
    );
    fixture.userProfile = profile;
    accepted = { ...accepted, policyVersion: 'retired-policy' };
    assert.equal(
      (await UserProfileService.getAuthenticatedProfileDetails(fixture.id))?.profile.reportAcknowledged,
      false
    );
    accepted = null;
    assert.equal(
      (await UserProfileService.getAuthenticatedProfileDetails(fixture.id))?.profile.reportAcknowledged,
      false
    );
    const previousReads = reportReads;
    fixture.userProfile = null as unknown as UserProfile;
    assert.equal(
      (await UserProfileService.getAuthenticatedProfileDetails(fixture.id))?.profile.reportAcknowledged,
      false
    );
    assert.equal(reportReads, previousReads, 'Accounts with no user profile need no report read.');
  } finally {
    prisma.user.findUnique = originalUserRead;
    prisma.nutritionReportVersion.findFirst = originalReportRead;
    if (enabled === undefined) delete process.env.MEMBERSHIP_ENABLED;
    else process.env.MEMBERSHIP_ENABLED = enabled;
    await prisma.$disconnect();
  }
});
