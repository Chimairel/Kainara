/** Guarded synthetic acceptance: no shared data or provider traffic. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import prisma from '../src/lib/prisma';
import authenticate from '../src/middleware/auth';
import requireRole from '../src/middleware/rbac';
import { errorHandler } from '../src/middleware/errorHandler';
import router from '../src/routes/admin-meal-log.routes';
import { AdminMealLogService } from '../src/services/admin-meal-log.service';
import { mealLogFiltersSchema } from '../src/validation/admin-meal-log.schemas';
import { setMealLogAuditContext } from '../src/services/meal-log-audit-context.service';
import { signAccessToken } from '../src/lib/jwt';
import { OutsideMealCaptureService } from '../src/services/outside-meal-capture.service';
import { OutsideMealReviewService } from '../src/services/outside-meal-review.service';

const macros = { calories: 400, proteinG: 20, carbsG: 50, fatG: 12 };
async function user(id: string, role: 'USER' | 'ADMIN' | 'NUTRITIONIST' = 'USER') {
  return prisma.user.create({
    data: {
      id,
      role,
      name: `Synthetic ${id}`,
      email: `${id}@example.test`,
      emailVerified: true,
      passwordHash: 'unused-synthetic-password',
      userProfile: { create: { age: 24 } },
    },
  });
}
async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55485');
  assert.equal(target.pathname, '/kainara_meal_log_audit_test');
  assert.equal(process.env.NODE_ENV, 'test');
  process.env.MEMBERSHIP_ENABLED = 'true';
  process.env.JWT_SECRET = 'synthetic-meal-log-audit-jwt-secret';
  if (process.argv.includes('--seed-legacy')) {
    assert.equal(await prisma.user.count(), 0);
    await user('legacy');
    await prisma.mealLog.create({
      data: {
        id: 'legacy-log',
        userId: 'legacy',
        mealName: 'Older unmapped meal',
        source: 'USER_LOGGED',
        status: 'DONE',
        dataSource: 'USER_REPORTED',
        ...macros,
      },
    });
    console.log('Legacy fixture seeded before the new migration.');
    return;
  }
  assert.equal(await prisma.user.count(), 1, 'Seed only the legacy fixture before migration.');
  const legacy = await prisma.mealLogAuditRecord.findUniqueOrThrow({ where: { logId: 'legacy-log' } });
  assert.equal(legacy.firstRecordedAt, null);
  assert.equal(legacy.ageGroup, 'UNKNOWN');
  assert.equal(legacy.membership, 'UNKNOWN');
  assert.equal(await prisma.mealLogAuditEvent.count({ where: { logId: legacy.logId } }), 0);
  const admin = await user('admin', 'ADMIN'),
    rnd = await user('rnd', 'NUTRITIONIST');
  const reviewer = await prisma.nutritionistProfile.create({
    data: {
      userId: rnd.id,
      isVerified: true,
      prcLicenseNumber: 'SYNTHETIC',
      prcLicenseExpiry: new Date('2030-01-01'),
      university: 'Synthetic fixture',
      specialization: 'Synthetic fixture',
      yearsOfExperience: 1,
    },
  });
  const library = await prisma.mealLibrary.create({
    data: { id: 'recipe', mealName: 'Canonical meal', mealType: 'LUNCH', ...macros },
  });
  const variant = await prisma.mealLibrary.create({
    data: { id: 'variant', parentMealId: library.id, mealName: 'Serving variant', mealType: 'LUNCH', ...macros },
  });
  const now = new Date();
  const filters = mealLogFiltersSchema.parse({
    from: new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10),
    to: new Date(now.getTime() + 86400000).toISOString().slice(0, 10),
    limit: 2,
  });
  for (let n = 0; n < 6; n++) {
    const member = await user(`member-${n}`);
    await prisma.membershipAccount.create({
      data: {
        userId: member.id,
        trialStartedAt: new Date(now.getTime() - 86400000),
        createdAt: new Date(now.getTime() - 2 * 86400000),
      },
    });
    await prisma.mealPlanCycle.create({
      data: {
        id: `cycle-${n}`,
        userId: member.id,
        planType: 'WEEKLY',
        startDate: now,
        endDate: new Date(now.getTime() + 6 * 86400000),
        preparationOpensAt: now,
        shoppingDeadlineAt: now,
        expectedSlotCount: 1,
        status: 'ACTIVE',
      },
    });
    await prisma.mealPlan.create({
      data: {
        id: `plan-${n}`,
        planGroupId: `cycle-${n}`,
        userId: member.id,
        libraryMealId: n % 2 ? variant.id : library.id,
        mealName: n % 2 ? 'Serving variant' : 'Canonical meal',
        mealType: 'LUNCH',
        scheduledDate: now,
        ...macros,
      },
    });
    await prisma.$transaction(async (tx) => {
      await setMealLogAuditContext(tx, member.id, 'Initial decision');
      await tx.mealLog.create({
        data: {
          id: `planned-${n}`,
          userId: member.id,
          mealPlanId: `plan-${n}`,
          source: 'SYSTEM_GENERATED',
          mealName: 'Canonical meal',
          mealType: 'LUNCH',
          dataSource: 'FNRI',
          status: n === 5 ? 'SKIPPED' : 'DONE',
          ...macros,
        },
      });
    });
  }
  const context = await prisma.mealLogAuditRecord.findUniqueOrThrow({ where: { logId: 'planned-0' } });
  assert.equal(context.ageGroup, '18-24');
  assert.equal(context.membership, 'FREE_HEALTH');
  const count = await prisma.mealLogAuditEvent.count({ where: { logId: 'planned-0' } });
  await prisma.$transaction(async (tx) => {
    await setMealLogAuditContext(tx, 'member-0', 'Retry');
    await tx.mealLog.update({ where: { id: 'planned-0' }, data: { status: 'DONE' } });
  });
  assert.equal(
    await prisma.mealLogAuditEvent.count({ where: { logId: 'planned-0' } }),
    count,
    'No-op retry must not create another change.'
  );
  await prisma.userProfile.update({ where: { userId: 'member-0' }, data: { age: 49 } });
  await prisma.membershipGrant.create({
    data: {
      userId: 'member-0',
      tier: 'HEALTH',
      source: 'ADMIN_ADJUSTMENT',
      evidenceReference: 'Synthetic new membership',
      verifiedAt: now,
      effectiveFrom: now,
      effectiveUntil: new Date(now.getTime() + 30 * 86400000),
    },
  });
  await prisma.$transaction(async (tx) => {
    await setMealLogAuditContext(tx, 'member-0', 'Corrected note');
    await tx.mealLog.update({ where: { id: 'planned-0' }, data: { notes: 'Synthetic correction' } });
  });
  const afterContext = await prisma.mealLogAuditRecord.findUniqueOrThrow({ where: { logId: 'planned-0' } });
  assert.equal(afterContext.ageGroup, context.ageGroup);
  assert.equal(afterContext.membership, context.membership);
  const outside = await prisma.$transaction(async (tx) => {
    await setMealLogAuditContext(tx, 'member-0', 'Outside meal');
    return tx.mealLog.create({
      data: {
        id: 'outside',
        userId: 'member-0',
        source: 'USER_LOGGED',
        mealName: 'Two portions of the same dish',
        status: 'DONE',
        mealType: 'LUNCH',
        dataSource: 'USER_REPORTED',
        ...macros,
        outsideItems: {
          create: [0, 1].map((position) => ({
            id: `item-${position}`,
            position,
            name: 'Canonical meal',
            mealLibraryId: library.id,
            portionGrams: 100,
            source: 'USER_ADJUSTED_LIBRARY',
            nutritionStatus: 'USER_REPORTED',
            compatibilityStatus: 'INSUFFICIENT_EVIDENCE',
            includedInTotals: true,
            ...macros,
          })),
        },
      },
    });
  });
  const ranking = await AdminMealLogService.popularity(admin.id, filters);
  assert.equal(ranking.rows[0].key, 'recipe:recipe');
  assert.equal(ranking.rows[0].eaten, 6);
  assert.equal(ranking.rows[0].members, 5);
  assert.equal(ranking.rows[0].repeatEaters, 1);
  assert.equal(ranking.rows[0].skipped, 1);
  assert.equal(ranking.rows[0].eatenPercentage, 85.7);
  const lineage = await prisma.mealReviewLineage.create({ data: { key: 'recipe:recipe' } });
  await prisma.mealLibrary.updateMany({
    where: { id: { in: [library.id, variant.id] } },
    data: { reviewLineageId: lineage.id },
  });
  assert.equal(
    (await AdminMealLogService.popularity(admin.id, filters)).rows[0].eaten,
    6,
    'First review lineage assignment must not split older and newer recipe counts.'
  );
  await OutsideMealCaptureService.editItem('member-0', 'outside', 'item-0', {
    name: 'Canonical meal',
    portionGrams: 110,
    reportedNutrition: { ...macros, calories: 440 },
    reason: 'Synthetic portion correction',
  });
  assert.equal((await AdminMealLogService.popularity(admin.id, filters)).rows[0].eaten, 6);
  await prisma.outsideMealReview.upsert({
    where: { outsideMealLogItemId: 'item-0' },
    create: {
      outsideMealLogItemId: 'item-0',
      queueReason: 'Fixture review',
      status: 'CLAIMED',
      claimedByNutritionistId: reviewer.id,
      claimedAt: new Date(),
      claimedRevision: 1,
    },
    update: { status: 'CLAIMED', claimedByNutritionistId: reviewer.id, claimedAt: new Date(), claimedRevision: 1 },
  });
  await OutsideMealReviewService.resolve(
    reviewer.id,
    (await prisma.outsideMealReview.findUniqueOrThrow({ where: { outsideMealLogItemId: 'item-0' } })).id,
    { action: 'CORRECT', reason: 'Synthetic RND correction', ...macros, calories: 420 }
  );
  const details = await AdminMealLogService.detail(admin.id, 'outside');
  assert.ok(details.events.some((e) => e.actorRole === 'NUTRITIONIST' && e.reason === 'Synthetic RND correction'));
  assert.ok(
    details.events.some(
      (e) => e.before && e.after && JSON.stringify(e.before).includes('440') && JSON.stringify(e.after).includes('420')
    )
  );
  assert.ok(!JSON.stringify(details).includes('checkoutHash'));
  assert.ok(!JSON.stringify(details).includes('outsideImage'));
  assert.equal(
    await prisma.auditEvent.count({ where: { actorUserId: admin.id, action: 'ADMIN_MEAL_LOG_DETAILS_ACCESSED' } }),
    1
  );
  await OutsideMealCaptureService.voidLog('member-0', outside.id, 'Synthetic removed entry');
  await OutsideMealCaptureService.voidLog('member-0', outside.id, 'Retry removal');
  assert.equal((await AdminMealLogService.popularity(admin.id, filters)).rows[0].eaten, 5);
  const marked = await user('marked');
  await prisma.auditEvent.create({
    data: {
      action: 'SYNTHETIC_DEV_ACCOUNT_CREATED',
      entityType: 'User',
      entityId: marked.id,
      metadata: { synthetic: true },
    },
  });
  await prisma.mealLog.create({
    data: {
      id: 'marked-log',
      userId: marked.id,
      mealName: 'Marked test meal',
      source: 'USER_LOGGED',
      status: 'DONE',
      dataSource: 'USER_REPORTED',
      ...macros,
    },
  });
  assert.ok(
    !(await AdminMealLogService.list(admin.id, { ...filters, limit: 50 })).rows.some((r) => r.logId === 'marked-log')
  );
  assert.ok(
    (await AdminMealLogService.list(admin.id, { ...filters, includeTests: true, limit: 50 })).rows.some(
      (r) => r.logId === 'marked-log'
    )
  );
  assert.equal((await AdminMealLogService.popularity(admin.id, { ...filters, ageGroup: '18-24' })).rows[0].eaten, 5);
  assert.equal(
    (await AdminMealLogService.popularity(admin.id, { ...filters, ageGroup: '45+' })).rows.length,
    0,
    'Small cohorts are suppressed.'
  );
  const page1 = await AdminMealLogService.list(admin.id, filters),
    page2 = await AdminMealLogService.list(admin.id, { ...filters, page: 2 });
  assert.equal(page1.rows.length, 2);
  assert.equal(page2.rows.length, 2);
  assert.ok(!page1.rows.some((a) => page2.rows.some((b) => a.logId === b.logId)));
  const beforeRollback = await prisma.mealLogAuditEvent.count({ where: { logId: 'planned-0' } });
  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await setMealLogAuditContext(tx, 'member-0', 'Rolled back edit');
        await tx.mealLog.update({ where: { id: 'planned-0' }, data: { notes: 'Must not persist' } });
        throw new Error('Synthetic rollback');
      }),
    /Synthetic rollback/
  );
  assert.equal(await prisma.mealLogAuditEvent.count({ where: { logId: 'planned-0' } }), beforeRollback);
  assert.equal((await prisma.mealLog.findUniqueOrThrow({ where: { id: 'planned-0' } })).notes, 'Synthetic correction');
  await Promise.all(
    [0, 1].map(() =>
      prisma.$transaction(async (tx) => {
        await setMealLogAuditContext(tx, 'member-0', 'Concurrent same edit');
        await tx.mealLog.update({ where: { id: 'planned-0' }, data: { notes: 'Concurrent correction' } });
      })
    )
  );
  assert.equal(
    await prisma.mealLogAuditEvent.count({ where: { logId: 'planned-0' } }),
    beforeRollback + 1,
    'Concurrent duplicate writes record one real change.'
  );
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Manila'`;
    await setMealLogAuditContext(tx, 'member-0', 'Timezone-independent timestamp');
    await tx.mealLog.update({ where: { id: 'planned-0' }, data: { notes: 'Timezone test' } });
  });
  const timezoneEvent = await prisma.mealLogAuditEvent.findFirstOrThrow({
    where: { logId: 'planned-0' },
    orderBy: { sequence: 'desc' },
  });
  assert.ok(
    Math.abs(timezoneEvent.occurredAt.getTime() - Date.now()) < 10000,
    'Capture timestamps remain UTC even when the session timezone changes.'
  );
  await prisma.$transaction(async (tx) => {
    await setMealLogAuditContext(tx, 'legacy', 'Legacy edit');
    await tx.mealLog.update({ where: { id: 'legacy-log' }, data: { notes: 'Newly recorded edit' } });
  });
  assert.equal(
    (await prisma.mealLogAuditRecord.findUniqueOrThrow({ where: { logId: 'legacy-log' } })).ageGroup,
    'UNKNOWN'
  );
  assert.equal(
    (await prisma.mealLogAuditRecord.findUniqueOrThrow({ where: { logId: 'legacy-log' } })).firstRecordedAt,
    null
  );
  await prisma.mealPlan.delete({ where: { id: 'plan-3' } });
  assert.equal(
    (await prisma.mealLogAuditRecord.findUniqueOrThrow({ where: { logId: 'planned-3' } })).snapshot &&
      JSON.parse(
        JSON.stringify((await prisma.mealLogAuditRecord.findUniqueOrThrow({ where: { logId: 'planned-3' } })).snapshot)
      ).recipeKey,
    'recipe:recipe',
    'Deleted plan cannot erase recorded recipe identity.'
  );
  await assert.rejects(
    () => prisma.mealLogAuditEvent.update({ where: { id: details.events[0].id }, data: { reason: 'Tamper' } }),
    /immutable/
  );
  await assert.rejects(
    () => prisma.mealLogAuditRecord.update({ where: { logId: 'outside' }, data: { ageGroup: '35-44' } }),
    /immutable/
  );
  await assert.rejects(() => prisma.mealLogAuditEvent.delete({ where: { id: details.events[0].id } }), /immutable/);
  await prisma.$transaction(async (tx) => {
    await setMealLogAuditContext(tx, 'member-1', 'Removed log');
    await tx.mealLog.delete({ where: { id: 'planned-1' } });
  });
  assert.equal((await prisma.mealLogAuditRecord.findUniqueOrThrow({ where: { logId: 'planned-1' } })).deleted, true);
  assert.ok(
    (await AdminMealLogService.list(admin.id, { ...filters, status: 'REMOVED', limit: 50 })).rows.some(
      (r) => r.logId === 'planned-1'
    )
  );
  await prisma.user.delete({ where: { id: 'member-2' } });
  assert.equal(
    await prisma.mealLogAuditRecord.count({ where: { userId: 'member-2' } }),
    0,
    'Account erasure removes private evidence.'
  );
  await assert.rejects(() => AdminMealLogService.detail(rnd.id, 'outside'));
  await assert.rejects(() => AdminMealLogService.list('member-0', filters));
  const app = express();
  app.use('/logs', authenticate, requireRole('ADMIN'), router);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/logs`;
  const headers = (who: typeof admin) => ({
    Authorization: `Bearer ${signAccessToken({ userId: who.id, email: who.email, role: who.role })}`,
  });
  try {
    assert.equal((await fetch(base + '/popularity', { headers: headers(rnd) })).status, 403);
    assert.equal((await fetch(base + '?from=2020-01-01', { headers: headers(admin) })).status, 400);
    assert.equal((await fetch(base + '/popularity?includeTests=true', { headers: headers(admin) })).status, 400);
    const response = await fetch(base, { headers: headers(admin) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal((await fetch(base + '/outside?memberId=other', { headers: headers(admin) })).status, 400);
    await prisma.user.update({ where: { id: admin.id }, data: { isSuspended: true } });
    assert.equal((await fetch(base, { headers: headers(admin) })).status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  console.log(
    'Meal log audit SQL/services/HTTP acceptance passed: legacy context, variants, retries, concurrency, rollback, corrections, actors, removals, cohorts, pagination, access and account erasure.'
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
