import assert from 'node:assert/strict';
import test from 'node:test';
import { approvalRecheckContext, assertApprovalResolution } from '../src/services/approval-recheck-context.service';
import { mealPlanFlagContext, assertPlanFlagConcernsResolved } from '../src/services/meal-plan-flag-context.service';

const target = { kind: 'PROFILE' as const, mealLibraryId: 'recipe', approvalId: 'approval' };
const actor = { id: 'independent-rnd', userId: 'independent-user' };
function fixture() {
  const meal = { status: 'APPROVED', recipeSignature: 'recipe-v1', safetyEvidenceRevision: 1 };
  const approval = {
    id: 'approval',
    mealLibraryId: 'recipe',
    recipeSignature: 'recipe-v1',
    evidenceRevision: 1,
    flaggedAt: new Date('2026-10-13'),
    flagReason: 'Check the measured sodium evidence.',
    flaggedByNutritionistId: 'flagger',
    reviewerNutritionistId: 'challenged',
    approvedAt: new Date('2026-10-01'),
    reviewDueAt: new Date('2099-01-01'),
  };
  const tx = {
    mealLibrary: { findUnique: async () => meal },
    mealLibraryProfileApproval: { findUnique: async () => approval },
    auditEvent: {
      findFirst: async () => ({
        id: 'flag-event',
        actorUserId: 'flagger-user',
        createdAt: new Date('2026-10-13'),
        metadata: {
          notes: {
            category: 'NUTRITION',
            explanation: approval.flagReason,
            reference: 'Recorded FNRI evidence.',
            proposedCorrection: 'Correct the measured ingredient.',
          },
        },
      }),
    },
  } as any;
  return { tx, meal, approval };
}
test('exact approval version does not depend on command-only fields; changed flags and recipe evidence invalidate it', async () => {
  const { tx, meal, approval } = fixture();
  const opened = await approvalRecheckContext(tx, target);
  const command = {
    ...target,
    expectedVersion: opened.expectedVersion,
    resolved: true,
    rationale: 'Checked every measured quantity and recorded evidence.',
  };
  assert.equal((await approvalRecheckContext(tx, command)).expectedVersion, opened.expectedVersion);
  assertApprovalResolution(opened, command, actor);
  approval.flagReason = 'A newly recorded concern requires further review.';
  assert.throws(() => assertApprovalResolution({ ...opened, expectedVersion: 'changed' }, command, actor));
  assert.notEqual((await approvalRecheckContext(tx, target)).expectedVersion, opened.expectedVersion);
  meal.safetyEvidenceRevision++;
  const changed = await approvalRecheckContext(tx, target);
  assert.equal(changed.matchesCurrentRecipe, false);
  assert.throws(
    () => assertApprovalResolution(changed, { ...command, expectedVersion: changed.expectedVersion }, actor),
    /recipe evidence/
  );
});
test('missing resolution, short text, flagger and challenged reviewer fail before any verification', async () => {
  const opened = await approvalRecheckContext(fixture().tx, target);
  const input = {
    expectedVersion: opened.expectedVersion,
    resolved: true,
    rationale: 'Checked every measured quantity and recorded evidence.',
  };
  assert.throws(() => assertApprovalResolution(opened, { ...input, resolved: false }, actor), /resolved/);
  assert.throws(() => assertApprovalResolution(opened, { ...input, rationale: 'checked' }, actor), /resolved/);
  for (const involved of [
    { id: 'flagger', userId: 'another' },
    { id: 'challenged', userId: 'another' },
    { id: 'another', userId: 'flagger-user' },
  ])
    assert.throws(() => assertApprovalResolution(opened, input, involved), /uninvolved RND/);
  assert.throws(() => assertApprovalResolution({ ...opened, blockedByRecipe: true }, input, actor), /recipe evidence/);
  assert.throws(() => assertApprovalResolution({ ...opened, state: 'ACTIVE' }, input, actor), /no longer/);
});
test('a pending member-case exposes exact scoped flags and the server blocks approval while unresolved', async () => {
  const { tx } = fixture();
  tx.mealPlan = {
    findUnique: async () => ({
      libraryMealId: 'recipe',
      profileApprovalId: 'approval',
      sourceRawRecipeCandidateId: null,
      clearanceUsages: [],
    }),
  };
  tx.mealReviewLineage = { findFirst: async () => null };
  const concerns = await mealPlanFlagContext(tx, 'plan');
  assert.equal(concerns[0].notes.explanation, 'Check the measured sodium evidence.');
  assert.equal(concerns[0].active, true);
  assert.equal(concerns[0].kind, 'PROFILE');
  await assert.rejects(assertPlanFlagConcernsResolved(tx, 'plan'), /Resolve the linked/);
});
