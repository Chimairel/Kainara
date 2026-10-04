/* Guarded disposable database acceptance. Build the backend and apply migrations first. */
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { AdminAnalyticsService } = require('../dist/services/admin-analytics.service');
const { AdminService } = require('../dist/services/admin.service');
const target = new URL(process.env.DATABASE_URL || '');
if (target.hostname !== '127.0.0.1' || target.port !== '55476' || target.pathname !== '/admin_consolidation_tests') {
  throw new Error('This acceptance may write only to the dedicated local administrator test database.');
}
const db = new PrismaClient();
const now = new Date('2026-10-04T05:00:00.000Z');
const today = new Date('2026-10-04T00:00:00+08:00');
const shift = (date, days) => new Date(date.getTime() + days * 86400000);
const old = new Date(now.getTime() - 3 * 3600000);
const prefix = 'admin-metrics-fixture-';
const ids = [];

async function user(name, role = 'USER', isSuspended = false) {
  const row = await db.user.create({
    data: {
      id: prefix + name,
      name: 'Synthetic administrator metrics fixture',
      email: `${name}@admin-metrics.example.invalid`,
      passwordHash: 'not-a-real-password',
      role,
      isSuspended,
    },
  });
  ids.push(row.id);
  return row;
}
async function cycle(owner, name, start, end, status = 'ACTIVE', revision = 1) {
  return db.mealPlanCycle.create({
    data: {
      id: prefix + name,
      userId: owner.id,
      planType: 'WEEKLY',
      startDate: start,
      endDate: end,
      preparationOpensAt: start,
      shoppingDeadlineAt: start,
      expectedSlotCount: 21,
      status,
      cycleRevision: revision,
    },
  });
}
async function slot(owner, group, name, status = 'PENDING_REVIEW', extra = {}) {
  return db.mealPlan.create({
    data: {
      id: prefix + name,
      userId: owner.id,
      planGroupId: group.id,
      mealType: 'LUNCH',
      mealName: 'Synthetic lunch',
      calories: 500,
      proteinG: 25,
      carbsG: 60,
      fatG: 18,
      scheduledDate: today,
      createdAt: old,
      requiresSafetyRevalidation: false,
      status,
      ...extra,
    },
  });
}
async function main() {
  assert.equal(await db.user.count(), 0, 'Use a fresh dedicated database.');
  const member = await user('member');
  const second = await user('second');
  const suspendedMember = await user('suspended-member', 'USER', true);
  const emptyMember = await user('empty-member');
  const former = await user('former-professional');
  const reviewer = await user('reviewer', 'NUTRITIONIST');
  const expired = await user('expired', 'NUTRITIONIST');
  const suspended = await user('suspended-reviewer', 'NUTRITIONIST', true);
  const admin = await user('admin', 'ADMIN');
  const profile = async (owner, expiry) =>
    db.nutritionistProfile.create({
      data: {
        id: prefix + owner.id.slice(prefix.length) + '-profile',
        userId: owner.id,
        prcLicenseNumber: prefix + owner.id.slice(prefix.length),
        prcLicenseExpiry: expiry,
        isVerified: true,
      },
    });
  const valid = await profile(reviewer, new Date('2026-10-04T00:00:00Z'));
  const invalid = await profile(expired, new Date('2026-10-03T00:00:00Z'));
  await profile(suspended, shift(today, 10));
  await profile(former, shift(today, 10));
  const current = await cycle(member, 'current', shift(today, -1), shift(today, 5));
  await cycle(member, 'overlapping-current', today, shift(today, 6), 'ACTIVE', 2);
  const past = await cycle(second, 'past', shift(today, -10), shift(today, -1));
  const future = await cycle(second, 'future', shift(today, 1), shift(today, 7), 'PREPARING');
  const superseded = await cycle(second, 'superseded', today, shift(today, 6), 'SUPERSEDED');
  const suspendedCycle = await cycle(suspendedMember, 'suspended', today, shift(today, 6));
  await slot(member, current, 'approved', 'APPROVED');
  await slot(member, current, 'held', 'APPROVED', { requiresSafetyRevalidation: true });
  const replacement = await slot(member, current, 'pending-today', 'PENDING_REVIEW', {
    claimedAt: now,
    claimedByNutritionistId: valid.id,
  });
  await slot(member, current, 'replaced', 'APPROVED', { supersededByMealPlanId: replacement.id });
  await slot(second, past, 'old-approved', 'APPROVED', { scheduledDate: shift(today, -1) });
  await slot(second, future, 'future-pending', 'PENDING_REVIEW', {
    scheduledDate: shift(today, 1),
    claimedAt: now,
    claimedByNutritionistId: invalid.id,
  });
  await slot(second, superseded, 'superseded-pending');
  await slot(suspendedMember, suspendedCycle, 'suspended-pending');
  for (const status of ['DONE', 'PENDING', 'SKIPPED', 'VOIDED']) {
    await db.mealLog.create({
      data: {
        userId: member.id,
        source: 'USER_LOGGED',
        mealName: 'Synthetic food',
        calories: 500,
        proteinG: 25,
        carbsG: 60,
        fatG: 18,
        dataSource: 'USER_REPORTED',
        status,
      },
    });
  }
  for (const source of ['FNRI', 'USDA_FDC', 'OTHER']) {
    await db.foodItem.create({
      data: { id: prefix + source, name: 'Synthetic food', source, calories: 100, proteinG: 2, carbsG: 20, fatG: 2 },
    });
  }
  const serving = await db.mealLibrary.create({
    data: {
      id: prefix + 'library',
      mealName: 'Synthetic serving',
      mealType: 'LUNCH',
      calories: 500,
      proteinG: 25,
      carbsG: 60,
      fatG: 18,
      status: 'FLAGGED',
      safetyEvidenceStatus: 'COMPLETE',
    },
  });
  for (const [revision, expiresAt] of [shift(now, -1), shift(now, 1), null].entries()) {
    await db.mealConditionClearance.create({
      data: {
        mealLibraryId: serving.id,
        condition: 'HYPERTENSION',
        recipeSignature: 'a'.repeat(64),
        evidenceRevision: revision + 1,
        assuranceTier: 'BASE',
        provenance: 'MANUAL_REVIEW',
        state: 'ACTIVE',
        evidenceSnapshot: {},
        expiresAt,
      },
    });
  }
  for (const [i, status] of ['GENERATING', 'PROCESSING_AI', 'WAITING_FOR_AI', 'FAILED'].entries()) {
    await db.mealPlanGenerationJob.create({
      data: { userId: emptyMember.id, planType: 'WEEKLY', cycleStartDate: shift(today, i), status, updatedAt: old },
    });
  }
  for (const status of ['SUCCESS', 'FAILED']) {
    await db.aiUsageEvent.create({
      data: {
        provider: 'GEMINI',
        status,
        operation: 'MEAL_PLAN_GENERATION',
        attempts: 4,
        latencyMs: 100,
        createdAt: now,
      },
    });
  }
  const value = await AdminAnalyticsService.getSnapshot(now, db);
  assert.equal(value.totalUsers, 5);
  assert.equal(value.totalNutritionists, 3);
  assert.equal(value.verifiedNutritionists, 1, 'A license valid through today remains eligible.');
  assert.equal(value.expiredVerifiedNutritionists, 1);
  assert.equal(value.activeMealPlans, 1, 'One current cycle per active member, even with overlapping saved cycles.');
  assert.equal(value.approvedUpcomingMealSlots, 1);
  assert.equal(value.pendingReviews, 2);
  assert.equal(value.overdueReviews, 2);
  assert.equal(value.activeReviewClaims, 1, 'An expired reviewer claim must not be counted as eligible.');
  assert.equal(value.pendingPlansStartingSoon, 2, 'Include today at midnight as well as tomorrow.');
  assert.equal(value.totalMealLogs, 1);
  assert.equal(value.totalFoodItems, 1);
  assert.equal(value.usdaFoodItems, 1);
  assert.equal(value.completeLibraryEvidence, 1, 'Recorded complete is not equivalent to usable certification.');
  assert.equal(value.activeConditionClearances, 2, 'Ignore clearances whose active state has an expired date.');
  assert.equal(value.stuckGenerationJobs, 2, 'Include stale AI processing, exclude jobs waiting for capacity.');
  assert.equal(value.failedGenerationJobs24h, 1);
  assert.equal(value.aiSuccess24h, 1);
  assert.equal(value.aiFailures24h, 1);
  assert.equal(value.planningAiOperations30d, 2, 'Eight provider attempts belong to two recorded operations.');
  assert.equal(
    value.planSelectionsByProvenance30d.reduce((sum, row) => sum + row.count, 0),
    8
  );
  assert.equal(value.generatedAt, now.toISOString());
  await db.mealLibrary.create({
    data: {
      id: prefix + 'variant',
      parentMealId: serving.id,
      recipeFamilyId: serving.id,
      mealName: 'Synthetic scaled serving',
      mealType: 'LUNCH',
      calories: 250,
      proteinG: 12,
      carbsG: 30,
      fatG: 9,
      status: 'FLAGGED',
    },
  });
  await db.mealLibraryFlag.createMany({
    data: [serving.id, prefix + 'variant'].map((mealLibraryId) => ({
      mealLibraryId,
      flaggedByAdminUserId: admin.id,
      reason: 'Synthetic family concern',
      createdAt: now,
      status: 'PENDING',
    })),
  });
  await db.mealLibraryFlag.create({
    data: {
      mealLibraryId: serving.id,
      flaggedByNutritionistId: valid.id,
      reason: 'Independent synthetic concern',
      createdAt: now,
      status: 'PENDING',
    },
  });
  const incidents = await AdminService.getSafetyIncidents();
  assert.equal(incidents.length, 2, 'Group the family fan-out, keep separate actors and concerns.');
  assert.equal(incidents.find((row) => row.reason === 'Synthetic family concern').affectedServingCount, 2);
  assert.equal(incidents.find((row) => row.reason === 'Synthetic family concern').flaggedByAdminUser.name, admin.name);
  assert.equal(incidents.find((row) => row.reason === 'Independent synthetic concern').affectedServingCount, 1);
  // Production facade uses the same reader and its restriction summary is active-member scoped.
  await db.safetyProfileEntry.createMany({
    data: [member, suspendedMember, reviewer].flatMap((owner) =>
      ['CONDITION', 'ALLERGY'].map((domain) => ({
        userId: owner.id,
        domain,
        displayName: 'Synthetic restriction',
        originalText: 'synthetic',
        normalizedText: 'synthetic',
        provenance: 'CUSTOM',
        supportState: 'NEEDS_CLARIFICATION',
        policyReference: 'synthetic-fixture-v1',
      }))
    ),
  });
  const operations = await AdminService.getStructuredSafetyOperations();
  assert.equal(
    operations.usersRequiringReview,
    1,
    'Count each active member once; exclude suspended members and staff.'
  );
  assert.equal(
    operations.entries.reduce((sum, row) => sum + row.count, 0),
    2
  );
  console.log('Administrator metric acceptance passed: dates, units, roles, holds, jobs, sources, and telemetry.');
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Dedicated fixture data only; removal order respects clearance and reviewer references.
    await db.mealConditionClearance.deleteMany({ where: { mealLibraryId: prefix + 'library' } });
    await db.mealLibraryFlag.deleteMany({ where: { mealLibraryId: { in: [prefix + 'library', prefix + 'variant'] } } });
    await db.mealLibrary.deleteMany({ where: { id: prefix + 'variant' } });
    await db.mealLibrary.deleteMany({ where: { id: prefix + 'library' } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.foodItem.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.aiUsageEvent.deleteMany({ where: { createdAt: now, provider: 'GEMINI' } });
    await db.$disconnect();
    await require('../dist/lib/prisma').default.$disconnect();
  });
