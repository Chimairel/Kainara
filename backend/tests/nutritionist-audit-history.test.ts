import assert from 'node:assert/strict';
import test from 'node:test';
import type prisma from '../src/lib/prisma';
import { NutritionistAuditService } from '../src/services/nutritionist-audit.service';

test('audit history merges older verification actors and meal flags without exposing metadata', async () => {
  const events = [
    { id: 'verification', createdAt: new Date('2026-09-29T12:00:00Z'),
      action: 'BASE_MEAL_VERIFIED', entityType: 'LIBRARY_MEAL', entityId: 'meal-1', actorUser: null,
      metadata: { reviewerProfileId: 'old-rnd', patientNotes: 'private clinical note' } },
    { id: 'profile', createdAt: new Date('2026-09-27T12:00:00Z'),
      action: 'CLINICAL_PROFILE_REVIEWED', entityType: 'ClinicalProfileReview', entityId: 'review-1',
      actorUser: { name: 'Second Nutritionist' }, metadata: { diagnosis: 'private diagnosis' } },
  ];
  const flags = [{ id: 'flag-1', createdAt: new Date('2026-09-28T12:00:00Z'),
    mealLibrary: { mealName: 'Basilog' }, flaggedByNutritionist: { user: { name: 'Flagging Nutritionist' } } }];
  let eventWhere: Record<string, unknown> | undefined;
  const db = {
    auditEvent: {
      findMany: async ({ take, where }: { take: number; where: Record<string, unknown> }) => {
        eventWhere = where;
        return events.slice(0, take);
      },
      count: async () => events.length,
    },
    mealLibraryFlag: { findMany: async ({ take }: { take: number }) => flags.slice(0, take),
      count: async () => flags.length },
    nutritionistProfile: { findMany: async () => [{ id: 'old-rnd', user: { name: 'Original Nutritionist' } }] },
    mealLibrary: { findMany: async () => [{ id: 'meal-1', mealName: 'Adobo' }] },
    mealPlan: { findMany: async () => [] },
    rawRecipeCandidate: { findMany: async () => [] },
  } as unknown as typeof prisma;

  const first = await NutritionistAuditService.history(1, 2, db);
  assert.equal(first.total, 3);
  assert.deepEqual(first.rows.map((row) => row.nutritionist), ['Original Nutritionist', 'Flagging Nutritionist']);
  assert.deepEqual(first.rows.map((row) => row.subject), ['Adobo', 'Basilog']);
  assert.equal(first.totalPages, 2);
  assert.ok(!JSON.stringify(first).includes('private clinical note'));
  assert.ok(!JSON.stringify(first).includes('private diagnosis'));
  assert.ok(!JSON.stringify(eventWhere).includes('MEAL_LIBRARY_FLAGGED'));
  assert.ok(!JSON.stringify(eventWhere).includes('ACCOUNT_'));

  const second = await NutritionistAuditService.history(2, 2, db);
  assert.equal(second.rows.length, 1);
  assert.equal(second.rows[0].nutritionist, 'Second Nutritionist');
  assert.equal(second.rows[0].subject, 'Health profile');
});
