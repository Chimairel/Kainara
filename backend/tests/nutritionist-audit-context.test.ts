import assert from 'node:assert/strict';
import test from 'node:test';
import type prisma from '../src/lib/prisma';
import { NutritionistAuditContextService } from '../src/services/nutritionist-audit-context.service';
import { auditTypeLabel } from '../src/domain/audit-history.policy';

function fixture(reviewerId = 'rnd', linked = true, eligible = true) {
  const writes: unknown[] = [];
  const event = { id: 'audit', entityType: 'MealPlan', entityId: 'plan', action: 'MEAL_PLAN_APPROVED', metadata: linked ? { reviewDecisionId: 'saved' } : {} };
  const decision = { id: 'saved', nutritionistProfileId: 'rnd', decision: 'APPROVE', rationale: 'PRIVATE_NOTE', evidenceSnapshot: {
    mealName: 'Bam-I Recipe', original: { mealName: 'Bam-I Recipe', calories: 912, ingredients: [] },
    recordedProfile: { weightKg: 57 }, healthDetails: 'PRIVATE_ANSWERS', clinicalDocuments: ['PRIVATE_DOC'],
    reviewContext: { profile: { weightKg: 57 }, clinical: 'PRIVATE_CLINICAL' },
  } };
  const tx = {
    user: { findUnique: async () => ({ id: 'actor', role: 'NUTRITIONIST', isSuspended: false, name: 'Reviewer' }) },
    nutritionistProfile: { findUnique: async () => ({ id: reviewerId, userId: 'actor', isVerified: eligible, prcLicenseNumber: '123', prcLicenseExpiry: new Date('2099-01-01'), user: { emailVerified: true, role: 'NUTRITIONIST', isSuspended: false } }) },
    auditEvent: { findUnique: async () => event, create: async (value: unknown) => writes.push(value) },
    mealPlanReviewDecision: { findMany: async () => [decision] },
  };
  const db = { ...tx, $queryRaw: async () => [{ total: 1n, rows: [{ id: 'audit', role: 'NUTRITIONIST', actionCode: 'MEAL_PLAN_APPROVED' }] }],
    $transaction: async (run: (client: typeof tx) => unknown) => run(tx) } as unknown as typeof prisma;
  return { db, writes, decision };
}
test('original RND sees exact saved context without reading the live member or files', async () => {
  const f = fixture();
  const result = await NutritionistAuditContextService.detail('actor', 'rnd', 'audit', f.db);
  assert.deepEqual(result.reviewedSnapshot, f.decision.evidenceSnapshot);
  assert.equal(result.selectedDecisionId, 'saved');
  assert.equal(result.currentProfile, null);
  assert.deepEqual(result.clinicalEvidence, []);
  assert.equal(f.writes.length, 1);
});
test('other eligible RND sees recorded meal but no private notes, profile, answers or documents', async () => {
  const f = fixture('other');
  const result = await NutritionistAuditContextService.detail('actor', 'other', 'audit', f.db);
  assert.equal(result.reviewedSnapshot, null);
  assert.match(JSON.stringify(result.decisions), /912/);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|weightKg/);
  assert.match(result.historicalInformation!, /private member context remains restricted/);
});
test('missing old decision link remains explicit and expired or unverified reviewer is blocked', async () => {
  const f = fixture('rnd', false);
  const result = await NutritionistAuditContextService.detail('actor', 'rnd', 'audit', f.db);
  assert.equal(result.reviewedSnapshot, null);
  assert.equal(result.selectedDecisionId, null);
  assert.match(result.historicalInformation!, /no exact decision link/);
  const blocked = fixture('rnd', true, false);
  await assert.rejects(NutritionistAuditContextService.detail('actor', 'rnd', 'audit', blocked.db), { statusCode: 403 });
  assert.equal(blocked.writes.length, 0);
});
test('audit type separates member approvals from base verification and reusable approvals', () => {
  assert.equal(auditTypeLabel('MEAL_PLAN_APPROVED', 'MealPlan'), 'Meal approval');
  assert.equal(auditTypeLabel('BASE_MEAL_VERIFIED', 'MealLibrary'), 'Meal verification');
  assert.equal(auditTypeLabel('CLINICAL_PROFILE_REVIEWED', 'ClinicalProfileReview'), 'Profile verification');
  assert.equal(auditTypeLabel('MEAL_APPROVAL_RECHECKED', 'MealLibraryProfileApproval'), 'Reusable approval');
});
