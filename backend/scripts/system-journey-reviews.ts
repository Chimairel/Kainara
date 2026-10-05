import assert from 'node:assert/strict';
import { harness } from './helpers/system-audit-harness';
import prisma from '../src/lib/prisma';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';

async function main() {
  const h = await harness('3');
  try {
    const a = await h.staff('rnd-a', 'NUTRITIONIST');
    const b = await h.staff('rnd-b', 'NUTRITIONIST');
    const admin = await h.staff('admin', 'ADMIN');
    await h.check('Shared review queue loads without exposing it to members or admin', async () => {
      const response = await h.request('/api/nutritionist/queue', 'GET', undefined, a.token);
      assert.equal(response.status, 200);
      assert.ok(response.body.data.length);
      for (const key of ['none', 'admin']) {
        await h.login(key);
        assert.equal(
          (await h.request('/api/nutritionist/queue', 'GET', undefined, h.state.fixtures[key].token)).status,
          403
        );
      }
      return { reviewCards: response.body.data.length };
    });
    for (const key of [
      'diabetes',
      'hypertension',
      'kidney-shellfish',
      'heart-nuts-msg',
      'pregnant',
      'gout',
      'intolerance',
    ]) {
      await h.login(key);
      const f = h.state.fixtures[key];
      await h.check(`${key}: meal claim, conflicting reviewer, exact-plate approval, member visibility`, async () => {
        const plan = await prisma.mealPlan.findFirstOrThrow({
          where: { userId: f.id, status: 'PENDING_REVIEW' },
          orderBy: { scheduledDate: 'asc' },
        });
        const claim = await h.request(`/api/nutritionist/queue/${plan.id}/claim`, 'POST', {}, a.token);
        assert.equal(claim.status, 200, JSON.stringify(claim.body));
        assert.equal((await h.request(`/api/nutritionist/queue/${plan.id}/claim`, 'POST', {}, b.token)).status, 409);
        const unchanged = await h.request(
          `/api/nutritionist/review/${plan.id}`,
          'PATCH',
          { action: 'approve', updates: { calories: 1 } },
          a.token
        );
        assert.equal(unchanged.status, 422);
        assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).status, 'PENDING_REVIEW');
        const approval = await h.request(
          `/api/nutritionist/review/${plan.id}`,
          'PATCH',
          { action: 'approve', note: 'Synthetic software fixture review; not clinical validation.' },
          a.token
        );
        assert.equal(approval.status, 200, JSON.stringify(approval.body));
        const current = await h.request('/api/user/meals/current', 'GET', undefined, f.token);
        assert.equal(current.status, 200);
        assert.ok(current.body.data.some((row: any) => row.id === plan.id));
        const saved = await prisma.mealPlan.findUniqueOrThrow({
          where: { id: plan.id },
          include: { reviewDecisions: true, servingComponents: true },
        });
        assert.equal(saved.calories, plan.calories);
        assert.ok(saved.reviewDecisions.length);
        assert.equal(
          (await h.request(`/api/nutritionist/review/${plan.id}`, 'PATCH', { action: 'approve' }, a.token)).status,
          409
        );
        assert.equal(
          (await h.request(`/api/nutritionist/review/${plan.id}`, 'PATCH', { action: 'approve' }, admin.token)).status,
          403
        );
        return {
          approved: saved.status,
          decisions: saved.reviewDecisions.length,
          alteredPlateResponse: unchanged.status,
          preservedRice: saved.servingComponents.filter((row) => row.componentType === 'COOKED_RICE').length,
        };
      });
    }
    await h.check('Rejection commits audit and removes the meal; replacement is not silently approved', async () => {
      const f = h.state.fixtures['heart-nuts-msg'];
      const plan = await prisma.mealPlan.findFirstOrThrow({
        where: { userId: f.id, status: 'PENDING_REVIEW', mealType: 'LUNCH' },
        orderBy: { scheduledDate: 'asc' },
      });
      assert.equal((await h.request(`/api/nutritionist/queue/${plan.id}/claim`, 'POST', {}, a.token)).status, 200);
      const rejected = await h.request(
        `/api/nutritionist/review/${plan.id}`,
        'PATCH',
        { action: 'reject', note: 'Synthetic rejection test: select another candidate.' },
        a.token
      );
      assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
      assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).status, 'REJECTED');
      assert.equal(
        await prisma.mealPlanReviewDecision.count({ where: { mealPlanId: plan.id, decision: 'REJECT' } }),
        1
      );
      assert.equal(await prisma.auditEvent.count({ where: { entityId: plan.id, action: 'MEAL_PLAN_REJECTED' } }), 1);
      const alternatives = await prisma.mealPlan.findMany({
        where: {
          userId: f.id,
          planGroupId: plan.planGroupId,
          scheduledDate: plan.scheduledDate,
          mealType: plan.mealType,
          id: { not: plan.id },
        },
        include: { servingComponents: true, sourceRawRecipeCandidate: true },
      });
      assert.equal(alternatives.length, 1);
      assert.ok(
        alternatives[0].sourceRawRecipeCandidate?.riceRole === 'INCLUDES_RICE' ||
          alternatives[0].servingComponents.some((row) => row.componentType === 'COOKED_RICE'),
        'WITH_RICE replacement must include rice or persist a rice side'
      );
      assert.ok(alternatives[0].composedServingSignature);
      assert.ok(alternatives.every((row) => row.status !== 'APPROVED'));
      const cleared = await MealPlanCycleService.getCurrentCycleWithClearance(f.id);
      assert.ok(!cleared.clearedIds.includes(plan.id));
      return {
        replacements: alternatives.map((row) => ({ status: row.status, provenance: row.candidateProvenance })),
        response: rejected.body,
      };
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
