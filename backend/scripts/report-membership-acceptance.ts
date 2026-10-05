import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/membership_acceptance')
    throw new Error('Report acceptance requires the disposable local membership_acceptance database.');
  process.env.MEMBERSHIP_ENABLED = 'true';
  process.env.NODE_ENV = 'test';
  const { default: prisma } = await import('../src/lib/prisma');
  const { NutritionReportService: reports } = await import('../src/services/nutrition-report.service');
  const { UserProfileService } = await import('../src/services/user-profile.service');
  const { CheckinService } = await import('../src/services/checkin.service');
  const { MembershipService: membership } = await import('../src/services/membership.service');
  const { UpcomingPlanPreparationService } = await import('../src/services/upcoming-plan-preparation.service');
  const { loadPlanningNutritionContext } = await import('../src/domain/user-nutrition-context');
  const { advanceSafetyRevision, lockUserProfile } = await import('../src/services/profile-revision.service');
  const originalTrigger = UpcomingPlanPreparationService.triggerNonBlocking;
  UpcomingPlanPreparationService.triggerNonBlocking = () => {};
  const ids: string[] = [];
  const now = new Date();
  const past = new Date(now.getTime() - 31 * 86_400_000);
  const future = new Date(now.getTime() + 30 * 86_400_000);
  const create = async () => {
    const id = `report-tier-fixture-${randomUUID()}`;
    ids.push(id);
    await prisma.user.create({
      data: {
        id,
        role: 'USER',
        email: `${id}@example.invalid`,
        name: 'Report fixture',
        passwordHash: 'not-a-login-password',
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
            dailyCalorieTarget: 2000,
            shoppingDayOfWeek: 0,
          },
        },
      },
    });
    await prisma.membershipAccount.create({ data: { userId: id, trialStartedAt: past, createdAt: past } });
    return id;
  };
  const grant = (userId: string, tier: 'LIFESTYLE' | 'HEALTH') =>
    prisma.membershipGrant.create({
      data: {
        userId,
        tier,
        source: 'ADMIN_ADJUSTMENT',
        evidenceReference: `fixture:${randomUUID()}`,
        verifiedAt: past,
        effectiveFrom: past,
        effectiveUntil: future,
      },
    });
  try {
    const user = await create();
    let report = await reports.generateReport(user);
    await reports.acknowledgeReport(user, report.version); // first ever, even after trial expiry
    assert.equal((await membership.state(user)).tier, 'FREE');
    const initial = (await loadPlanningNutritionContext(prisma, user, 'missing')).profile;
    await UserProfileService.updateUserProfile(user, { goal: 'LOSE_WEIGHT', shoppingDayOfWeek: 3 });
    report = await reports.generateReport(user);
    await assert.rejects(reports.acknowledgeReport(user, report.version), { errorCode: 'MEMBERSHIP_REQUIRED' });
    assert.equal((await reports.keepPreviousReport(user)).activeVersion, 1);
    let planned = (await loadPlanningNutritionContext(prisma, user, 'missing')).profile;
    assert.equal(planned.goal, initial.goal);
    assert.equal(planned.shoppingDayOfWeek, initial.shoppingDayOfWeek);
    await prisma.userProfile.update({ where: { userId: user }, data: { firstReportAcknowledgedAt: past } });
    await assert.rejects(CheckinService.submitCheckin(user, { changed: false }), {
      errorCode: 'PROFILE_UPDATES_PENDING',
    });
    assert.equal(await prisma.weeklyCheckin.count({ where: { userId: user } }), 0);
    const lifestyle = await grant(user, 'LIFESTYLE');
    await reports.acknowledgeReport(user, report.version);
    planned = (await loadPlanningNutritionContext(prisma, user, 'missing')).profile;
    assert.equal(planned.goal, 'LOSE_WEIGHT');
    assert.equal(planned.shoppingDayOfWeek, 3);
    assert.equal((await membership.view(user)).tier, 'LIFESTYLE');
    await assert.rejects(membership.assertHealth(user), { errorCode: 'HEALTH_MEMBERSHIP_REQUIRED' });
    const views = await membership.view(user);
    assert.equal(views.enabled && views.usage.PLAN_REVIEW.cap, 0);
    assert.equal(views.enabled && views.usage.OUTSIDE_REVIEW.cap, 0);
    await prisma.membershipGrant.update({ where: { id: lifestyle.id }, data: { revokedAt: now } });
    const beforeCount = await prisma.nutritionReportVersion.count({ where: { userId: user } });
    const checkin = await CheckinService.submitCheckin(user, { changed: false });
    assert.equal(checkin.duplicate, false);
    report = (await reports.getReport(user))!;
    assert.equal(report.confirmationKind, 'UNCHANGED_CHECKIN');
    assert.equal(report.version, beforeCount + 1);
    await reports.acknowledgeReport(user, report.version); // unchanged renewal remains free
    assert.equal((await CheckinService.getCheckinStatus(user)).isDue, false);
    const retry = await CheckinService.submitCheckin(user, { changed: false });
    assert.equal(retry.duplicate, true);
    assert.equal(await prisma.nutritionReportVersion.count({ where: { userId: user } }), beforeCount + 1);
    assert.equal((await membership.state(user)).account.trialStartedAt!.getTime(), past.getTime());
    const priorVersion = report.version;
    // A real new disclosure cannot be hidden behind the previous baseline or an unchanged flag.
    await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, user);
      await tx.allergy.create({ data: { userId: user, allergen: 'EGGS' } });
      await tx.healthCondition.create({ data: { userId: user, condition: 'DIABETES' } });
      await advanceSafetyRevision(tx, user);
    });
    report = await reports.generateReport(user);
    await assert.rejects(reports.keepPreviousReport(user), { errorCode: 'REPORT_ACKNOWLEDGEMENT_REQUIRED' });
    await assert.rejects(reports.acknowledgeReport(user, report.version), { errorCode: 'HEALTH_MEMBERSHIP_REQUIRED' });
    const lifestyle2 = await grant(user, 'LIFESTYLE');
    await assert.rejects(reports.acknowledgeReport(user, report.version), { errorCode: 'HEALTH_MEMBERSHIP_REQUIRED' });
    await assert.rejects(membership.assertNewPlan(user, now), { errorCode: 'CASE_MEMBERSHIP_REQUIRED' });
    // Correcting the erroneous disclosure restores identical context without purchasing membership.
    await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, user);
      await tx.allergy.deleteMany({ where: { userId: user } });
      await tx.healthCondition.deleteMany({ where: { userId: user } });
      await advanceSafetyRevision(tx, user);
    });
    await prisma.membershipGrant.update({ where: { id: lifestyle2.id }, data: { revokedAt: new Date() } });
    report = await reports.generateReport(user);
    await reports.acknowledgeReport(user, report.version);
    assert.equal((await reports.keepPreviousReport(user)).activeVersion, report.version);
    assert.ok(report.version > priorVersion);
    // Health applies the new case context; Lifestyle cannot inherit Health allowances or expiry.
    await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, user);
      await tx.allergy.create({ data: { userId: user, allergen: 'EGGS' } });
      await tx.healthCondition.create({ data: { userId: user, condition: 'DIABETES' } });
      await advanceSafetyRevision(tx, user);
    });
    report = await reports.generateReport(user);
    const health = await grant(user, 'HEALTH');
    await reports.acknowledgeReport(user, report.version);
    assert.equal((await membership.state(user)).tier, 'HEALTH');
    await membership.assertHealth(user);
    const healthView = await membership.view(user);
    assert.equal(healthView.enabled, true);
    assert.equal(healthView.usage?.PLAN_REVIEW.cap, 1);
    await prisma.membershipGrant.update({ where: { id: health.id }, data: { revokedAt: new Date() } });
    await grant(user, 'LIFESTYLE');
    assert.equal((await membership.state(user)).tier, 'LIFESTYLE');
    await assert.rejects(membership.assertNewPlan(user, now), { errorCode: 'CASE_MEMBERSHIP_REQUIRED' });
    // Buying Lifestyle before the trial begins does not remove its pending Health trial.
    // Removing an accepted condition is still a case-context update, even with no remaining case.
    await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, user);
      await tx.allergy.deleteMany({ where: { userId: user } });
      await tx.healthCondition.deleteMany({ where: { userId: user } });
      await advanceSafetyRevision(tx, user);
    });
    report = await reports.generateReport(user);
    assert.equal(report.planningContext?.activationTier, 'HEALTH');
    await assert.rejects(reports.acknowledgeReport(user, report.version), { errorCode: 'HEALTH_MEMBERSHIP_REQUIRED' });
    const pending = await create();
    await prisma.membershipAccount.update({ where: { userId: pending }, data: { trialStartedAt: null } });
    await grant(pending, 'LIFESTYLE');
    assert.equal((await membership.state(pending)).healthAccess, true);
    await membership.assertHealth(pending);
    const trialStart = new Date(now.getTime() - 86_400_000);
    await prisma.membershipAccount.update({ where: { userId: pending }, data: { trialStartedAt: trialStart } });
    const trialHealth = await grant(pending, 'HEALTH');
    await prisma.membershipGrant.update({
      where: { id: trialHealth.id },
      data: { effectiveUntil: new Date(now.getTime() + 60000) },
    });
    assert.equal((await membership.state(pending)).healthUntil!.getTime(), trialStart.getTime() + 30 * 86_400_000);
    // A Health grant cannot borrow the later expiry of an overlapping Lifestyle grant.
    const shortHealth = await grant(user, 'HEALTH');
    const shortEnd = new Date(now.getTime() + 60_000);
    await prisma.membershipGrant.update({ where: { id: shortHealth.id }, data: { effectiveUntil: shortEnd } });
    assert.equal((await membership.state(user)).healthUntil!.getTime(), shortEnd.getTime());
    assert.equal((await membership.state(user, new Date(shortEnd.getTime() + 1))).tier, 'LIFESTYLE');
    // Concurrent unchanged submissions create exactly one check-in/report version.
    const parallel = await create();
    const first = await reports.generateReport(parallel);
    await reports.acknowledgeReport(parallel, first.version);
    await prisma.userProfile.update({ where: { userId: parallel }, data: { firstReportAcknowledgedAt: past } });
    const results = await Promise.all([
      CheckinService.submitCheckin(parallel, { changed: false }),
      CheckinService.submitCheckin(parallel, { changed: false }),
    ]);
    assert.equal(results.filter((r) => !r.duplicate).length, 1);
    assert.equal(await prisma.nutritionReportVersion.count({ where: { userId: parallel } }), 2);
    console.log(
      'Report and tier acceptance passed: free first/unchanged reports, draft isolation, correction recovery, Health gates, quotas and concurrent check-ins.'
    );
  } finally {
    UpcomingPlanPreparationService.triggerNonBlocking = originalTrigger;
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
