import assert from 'node:assert/strict';
import express from 'express';
import prisma from '../src/lib/prisma';
import adminRouter from '../src/routes/admin-audit.routes';
import nutritionistRouter from '../src/routes/nutritionist.routes';
import authenticate from '../src/middleware/auth';
import requireRole from '../src/middleware/rbac';
import { errorHandler } from '../src/middleware/errorHandler';
import { signAccessToken } from '../src/lib/jwt';
import { AuditDetailsService } from '../src/services/audit-details.service';
import { OutsideMealReviewService } from '../src/services/outside-meal-review.service';
import { MealBaseVerificationService } from '../src/services/meal-base-verification.service';

const target = new URL(process.env.DATABASE_URL || '');
if (target.hostname !== '127.0.0.1' || target.port !== '55478' || target.pathname !== '/community_tests')
  throw new Error('Requires the disposable local database on port 55478.');
const run = `audit-details-${Date.now()}`;
const ids: string[] = [];
const meals: string[] = [];
const app = express();
app.use(express.json());
app.use('/admin/audit-history', authenticate, requireRole('ADMIN'), adminRouter);
app.use('/nutritionist', nutritionistRouter);
app.use(errorHandler);
const server = app.listen(0, '127.0.0.1');

async function main() {
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const user = async (role: 'USER' | 'ADMIN' | 'NUTRITIONIST', label: string) => {
    const row = await prisma.user.create({
      data: {
        role,
        name: label,
        email: `${run}-${ids.length}@example.invalid`,
        emailVerified: true,
        passwordHash: 'disabled',
      },
    });
    ids.push(row.id);
    return row;
  };
  const admin = await user('ADMIN', 'Synthetic admin');
  const reviewer = await user('NUTRITIONIST', 'Synthetic reviewer');
  const other = await user('NUTRITIONIST', 'Other reviewer');
  const member = await user('USER', 'Private member');
  const secondMember = await user('USER', 'Other private member');
  const profile = await prisma.nutritionistProfile.create({
    data: {
      userId: reviewer.id,
      isVerified: true,
      prcLicenseNumber: `${run}-1`,
      prcLicenseExpiry: new Date('2099-01-01'),
    },
  });
  await prisma.nutritionistProfile.create({
    data: {
      userId: other.id,
      isVerified: true,
      prcLicenseNumber: `${run}-2`,
      prcLicenseExpiry: new Date('2099-01-01'),
    },
  });
  const headers = (row: typeof admin) => ({
    authorization: `Bearer ${signAccessToken({ userId: row.id, email: row.email, role: row.role })}`,
  });
  const log = await prisma.mealLog.create({
    data: {
      userId: member.id,
      source: 'USER_LOGGED',
      mealType: 'SNACK',
      mealName: 'Synthetic egg',
      status: 'DONE',
      dataSource: 'GEMINI_ESTIMATED',
      calories: 85,
      proteinG: 6,
      carbsG: 1,
      fatG: 6,
      outsideImage: Buffer.from('PRIVATE_IMAGE'),
      outsideImageMime: 'image/png',
      notes: 'PRIVATE_NOTES',
      outsideItems: {
        create: {
          position: 0,
          name: 'Synthetic egg',
          portionGrams: 50,
          ingredients: ['egg'],
          source: 'GEMINI_ESTIMATED',
          nutritionStatus: 'PENDING_REVIEW',
          compatibilityStatus: 'INSUFFICIENT_EVIDENCE',
          includedInTotals: true,
          calories: 85,
          proteinG: 6,
          carbsG: 1,
          fatG: 6,
        },
      },
    },
    include: { outsideItems: true },
  });
  const item = log.outsideItems[0];
  const libraryBefore = await prisma.mealLibrary.count();
  const review = await prisma.outsideMealReview.create({
    data: {
      outsideMealLogItemId: item.id,
      status: 'CLAIMED',
      claimedByNutritionistId: profile.id,
      claimedAt: new Date(),
      claimedRevision: 0,
    },
  });
  const corrected = await OutsideMealReviewService.resolve(profile.id, review.id, {
    action: 'CORRECT',
    calories: 75,
    proteinG: 6,
    carbsG: 0,
    fatG: 5,
    reason: 'Synthetic portion checked.',
  });
  assert.equal(corrected.revision, 1);
  assert.equal(await prisma.mealLibrary.count(), libraryBefore, 'Intake review must not publish a reusable meal.');
  const event = await prisma.auditEvent.findFirstOrThrow({
    where: { entityId: item.id, action: 'OUTSIDE_MEAL_CORRECT' },
  });
  const read = async (row: typeof admin, path: string) => {
    const response = await fetch(`${base}${path}`, { headers: headers(row) });
    return { response, json: (await response.json()) as any };
  };
  const path = `/admin/audit-history/${event.id}`;
  assert.equal((await fetch(`${base}${path}`)).status, 401);
  for (const denied of [member, secondMember, reviewer]) assert.equal((await read(denied, path)).response.status, 403);
  for (const allowed of [reviewer, other]) {
    const detail = await read(allowed, `/nutritionist/audit-history/${event.id}`);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.json.data.food.name, 'Synthetic egg');
  }
  const detail = await read(admin, path);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.response.headers.get('cache-control'), 'private, no-store');
  assert.equal(detail.json.data.previous.calories, 85);
  assert.equal(detail.json.data.effective.carbsG, 0);
  assert.ok(!JSON.stringify(detail.json).includes('PRIVATE_'));
  assert.ok(!JSON.stringify(detail.json).includes(member.email));
  assert.equal((await read(reviewer, '/nutritionist/audit-history?mine=true')).json.data.total, 1);
  assert.equal((await read(other, '/nutritionist/audit-history?mine=true')).json.data.total, 0);
  assert.equal((await read(reviewer, '/nutritionist/audit-history?actorId=spoof')).response.status, 400);

  // Later edits and cascaded member deletion cannot alter the historical food record.
  await prisma.outsideMealLogItem.update({
    where: { id: item.id },
    data: { name: 'Later name', calories: 999, calorieLow: 999, calorieHigh: 999, currentRevision: 2 },
  });
  assert.equal((await AuditDetailsService.detail(event.id, 'admin')).food?.name, 'Synthetic egg');
  await prisma.user.delete({ where: { id: member.id } });
  assert.equal((await AuditDetailsService.detail(event.id, 'admin')).food?.name, 'Synthetic egg');

  const privateEvent = await prisma.auditEvent.create({
    data: {
      actorUserId: secondMember.id,
      action: 'HEALTH_DETAILS_UPDATED',
      entityType: 'User',
      entityId: secondMember.id,
      metadata: { notes: 'PRIVATE_ANSWERS' },
    },
  });
  for (const staff of [admin, reviewer]) {
    const prefix = staff.role === 'ADMIN' ? '/admin' : '/nutritionist';
    assert.equal((await read(staff, `${prefix}/audit-history/${privateEvent.id}`)).response.status, 404);
  }
  const adminEvent = await prisma.auditEvent.create({
    data: {
      actorUserId: admin.id,
      action: 'WEBSITE_MEDIA_PUBLISHED',
      entityType: 'WebsiteContent',
      entityId: run,
      metadata: { revision: 1 },
    },
  });
  assert.equal((await read(reviewer, `/nutritionist/audit-history/${adminEvent.id}`)).response.status, 404);
  const baseMeal = await prisma.mealLibrary.create({
    data: {
      mealName: 'Synthetic admin meal',
      mealType: 'SNACK',
      description: 'Synthetic fixture recipe.',
      calories: 75,
      proteinG: 6,
      carbsG: 0,
      fatG: 5,
      recipeSignature: 'a'.repeat(64),
      ingredients: {
        create: { ingredientName: 'egg', quantity: 1, unit: 'piece', position: 0, dataSource: 'SOURCE_RECIPE' },
      },
    },
  });
  meals.push(baseMeal.id);
  await MealBaseVerificationService.claim(profile.id, 'LIBRARY_MEAL', baseMeal.id);
  await MealBaseVerificationService.decide(
    profile.id,
    'LIBRARY_MEAL',
    baseMeal.id,
    'VERIFIED',
    'Synthetic recipe verification.'
  );
  const baseEvent = await prisma.auditEvent.findFirstOrThrow({
    where: { entityId: baseMeal.id, action: 'BASE_MEAL_VERIFIED' },
  });
  const baseDetail = await AuditDetailsService.detail(baseEvent.id, 'admin');
  assert.equal(baseDetail.food?.ingredients[0].quantity, 1);
  assert.equal(baseDetail.effective?.carbsG, 0);
  assert.equal(baseDetail.reason, 'Synthetic recipe verification.');
  await prisma.mealLibrary.update({ where: { id: baseMeal.id }, data: { mealName: 'Later recipe name' } });
  assert.equal((await AuditDetailsService.detail(baseEvent.id, 'admin')).food?.name, 'Synthetic admin meal');
  assert.equal((await AuditDetailsService.detail(baseEvent.id, 'admin')).record.subject, 'Synthetic admin meal');
  await prisma.nutritionistProfile.update({
    where: { id: profile.id },
    data: { prcLicenseExpiry: new Date('2020-01-01') },
  });
  assert.equal((await read(reviewer, `/nutritionist/audit-history/${event.id}`)).response.status, 403);
  await prisma.nutritionistProfile.update({ where: { id: profile.id }, data: { isVerified: false } });
  assert.equal((await read(reviewer, `/nutritionist/audit-history/${event.id}`)).response.status, 403);
  await prisma.user.update({ where: { id: admin.id }, data: { role: 'USER' } });
  assert.equal((await read(admin, path)).response.status, 403);
  console.log(
    JSON.stringify({
      result: 'passed',
      reviewSnapshot: true,
      nutritionChanges: true,
      twoMemberPrivacy: true,
      mineFilter: true,
      liveRoleAndCredentials: true,
      retainedAfterDeletion: true,
      noAutoPublication: true,
    })
  );
}
main()
  .finally(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.auditEvent.deleteMany({ where: { OR: [{ actorUserId: { in: ids } }, { entityId: run }] } });
    await prisma.mealLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.mealLibrary.deleteMany({ where: { id: { in: meals } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
