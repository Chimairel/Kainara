import assert from 'node:assert/strict';
import { harness } from './helpers/system-audit-harness';
import prisma from '../src/lib/prisma';
import { MealGenerationService } from '../src/services/meal-generation.service';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { PlanningReadinessService } from '../src/services/planning-readiness.service';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';

async function main() {
  const h = await harness('2');
  try {
    const a = await h.staff('rnd-a', 'NUTRITIONIST');
    const b = await h.staff('rnd-b', 'NUTRITIONIST');
    const admin = await h.staff('admin', 'ADMIN');
    await h.check('Staff cannot invoke member generation or approval by changing role body', async () => {
      for (const actor of [a, admin])
        assert.equal((await h.request('/api/user/meals/generate', 'POST', {}, actor.token)).status, 403);
      const bad = h.state.fixtures['unverified-rnd'];
      await h.login('unverified-rnd');
      assert.equal((await h.request('/api/nutritionist/queue', 'GET', undefined, bad.token)).status, 403);
    });
    const unknowns = ['unknown', 'pollen', 'non-food'];
    const general = ['none', 'shellfish', 'multi-allergy', 'vegan', 'vegetarian', 'pescatarian'];
    const unrestricted = ['none', 'vegan', 'vegetarian', 'pescatarian'];
    for (const [key, f] of Object.entries(h.state.fixtures).filter(
      ([key]) => !['admin', 'rnd-a', 'rnd-b', 'unverified-rnd'].includes(key)
    )) {
      await h.login(key);
      await h.check(`${key}: scoped review, acknowledgment, preparation and visibility`, async () => {
        if (!general.includes(key)) {
          await NutritionReportService.acknowledgeReport(f.id, 1);
          const blocked = await h.request('/api/user/meals/generate', 'POST', {}, f.token);
          assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
          assert.equal(await prisma.mealPlanGenerationJob.count({ where: { userId: f.id } }), 0);
          const claim = await h.request(`/api/nutritionist/profile-reviews/${f.id}/claim`, 'POST', {}, a.token);
          assert.equal(claim.status, 200, JSON.stringify(claim.body));
          const rival = await h.request(`/api/nutritionist/profile-reviews/${f.id}/claim`, 'POST', {}, b.token);
          assert.equal(rival.status, 409, JSON.stringify(rival.body));
          const detail = await ClinicalProfileReviewService.detail(f.id, a.reviewerId);
          const decision = await h.request(
            `/api/nutritionist/profile-reviews/${f.id}/decision`,
            'POST',
            {
              decision: 'APPROVED',
              notes: 'Isolated software fixture decision; no clinical validation.',
              profileRevision: detail.profileRevision,
              scopeKey: detail.scopeKey,
            },
            a.token
          );
          if (unknowns.includes(key)) {
            assert.equal(decision.status, 422, JSON.stringify(decision.body));
            assert.equal((await ClinicalProfileReviewService.status(f.id)).approved, false);
            return {
              expectedOutcome: 'Clarification required; approval and generation blocked',
              response: decision.body,
            };
          }
          assert.equal(decision.status, 200, JSON.stringify(decision.body));
        } else await NutritionReportService.acknowledgeReport(f.id, 1);
        // Acknowledgment/approval starts preparation asynchronously. Observe that normal job before retrying.
        await new Promise((resolve) => setTimeout(resolve, 250));
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          const job = await prisma.mealPlanGenerationJob.findFirst({ where: { userId: f.id, status: 'GENERATING' } });
          if (!job) break;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        const cycle = await MealGenerationService.generatePlanForUser(f.id);
        const repeat = await MealGenerationService.generatePlanForUser(f.id);
        assert.equal(cycle, repeat);
        const rows = await prisma.mealPlan.findMany({
          where: { planGroupId: cycle },
          include: { servingComponents: true, ingredients: true },
        });
        if (!rows.length && ['shellfish', 'multi-allergy', 'pescatarian'].includes(key)) {
          const jobs = await prisma.mealPlanGenerationJob.findMany({ where: { userId: f.id } });
          assert.ok(
            jobs.some((row) => row.status === 'FAILED' && row.lastErrorCode?.includes('NO_REVIEW_FREE_SOURCE'))
          );
          return {
            expectedOutcome: 'No compatible reviewed source in the deliberately empty reviewed library; failed safely',
            slots: 0,
            jobError: 'NO_REVIEW_FREE_SOURCE',
          };
        }
        assert.ok(rows.length > 0);
        assert.equal(
          new Set(rows.map((row) => `${row.scheduledDate.toISOString()}:${row.mealType}`)).size,
          rows.length
        );
        assert.ok(rows.every((row) => row.calories > 0 && Number.isFinite(row.calories)));
        if (key === 'pescatarian')
          assert.ok(
            rows.every((row) => row.servingComponents.every((component) => component.componentType !== 'COOKED_RICE'))
          );
        const current = await h.request('/api/user/meals/current', 'GET', undefined, f.token);
        assert.equal(current.status, 200, JSON.stringify(current.body));
        if (!unrestricted.includes(key)) {
          assert.ok(rows.every((row) => row.status === 'PENDING_REVIEW'));
          assert.equal(current.body.data.length, 0);
          assert.ok(current.body.meta.pendingReview.mealCount > 0);
        }
        return {
          cycle,
          slots: rows.length,
          statuses: [...new Set(rows.map((row) => row.status))],
          ricePlates: rows.filter((row) =>
            row.servingComponents.some((component) => component.componentType === 'COOKED_RICE')
          ).length,
          actionable: current.body.data.length,
          readiness: await PlanningReadinessService.getForUser(f.id),
          jobStatuses: (await prisma.mealPlanGenerationJob.findMany({ where: { userId: f.id } })).map(
            (row) => row.status
          ),
        };
      });
    }
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
