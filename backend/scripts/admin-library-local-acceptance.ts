import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';
import { flagWholeMeal, flagWholeMealAsAdmin, releaseWholeMeal } from '../src/services/meal-wide-flag.service';
import { AdminService } from '../src/services/admin.service';
import { NutritionistService } from '../src/services/nutritionist.service';
import { NutritionistAuditService } from '../src/services/nutritionist-audit.service';

const target = new URL(process.env.DATABASE_URL || '');
if (target.hostname !== '127.0.0.1' || target.port !== '55474' || target.pathname !== '/admin_library_tests') {
  throw new Error('This acceptance script requires the disposable local admin_library_tests database.');
}
const prefix = `admin-library-${Date.now()}`;
const userIds: string[] = [];
const mealIds: string[] = [];
async function run() {
  const createUser = async (kind: 'ADMIN' | 'USER' | 'NUTRITIONIST') => {
    const user = await prisma.user.create({
      data: {
        name: `Synthetic ${kind}`,
        email: `${prefix}-${kind}@example.invalid`,
        passwordHash: 'synthetic-unusable-hash',
        role: kind,
        emailVerified: true,
      },
    });
    userIds.push(user.id);
    return user;
  };
  const admin = await createUser('ADMIN');
  const member = await createUser('USER');
  const reviewer = await createUser('NUTRITIONIST');
  const rnd = await prisma.nutritionistProfile.create({
    data: { userId: reviewer.id, prcLicenseNumber: prefix, prcLicenseExpiry: new Date('2099-01-01'), isVerified: true },
  });
  const base = await prisma.mealLibrary.create({
    data: { mealName: 'Synthetic shared meal', mealType: 'LUNCH', calories: 500, proteinG: 30, carbsG: 60, fatG: 15 },
  });
  mealIds.push(base.id);
  const portion = await prisma.mealLibrary.create({
    data: {
      mealName: 'Synthetic shared portion',
      recipeFamilyId: base.id,
      parentMealId: base.id,
      mealType: 'LUNCH',
      calories: 400,
      proteinG: 24,
      carbsG: 48,
      fatG: 12,
    },
  });
  mealIds.push(portion.id);
  const start = new Date('2090-01-01');
  const cycle = await prisma.mealPlanCycle.create({
    data: {
      id: prefix,
      userId: member.id,
      planType: 'WEEKLY',
      startDate: start,
      endDate: new Date('2090-01-07'),
      preparationOpensAt: start,
      shoppingDeadlineAt: start,
      expectedSlotCount: 1,
    },
  });
  const plan = await prisma.mealPlan.create({
    data: {
      userId: member.id,
      planGroupId: cycle.id,
      libraryMealId: portion.id,
      mealName: portion.mealName,
      mealType: 'LUNCH',
      calories: 400,
      proteinG: 24,
      carbsG: 48,
      fatG: 12,
      scheduledDate: start,
      status: 'APPROVED',
      requiresSafetyRevalidation: false,
    },
  });
  const grocery = await prisma.groceryList.create({
    data: { userId: member.id, planGroupId: cycle.id, weekLabel: prefix },
  });
  await assert.rejects(flagWholeMealAsAdmin(member.id, base.id, 'Member cannot flag the shared library.'));
  assert.equal(await prisma.mealLibraryFlag.count(), 0);
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION admin_library_fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic audit failure'; END $$`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER admin_library_fixture_fail BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION admin_library_fixture_fail()`
  );
  try {
    await assert.rejects(flagWholeMealAsAdmin(admin.id, base.id, 'Synthetic audit rollback check.'));
    assert.equal(await prisma.mealLibrary.count({ where: { id: { in: mealIds }, status: 'APPROVED' } }), 2);
    assert.equal(await prisma.mealLibraryFlag.count(), 0);
    assert.equal(
      (await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).requiresSafetyRevalidation,
      false
    );
    assert.equal(await prisma.notification.count(), 0);
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER admin_library_fixture_fail ON "AuditEvent"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION admin_library_fixture_fail()`);
  }
  const flagged = await flagWholeMealAsAdmin(admin.id, base.id, 'Synthetic ingredient evidence concern.');
  assert.equal(flagged.affectedVariants, 2);
  assert.equal(flagged.affectedUsers, 1);
  assert.equal(await prisma.mealLibrary.count({ where: { id: { in: mealIds }, status: 'FLAGGED' } }), 2);
  assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).requiresSafetyRevalidation, true);
  assert.equal((await prisma.groceryList.findUniqueOrThrow({ where: { id: grocery.id } })).isStale, true);
  const flags = await prisma.mealLibraryFlag.findMany({ where: { mealLibraryId: { in: mealIds } } });
  assert.ok(flags.every((flag) => flag.flaggedByAdminUserId === admin.id && flag.flaggedByNutritionistId === null));
  assert.equal(await prisma.notification.count({ where: { userId: member.id, type: 'MEAL_FLAGGED' } }), 1);
  assert.equal(await prisma.auditEvent.count({ where: { actorUserId: admin.id, action: 'MEAL_BASE_FLAGGED' } }), 1);
  await assert.rejects(flagWholeMealAsAdmin(admin.id, base.id, 'Synthetic repeated flag concern.'), /already flagged/);
  assert.equal(await prisma.mealLibraryFlag.count(), 2);
  const detail = await NutritionistService.getLibraryMeal(base.id);
  assert.equal(detail?.flags[0].flaggedByAdminUser?.name, admin.name);
  const incidents = await AdminService.getSafetyIncidents();
  assert.equal(incidents[0].flaggedByNutritionist, null);
  assert.equal(incidents[0].flaggedByAdminUser?.name, admin.name);
  const history = await NutritionistAuditService.history(1, 20);
  assert.ok(history.rows.some((row) => row.nutritionist === admin.name));
  await assert.rejects(
    prisma.mealLibraryFlag.create({
      data: {
        mealLibraryId: base.id,
        reason: 'Invalid dual actor',
        flaggedByAdminUserId: admin.id,
        flaggedByNutritionistId: rnd.id,
      },
    })
  );
  const released = await releaseWholeMeal(rnd.id, base.id, 'Synthetic independent evidence review.');
  assert.equal(released.releasedVariants, 2);
  assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).requiresSafetyRevalidation, true);
  assert.equal(await prisma.mealLibraryFlag.count({ where: { status: 'RESOLVED_KEPT' } }), 2);
  await flagWholeMeal(rnd.id, base.id, 'Synthetic nutritionist evidence concern.');
  assert.equal(
    await prisma.mealLibraryFlag.count({ where: { flaggedByNutritionistId: rnd.id, flaggedByAdminUserId: null } }),
    2
  );
  console.log(
    JSON.stringify({
      result: 'passed',
      sharedFamilyVariants: 2,
      adminFlags: 2,
      legacyNutritionistFlags: 2,
      memberPlanHeld: true,
      groceryStale: true,
      notifications: 1,
      attributionAndIndependentRelease: true,
    })
  );
}
run()
  .finally(async () => {
    await prisma.mealPlanCycle.deleteMany({ where: { id: prefix } });
    await prisma.mealLibrary.deleteMany({ where: { id: { in: mealIds.slice(1) } } });
    await prisma.mealLibrary.deleteMany({ where: { id: mealIds[0] || 'none' } });
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
