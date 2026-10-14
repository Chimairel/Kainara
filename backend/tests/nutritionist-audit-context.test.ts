import assert from 'node:assert/strict';
import test from 'node:test';
import type prisma from '../src/lib/prisma';
import { NutritionistAuditContextService } from '../src/services/nutritionist-audit-context.service';
import { auditTypeLabel } from '../src/domain/audit-history.policy';
import { flagCaseApproval } from '../src/services/case-approval-flag.service';

function fixture(reviewerId = 'rnd', linked = true, eligible = true) {
  const writes: unknown[] = [];
  const event = { id: 'audit', entityType: 'MealPlan', entityId: 'plan', action: 'MEAL_PLAN_APPROVED', metadata: linked ? { reviewDecisionId: 'saved' } : {} };
  const decision = { id: 'saved', mealPlanId: 'plan', mealPlan: { id: 'plan', status: 'APPROVED', requiresSafetyRevalidation: false, reviewDecisions: [{ id: 'saved' }] }, nutritionistProfileId: 'rnd', decision: 'APPROVE', rationale: 'PRIVATE_NOTE', evidenceSnapshot: {
    mealName: 'Bam-I Recipe', original: { mealName: 'Bam-I Recipe', calories: 912, ingredients: [] },
    recordedProfile: { weightKg: 57 }, healthDetails: 'PRIVATE_ANSWERS', clinicalDocuments: ['PRIVATE_DOC'],
    reviewContext: { profile: { weightKg: 57 }, clinical: 'PRIVATE_CLINICAL' },
  } };
  const tx = {
    user: { findUnique: async () => ({ id: 'actor', role: 'NUTRITIONIST', isSuspended: false, name: 'Reviewer' }) },
    nutritionistProfile: { findFirst: async () => ({ id: reviewerId, userId: 'actor', isVerified: eligible, prcLicenseNumber: '123', prcLicenseExpiry: new Date('2099-01-01'), user: { emailVerified: true, role: 'NUTRITIONIST', isSuspended: false } }) },
    auditEvent: { findFirst: async () => null, findUnique: async () => event, create: async (value: unknown) => writes.push(value) },
    mealPlanReviewDecision: { findUnique: async () => decision, findMany: async () => [decision] },
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
test('owner-authorized eligible RND sees the immutable saved clinical context without current profile or original file access', async () => {
  const f = fixture('other');
  const result = await NutritionistAuditContextService.detail('actor', 'other', 'audit', f.db);
  assert.deepEqual(result.reviewedSnapshot, f.decision.evidenceSnapshot);
  assert.match(JSON.stringify(result.decisions), /912/);
  assert.equal(result.currentProfile, null);
  assert.deepEqual(result.clinicalEvidence, []);
  assert.equal(result.historicalInformation, null);
  assert.equal(f.writes.length, 1);
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
  assert.equal(auditTypeLabel('MEAL_APPROVAL_FLAGGED', 'MealPlanReviewDecision'), 'Meal approval');
  assert.equal(auditTypeLabel('MEAL_CASE_FLAG_RESOLVED', 'MealPlanReviewDecision'), 'Meal approval');
});

test('disabled clinical rollout never permits an approval flag with unenforced resolution guards', async () => {
  const f = fixture();
  const result = await NutritionistAuditContextService.detail('actor', 'rnd', 'audit', f.db);
  assert.equal((result.approvalFlag as { canFlag: boolean }).canFlag, false);
  await assert.rejects(flagCaseApproval('actor', 'rnd', 'saved', { expectedVersion: 'a'.repeat(64), notes: {
    category: 'NUTRITION', affectedFields: ['sodium'], explanation: 'A measured sodium concern needs review.',
    reference: 'Saved measured evidence.', proposedCorrection: 'Verify the sodium amounts.',
  } }, f.db), { statusCode: 503 });
  assert.equal(f.writes.length, 1); // Access record only, no flag mutation.
});
