import assert from 'node:assert/strict';
import test from 'node:test';
import { MealPlanCycleDeadlineOutcome, MealPlanCycleStatus, ProfileCycleAdaptationState } from '@prisma/client';
import { deriveGroceryActionability } from '../src/domain/grocery-actionability.policy';

const base = {
  profileAdaptationState: ProfileCycleAdaptationState.CURRENT,
  deadlineOutcome: null,
  incompleteAcknowledgedAt: null,
  shoppingStartedAt: null,
  listIsStale: false,
};

test('preparing and under-review groceries allow checklist marks without final export', () => {
  for (const status of [MealPlanCycleStatus.PREPARING, MealPlanCycleStatus.UNDER_REVIEW]) {
    const result = deriveGroceryActionability({ ...base, status });
    assert.equal(result.canCheckItems, true);
    assert.equal(result.canExportPdf, false);
    assert.equal(result.quantitiesMayIncrease, true);
    assert.equal(result.isFinal, false);
  }
});

test('[BATCH-5] complete ready and shopping-started cycles are final and actionable', () => {
  for (const status of [MealPlanCycleStatus.READY_TO_SHOP, MealPlanCycleStatus.SHOPPING_STARTED]) {
    const result = deriveGroceryActionability({ ...base, status });
    assert.equal(result.canCheckItems, true);
    assert.equal(result.canExportPdf, true);
    assert.equal(result.isFinal, true);
  }
});

test('[BATCH-5] incomplete lists require acknowledgment and export as incomplete afterward', () => {
  const incomplete = {
    ...base,
    status: MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE,
    deadlineOutcome: MealPlanCycleDeadlineOutcome.INCOMPLETE,
    unresolvedSlotCount: 2,
  };
  const before = deriveGroceryActionability(incomplete);
  assert.equal(before.requiresIncompleteAcknowledgment, true);
  assert.equal(before.canCheckItems, false);

  const after = deriveGroceryActionability({ ...incomplete, incompleteAcknowledgedAt: new Date() });
  assert.equal(after.canCheckItems, true);
  assert.equal(after.canExportPdf, true);
  assert.equal(after.isIncomplete, true);
  assert.equal(after.quantitiesMayIncrease, false);
});

test('a missed deadline no longer blocks an unfrozen list once every slot clears', () => {
  for (const status of [MealPlanCycleStatus.ACTIVE, MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE]) {
    const complete = deriveGroceryActionability({
      ...base,
      status,
      deadlineOutcome: MealPlanCycleDeadlineOutcome.INCOMPLETE,
      unresolvedSlotCount: 0,
    });
    assert.equal(complete.requiresIncompleteAcknowledgment, false);
    assert.equal(complete.canCheckItems, true);
    assert.equal(complete.canExportPdf, true);
    assert.equal(complete.isIncomplete, false);
  }

  const frozenPartial = deriveGroceryActionability({
    ...base,
    status: MealPlanCycleStatus.ACTIVE,
    deadlineOutcome: MealPlanCycleDeadlineOutcome.INCOMPLETE,
    incompleteAcknowledgedAt: new Date(),
    unresolvedSlotCount: 0,
  });
  assert.equal(frozenPartial.isIncomplete, true);
});

test('[BATCH-5] stale or revalidation-required projections fail closed', () => {
  const stale = deriveGroceryActionability({
    ...base,
    status: MealPlanCycleStatus.READY_TO_SHOP,
    listIsStale: true,
  });
  assert.equal(stale.canCheckItems, false);
  assert.equal(stale.canExportPdf, false);

  const revalidation = deriveGroceryActionability({
    ...base,
    status: MealPlanCycleStatus.REVALIDATION_REQUIRED,
  });
  assert.equal(revalidation.canCheckItems, false);
  assert.equal(revalidation.canExportPdf, false);
});
