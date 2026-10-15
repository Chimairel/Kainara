import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/lib/prisma';
import { MealBaseVerificationService } from '../src/services/meal-base-verification.service';
import { MealVerificationWorkspaceService } from '../src/services/meal-verification-workspace.service';

test('one recipe queue includes flags, pins own claims, and excludes quarantine in the database query', async () => {
  const originalList = MealBaseVerificationService.list, originalFind = prisma.mealReviewLineage.findMany;
  MealBaseVerificationService.list = (async () => [{ id: 'new', kind: 'RAW_RECIPE', claimedByMe: false }]) as never;
  prisma.mealReviewLineage.findMany = (async (args: any) => {
    assert.equal(args.where.state, 'PENDING_REREVIEW');
    assert.equal(args.where.meals.some.status, 'FLAGGED');
    return ['mine', 'involved', 'other'].map((id) => ({ meals: [{ id, mealName: id }], incidents: [{
      id: `incident-${id}`, number: 1, excludedReviewerIds: id === 'involved' ? ['rnd'] : [],
      reports: [], claimedByNutritionistId: id === 'mine' ? 'rnd' : 'other-rnd', claimedAt: new Date(),
    }] }));
  }) as never;
  try {
    const rows = await MealVerificationWorkspaceService.list('rnd');
    assert.equal(rows.length, 4);
    assert.equal(rows[0].id, 'mine');
    assert.equal(rows[0].claimedByMe, true);
    const involved = rows.find(row => row.id === 'involved');
    assert.ok(involved?.kind === 'FLAGGED_RECIPE');
    assert.equal(involved.reviewerInvolved, true);
    assert.equal(rows.find(row => row.id === 'other')?.claimedByOther, true);
    assert.equal(rows.find(row => row.id === 'new')?.kind, 'RAW_RECIPE');
  } finally { MealBaseVerificationService.list = originalList; prisma.mealReviewLineage.findMany = originalFind; }
});
