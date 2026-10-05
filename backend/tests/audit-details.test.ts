import assert from 'node:assert/strict';
import test from 'node:test';
import type prisma from '../src/lib/prisma';
import { AuditDetailsService } from '../src/services/audit-details.service';
import { auditFood } from '../src/domain/audit-details.policy';

const record = {
  id: 'event',
  actor: 'Reviewer',
  role: 'NUTRITIONIST',
  actionCode: 'OUTSIDE_MEAL_CORRECT',
  subject: 'Outside food log',
};
function fixture(metadata: unknown, snapshot: unknown = null, visible = true) {
  let revisions = 0;
  const db = {
    $queryRaw: async (query: { values: unknown[] }) => {
      assert.ok(query.values.includes('event'));
      return [{ total: visible ? 1n : 0n, rows: visible ? [record] : [] }];
    },
    auditEvent: {
      findUnique: async () => ({
        action: 'OUTSIDE_MEAL_CORRECT',
        entityType: 'OutsideMealLogItem',
        entityId: 'food',
        metadata,
      }),
    },
    outsideMealItemRevision: {
      findUnique: async (query: unknown) => {
        revisions++;
        assert.deepEqual(query, {
          where: { outsideMealLogItemId_revision: { outsideMealLogItemId: 'food', revision: 2 } },
          select: { snapshot: true },
        });
        return snapshot ? { snapshot } : null;
      },
    },
  };
  return { db: db as unknown as typeof prisma, revisions: () => revisions };
}
const values = { calories: 85, proteinG: 6, carbsG: 0, fatG: null };
test('food detail uses immutable event snapshot, preserves zero/unknown, and excludes private fields', async () => {
  const f = fixture({
    revision: 2,
    reviewedRevision: 1,
    previous: values,
    effective: values,
    reason: 'Corrected portion.',
    food: {
      name: 'Egg',
      portionGrams: 50,
      ingredients: ['egg', { name: 'oil', quantity: 0, unit: 'g', userId: 'PRIVATE' }],
      source: 'NUTRITIONIST_REVIEWED',
      nutritionStatus: 'CORRECTED',
      imageUrl: 'PRIVATE',
      userId: 'PRIVATE',
    },
    notes: 'PRIVATE',
    answers: 'PRIVATE',
    scopeKey: 'PRIVATE',
    email: 'PRIVATE',
  });
  const detail = await AuditDetailsService.detail('event', 'admin', f.db);
  assert.equal(detail.food?.name, 'Egg');
  assert.equal(detail.effective?.carbsG, 0);
  assert.equal(detail.effective?.fatG, null);
  assert.equal(detail.reason, 'Corrected portion.');
  assert.equal(f.revisions(), 0);
  assert.ok(!JSON.stringify(detail).includes('PRIVATE'));
});
test('legacy food detail reads only the revision on the selected event', async () => {
  const f = fixture(
    { revision: 2, previous: values, effective: values },
    { name: 'Original name', ingredients: ['egg'] }
  );
  const detail = await AuditDetailsService.detail('event', 'nutritionist', f.db);
  assert.equal(f.revisions(), 1);
  assert.equal(detail.food?.name, 'Original name');
});
test('missing historical food never falls back to mutable current data', async () => {
  const f = fixture({ revision: 2, previous: values, effective: values });
  const detail = await AuditDetailsService.detail('event', 'admin', f.db);
  assert.equal(detail.food, null);
  assert.equal(detail.effective?.calories, 85);
});
test('invisible events fail before loading their metadata', async () => {
  const f = fixture({}, null, false);
  f.db.auditEvent.findUnique = (() => {
    throw new Error('Private metadata must not be read');
  }) as typeof f.db.auditEvent.findUnique;
  await assert.rejects(AuditDetailsService.detail('event', 'nutritionist', f.db), { statusCode: 404 });
});
test('clinical notes and account reasons are not exposed as review rationale', async () => {
  const f = fixture({ decision: 'CONFIRMED', revision: 0, reason: 'PRIVATE', notes: 'PRIVATE', scopeKey: 'PRIVATE' });
  f.db.auditEvent.findUnique = (async () => ({
    action: 'CLINICAL_PROFILE_REVIEWED',
    entityType: 'ClinicalProfileReview',
    metadata: { decision: 'CONFIRMED', profileRevision: 0, notes: 'PRIVATE', reason: 'PRIVATE' },
  })) as unknown as typeof f.db.auditEvent.findUnique;
  const detail = await AuditDetailsService.detail('event', 'admin', f.db);
  assert.equal(detail.reason, null);
  assert.deepEqual(detail.facts, [
    { label: 'Profile revision', value: '0' },
    { label: 'Decision', value: 'CONFIRMED' },
  ]);
  assert.ok(!JSON.stringify(detail).includes('PRIVATE'));
});
test('legacy flags expose the stored food flag reason', async () => {
  const db = {
    $queryRaw: async () => [{ total: 1n, rows: [{ ...record, id: 'flag:old', actionCode: 'MEAL_BASE_FLAGGED' }] }],
    mealLibraryFlag: { findUnique: async () => ({ reason: 'Incorrect ingredient listing.' }) },
  } as unknown as typeof prisma;
  assert.equal((await AuditDetailsService.detail('flag:old', 'admin', db)).reason, 'Incorrect ingredient listing.');
});
test('food projection bounds free text and ingredient lists and strips arbitrary keys', () => {
  const food = auditFood({
    name: 'x'.repeat(2000),
    ingredients: Array(120).fill({ name: 'egg', quantity: NaN, unit: 'g', notes: 'PRIVATE' }),
  });
  assert.equal(food.name?.length, 1000);
  assert.equal(food.ingredients.length, 100);
  assert.equal(food.ingredients[0].quantity, null);
  assert.ok(!JSON.stringify(food).includes('PRIVATE'));
});
