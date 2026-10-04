import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';
import { StaffAuditService } from '../src/services/staff-audit.service';
import { NutritionistAuditService } from '../src/services/nutritionist-audit.service';
import { AdminService } from '../src/services/admin.service';
import { flagWholeMealAsAdmin, releaseWholeMeal } from '../src/services/meal-wide-flag.service';

const target = new URL(process.env.DATABASE_URL || '');
if (target.hostname !== '127.0.0.1' || target.port !== '55475' || target.pathname !== '/audit_history_tests')
  throw new Error('Requires the disposable local audit_history_tests database.');
const prefix = `staff-audit-${Date.now()}`;
const users: string[] = [];
const meals: string[] = [];
const events: string[] = [];
async function run() {
  assert.equal(await prisma.auditEvent.count(), 0);
  const user = async (role: 'ADMIN' | 'NUTRITIONIST' | 'USER', label: string) => {
    const row = await prisma.user.create({
      data: {
        name: label,
        email: `${prefix}-${label.replace(/ /g, '-')}@example.invalid`,
        role,
        passwordHash: 'unusable-fixture',
        emailVerified: true,
      },
    });
    users.push(row.id);
    return row;
  };
  const admin = await user('ADMIN', 'Synthetic Admin');
  const reviewer = await user('NUTRITIONIST', 'Synthetic Reviewer');
  const member = await user('USER', 'Private Member');
  const profile = await prisma.nutritionistProfile.create({
    data: { userId: reviewer.id, prcLicenseNumber: prefix, prcLicenseExpiry: new Date('2099-01-01'), isVerified: true },
  });
  const record = async (actorUserId: string, action: string, createdAt: Date, entityId = prefix) => {
    const row = await prisma.auditEvent.create({
      data: {
        actorUserId,
        action,
        entityType: 'ClinicalProfileReview',
        entityId,
        createdAt,
        metadata: { diagnosis: 'PRIVATE_DIAGNOSIS', answers: 'PRIVATE_ANSWERS' },
      },
    });
    events.push(row.id);
    return row;
  };
  const start = new Date('2026-10-03T16:00:00Z');
  const first = await record(reviewer.id, 'CLINICAL_PROFILE_REVIEWED', start);
  assert.equal(first.actorRole, 'NUTRITIONIST');
  assert.equal(first.actorName, reviewer.name);
  await prisma.auditEvent.update({ where: { id: first.id }, data: { actorName: 'Spoofed', actorRole: 'ADMIN' } });
  await prisma.user.update({ where: { id: reviewer.id }, data: { role: 'USER', name: 'Renamed Member' } });
  let history = await StaffAuditService.history({ view: 'nutritionist' });
  assert.equal(history.rows[0].actor, reviewer.name);
  assert.equal(history.rows[0].role, 'NUTRITIONIST');
  const privateEvent = await record(member.id, 'HEALTH_DETAILS_UPDATED', start);
  assert.equal(privateEvent.actorName, null);
  assert.equal(privateEvent.actorRole, 'USER');
  assert.ok(!JSON.stringify(history).includes('PRIVATE_'));
  assert.ok(!JSON.stringify(history).includes(member.name));

  // Simulate pre-migration events only in this guarded disposable database.
  await prisma.$executeRawUnsafe('ALTER TABLE "AuditEvent" DISABLE TRIGGER audit_actor_snapshot');
  try {
    const old = await record(reviewer.id, 'BASE_MEAL_VERIFIED', start);
    assert.equal(old.actorRole, null);
    const legacy = await prisma.auditEvent.create({
      data: {
        action: 'BASE_MEAL_VERIFIED',
        entityType: 'LIBRARY_MEAL',
        entityId: prefix,
        metadata: { reviewerProfileId: profile.id },
      },
    });
    events.push(legacy.id);
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "AuditEvent" ENABLE TRIGGER audit_actor_snapshot');
  }
  history = await StaffAuditService.history({ view: 'nutritionist', actorId: reviewer.id });
  assert.equal(history.total, 3);
  assert.ok(history.rows.some((row) => row.actor === 'Renamed Member'));
  await prisma.user.update({ where: { id: reviewer.id }, data: { role: 'NUTRITIONIST' } });

  for (let i = 0; i < 25; i++) await record(admin.id, 'WEBSITE_MEDIA_PUBLISHED', start, `${prefix}-${i}`);
  await record(admin.id, 'USER_SUSPENDED', new Date('2026-10-04T15:59:59Z'));
  await record(admin.id, 'USER_REINSTATED', new Date('2026-10-04T16:00:00Z'));
  const day = await StaffAuditService.history({ view: 'admin', from: '2026-10-04', to: '2026-10-04' });
  assert.equal(day.total, 26);
  const second = await StaffAuditService.history({ view: 'admin', page: 2, from: '2026-10-04', to: '2026-10-04' });
  assert.equal(second.rows.length, 6);
  assert.ok(!second.rows.some((row) => day.rows.some((firstRow) => firstRow.id === row.id)));
  assert.equal((await StaffAuditService.history({ view: 'admin', action: 'PUBLISHED' })).total, 25);
  assert.equal((await StaffAuditService.history({ view: 'admin', actor: "%' OR true --" })).total, 0);
  assert.equal((await StaffAuditService.history({ view: 'admin', actorId: reviewer.id })).total, 0);
  assert.equal((await StaffAuditService.history({ view: 'admin', relatedTo: privateEvent.id })).total, 0);

  const base = await prisma.mealLibrary.create({
    data: { mealName: 'Synthetic audit meal', mealType: 'LUNCH', calories: 500, proteinG: 30, carbsG: 60, fatG: 15 },
  });
  meals.push(base.id);
  const portion = await prisma.mealLibrary.create({
    data: {
      mealName: 'Synthetic audit serving',
      recipeFamilyId: base.id,
      parentMealId: base.id,
      mealType: 'LUNCH',
      calories: 400,
      proteinG: 24,
      carbsG: 48,
      fatG: 12,
    },
  });
  meals.push(portion.id);
  await flagWholeMealAsAdmin(admin.id, base.id, 'Synthetic ingredient concern for the audit.');
  const flags = await StaffAuditService.history({ view: 'admin', action: 'MEAL_BASE_FLAGGED' });
  assert.equal(flags.total, 1);
  assert.equal(await prisma.mealLibraryFlag.count(), 2);
  await releaseWholeMeal(profile.id, portion.id, 'Synthetic independent review of the meal.');
  const related = await StaffAuditService.history({ view: 'admin', relatedTo: flags.rows[0].id });
  assert.equal(related.total, 2);
  assert.deepEqual(new Set(related.rows.map((row) => row.role)), new Set(['ADMIN', 'NUTRITIONIST']));
  assert.ok(related.rows.every((row) => row.subject === base.mealName));
  const rndHistory = await NutritionistAuditService.history(1, 20);
  assert.equal(rndHistory.rows.filter((row) => row.actionCode === 'MEAL_BASE_FLAGGED').length, 1);
  const oldDate = new Date('2026-09-01');
  await prisma.mealLibraryFlag.createMany({
    data: meals.map((id) => ({
      mealLibraryId: id,
      flaggedByNutritionistId: profile.id,
      createdAt: oldDate,
      reason: 'Legacy whole family concern',
    })),
  });
  assert.equal((await StaffAuditService.history({ view: 'nutritionist', action: 'FLAGGED' })).total, 1);

  const applicant = await user('USER', 'Synthetic Applicant');
  const applicantProfile = await prisma.nutritionistProfile.create({
    data: { userId: applicant.id, prcLicenseNumber: `${prefix}-applicant`, prcLicenseExpiry: new Date('2099-01-01') },
  });
  await prisma.$executeRawUnsafe(
    "CREATE FUNCTION audit_fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'NUTRITIONIST_VERIFIED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$"
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER audit_fixture_fail BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION audit_fixture_fail()'
  );
  try {
    await assert.rejects(AdminService.verifyNutritionist(admin.id, applicantProfile.id));
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: applicant.id } })).role, 'USER');
    assert.equal(
      (await prisma.nutritionistProfile.findUniqueOrThrow({ where: { id: applicantProfile.id } })).isVerified,
      false
    );
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER audit_fixture_fail ON "AuditEvent"');
    await prisma.$executeRawUnsafe('DROP FUNCTION audit_fixture_fail()');
  }
  await AdminService.verifyNutritionist(admin.id, applicantProfile.id);
  assert.equal((await StaffAuditService.history({ view: 'admin', action: 'NUTRITIONIST_VERIFIED' })).total, 1);
  const former = await user('NUTRITIONIST', 'Deleted Staff');
  const formerEvent = await record(former.id, 'CLINICAL_PROFILE_REVIEWED', start);
  await prisma.user.delete({ where: { id: former.id } });
  const retained = await prisma.auditEvent.findUniqueOrThrow({ where: { id: formerEvent.id } });
  assert.equal(retained.actorUserId, null);
  assert.equal(retained.actorName, 'Deleted Staff');
  assert.equal((await StaffAuditService.history({ view: 'nutritionist', actor: 'Deleted Staff' })).total, 1);
  console.log(
    JSON.stringify({
      result: 'passed',
      snapshots: true,
      revokedAndDeletedStaff: true,
      legacyAttribution: true,
      familyDeduplication: true,
      relatedTimeline: true,
      paginationAndManilaDates: true,
      privateDataExcluded: true,
      verificationRollback: true,
    })
  );
}
run()
  .finally(async () => {
    await prisma.mealLibrary.deleteMany({ where: { id: { in: meals.slice(1) } } });
    await prisma.mealLibrary.deleteMany({ where: { id: meals[0] || 'none' } });
    await prisma.auditEvent.deleteMany({ where: { OR: [{ id: { in: events } }, { actorUserId: { in: users } }] } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
