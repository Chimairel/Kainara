import assert from 'node:assert/strict';
import { harness } from './helpers/system-audit-harness';
import prisma from '../src/lib/prisma';
import { AppError } from '../src/errors/AppError';
import { MembershipService } from '../src/services/membership.service';
import { MealGenerationService } from '../src/services/meal-generation.service';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';

async function main() {
  const h = await harness('6-api');
  try {
    const a = await h.staff('rnd-a', 'NUTRITIONIST');
    await h.login('none');
    await h.login('diabetes');
    const f = h.state.fixtures.none;
    await h.check('Live job collision is a conflict and cannot create another plan', async () => {
      const startDate = new Date(Date.now() + 90 * 86400_000);
      const job = await prisma.mealPlanGenerationJob.create({
        data: { userId: f.id, planType: 'WEEKLY', cycleStartDate: startDate },
      });
      try {
        await assert.rejects(
          () => MealGenerationService.generateWindowOnce(f.id, { planType: 'WEEKLY', startDate, numDays: 7 }),
          (error: unknown) =>
            error instanceof AppError && error.statusCode === 409 && error.errorCode === 'GENERATION_IN_PROGRESS'
        );
        assert.equal(await prisma.mealPlan.count({ where: { userId: f.id, scheduledDate: { gte: startDate } } }), 0);
      } finally {
        await prisma.mealPlanGenerationJob.update({
          where: { id: job.id },
          data: { status: 'FAILED', lastErrorCode: 'SYNTHETIC_COLLISION_FINISHED' },
        });
      }
    });
    await h.check('Source swap preview, confirmation, replay, eaten guard and reset', async () => {
      const current = await h.request('/api/user/meals/current', 'GET', undefined, f.token);
      const plan = current.body.data.find((row: any) => row.mealType === 'BREAKFAST');
      assert.ok(plan);
      const original = await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } });
      const route = `/api/user/meals/${plan.id}`;
      assert.equal((await h.request(`${route}/status`, 'PATCH', { status: 'DONE' }, f.token)).status, 200);
      const blocked = await h.request(`${route}/swap-options`, 'GET', undefined, f.token);
      assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
      assert.equal((await h.request(`${route}/status`, 'PATCH', { status: 'PENDING' }, f.token)).status, 200);
      const options = await h.request(`${route}/swap-options`, 'GET', undefined, f.token);
      assert.equal(options.status, 200, JSON.stringify(options.body));
      const option = options.body.data.swapOptions[0];
      assert.ok(option);
      const preview = await h.request(
        `${route}/swap-preview?libraryMealId=${encodeURIComponent(option.id)}`,
        'GET',
        undefined,
        f.token
      );
      assert.equal(preview.status, 200, JSON.stringify(preview.body));
      const input = {
        newLibraryMealId: option.id,
        previewToken: preview.body.data.previewToken,
        requestKey: preview.body.data.requestKey,
        warningShown: true,
        warningAcknowledged: true,
        groceryDeltaAcknowledged: true,
      };
      const swapped = await h.request(`${route}/swap`, 'POST', input, f.token);
      assert.equal(swapped.status, 200, JSON.stringify(swapped.body));
      assert.equal((await h.request(`${route}/swap`, 'POST', input, f.token)).status, 200);
      assert.equal(await prisma.swapLog.count({ where: { mealPlanId: plan.id } }), 1);
      const retired = await prisma.groceryItem.findMany({ where: { groceryList: { userId: f.id }, isObsolete: true } });
      assert.ok(retired.length && retired.every((row) => row.quantity === null || row.quantity > 0));
      assert.ok(retired.every((row) => row.sourceMealCount > 0));
      assert.equal(
        (await h.request(`/api/user/grocery/items/${retired[0].id}/toggle`, 'PATCH', {}, f.token)).status,
        400
      );
      const visible = await h.request('/api/user/grocery/workspace', 'GET', undefined, f.token);
      assert.equal(visible.status, 200);
      assert.ok(!JSON.stringify(visible.body).includes(retired[0].id));
      const restoredPreview = await h.request(
        `${route}/swap-preview?libraryMealId=source:${original.sourceRawRecipeCandidateId}`,
        'GET',
        undefined,
        f.token
      );
      assert.equal(restoredPreview.status, 200, JSON.stringify(restoredPreview.body));
      const restore = await h.request(
        `${route}/swap`,
        'POST',
        {
          ...input,
          newLibraryMealId: `source:${original.sourceRawRecipeCandidateId}`,
          previewToken: restoredPreview.body.data.previewToken,
          requestKey: restoredPreview.body.data.requestKey,
        },
        f.token
      );
      assert.equal(restore.status, 200, JSON.stringify(restore.body));
      const saved = await prisma.groceryItem.findUniqueOrThrow({ where: { id: retired[0].id } });
      assert.equal(saved.isObsolete, false);
      assert.equal(saved.purchasedQuantity, retired[0].purchasedQuantity);
      assert.equal(saved.isChecked, retired[0].isChecked);
      return {
        preservedRetiredPurchases: retired.length,
        restoredPurchase: true,
        eaten: blocked.status,
        restored: options.status,
        optionSource: option.id.startsWith('source:') ? 'corpus' : 'library',
        replayWrites: 1,
      };
    });
    await h.check(
      'Expired case membership blocks a new week while existing cleared meals remain accessible',
      async () => {
        const patient = h.state.fixtures.diabetes;
        const account = await prisma.membershipAccount.findUniqueOrThrow({ where: { userId: patient.id } });
        assert.ok(account.trialStartedAt, 'A cleared current meal starts the trial; a pending preview alone does not');
        try {
          await prisma.membershipAccount.update({
            where: { userId: patient.id },
            data: {
              createdAt: new Date(Date.now() - 32 * 86400_000),
              trialStartedAt: new Date(Date.now() - 31 * 86400_000),
            },
          });
          const state = await MembershipService.state(patient.id);
          assert.equal(state.healthAccess, false);
          await assert.rejects(
            () => MembershipService.assertNewPlan(patient.id, new Date(Date.now() + 14 * 86400_000)),
            (error: unknown) => error instanceof AppError && error.errorCode === 'CASE_MEMBERSHIP_REQUIRED'
          );
          const meals = await h.request('/api/user/meals/current', 'GET', undefined, patient.token);
          assert.equal(meals.status, 200);
          assert.ok(meals.body.data.length);
          return { tier: state.tier, newCaseWeekBlocked: true, currentClearedMeals: meals.body.data.length };
        } finally {
          await prisma.membershipAccount.update({
            where: { userId: patient.id },
            data: { createdAt: account.createdAt, trialStartedAt: account.trialStartedAt },
          });
        }
      }
    );
    await h.check('Expired PRC license blocks review without deleting its audit decisions', async () => {
      const profile = await prisma.nutritionistProfile.findUniqueOrThrow({ where: { id: a.reviewerId } });
      const decisions = await prisma.mealPlanReviewDecision.count({ where: { nutritionistProfileId: profile.id } });
      try {
        await prisma.nutritionistProfile.update({
          where: { id: profile.id },
          data: { prcLicenseExpiry: new Date('2020-01-01') },
        });
        assert.equal((await h.request('/api/nutritionist/queue', 'GET', undefined, a.token)).status, 403);
        assert.equal(
          await prisma.mealPlanReviewDecision.count({ where: { nutritionistProfileId: profile.id } }),
          decisions
        );
      } finally {
        await prisma.nutritionistProfile.update({
          where: { id: profile.id },
          data: { prcLicenseExpiry: profile.prcLicenseExpiry },
        });
      }
    });
    await h.check('Unknown declarations accept a details request but cannot bypass review', async () => {
      const patient = h.state.fixtures.pollen;
      await h.login('pollen');
      const detail = await ClinicalProfileReviewService.detail(patient.id, a.reviewerId);
      assert.equal(
        (await h.request(`/api/nutritionist/profile-reviews/${patient.id}/claim`, 'POST', {}, a.token)).status,
        200
      );
      const decision = await h.request(
        `/api/nutritionist/profile-reviews/${patient.id}/decision`,
        'POST',
        {
          decision: 'REQUEST_DETAILS',
          area: 'FOOD_ALLERGY',
          notes: 'Synthetic clarification request for an unknown declaration.',
          profileRevision: detail.profileRevision,
          scopeKey: detail.scopeKey,
        },
        a.token
      );
      assert.equal(decision.status, 200, JSON.stringify(decision.body));
      assert.equal((await ClinicalProfileReviewService.status(patient.id)).approved, false);
      assert.ok((await h.request('/api/user/meals/generate', 'POST', {}, patient.token)).status >= 400);
    });
  } finally {
    await h.close();
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode || 0));
