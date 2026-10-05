import assert from 'node:assert/strict';
import { harness, password } from './helpers/system-audit-harness';
import prisma from '../src/lib/prisma';
import { GroceryService } from '../src/services/grocery.service';
import { randomUUID } from 'node:crypto';

async function main() {
  const h = await harness('4');
  try {
    await h.login('none');
    await h.login('vegetarian');
    const f = h.state.fixtures.none;
    const stranger = h.state.fixtures.vegetarian;
    const current = await h.request('/api/user/meals/current', 'GET', undefined, f.token);
    const plan = current.body.data[0];
    assert.ok(plan);
    await h.check('Eaten, skipped and reset status update once and reject another member', async () => {
      for (const status of ['DONE', 'DONE', 'PENDING', 'SKIPPED', 'PENDING']) {
        const response = await h.request(`/api/user/meals/${plan.id}/status`, 'PATCH', { status }, f.token);
        assert.equal(response.status, 200, JSON.stringify(response.body));
      }
      assert.equal(await prisma.mealLog.count({ where: { mealPlanId: plan.id } }), 1);
      assert.equal((await prisma.mealLog.findUniqueOrThrow({ where: { mealPlanId: plan.id } })).status, 'PENDING');
      const denied = await h.request(`/api/user/meals/${plan.id}/status`, 'PATCH', { status: 'DONE' }, stranger.token);
      assert.ok([403, 404, 409].includes(denied.status), JSON.stringify(denied.body));
      assert.equal((await prisma.mealLog.findUniqueOrThrow({ where: { mealPlanId: plan.id } })).status, 'PENDING');
      return { foreignStatus: denied.status, scheduledLogs: 1 };
    });
    await h.check('Pending review meals cannot be eaten or swapped', async () => {
      const restricted = h.state.fixtures.diabetes;
      await h.login('diabetes');
      const pending = await prisma.mealPlan.findFirstOrThrow({
        where: { userId: restricted.id, status: 'PENDING_REVIEW' },
      });
      const status = await h.request(
        `/api/user/meals/${pending.id}/status`,
        'PATCH',
        { status: 'DONE' },
        restricted.token
      );
      assert.ok(status.status >= 400 && status.status < 500, JSON.stringify(status.body));
      const swap = await h.request(`/api/user/meals/${pending.id}/swap-options`, 'GET', undefined, restricted.token);
      assert.ok(swap.status >= 400 && swap.status < 500, JSON.stringify(swap.body));
      assert.equal(await prisma.mealLog.count({ where: { mealPlanId: pending.id } }), 0);
      return { status: status.status, swap: swap.status };
    });
    await h.check('Grocery checklist toggles, preserves purchase state on rebuild and denies foreign IDs', async () => {
      const grocery = await GroceryService.generateGroceryList(f.id);
      const item = grocery.groceryItems[0];
      assert.ok(item);
      assert.equal((await h.request(`/api/user/grocery/items/${item.id}/toggle`, 'PATCH', {}, f.token)).status, 200);
      const checked = await prisma.groceryItem.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(checked.isChecked, true);
      await GroceryService.generateGroceryList(f.id);
      assert.equal((await prisma.groceryItem.findUniqueOrThrow({ where: { id: item.id } })).isChecked, true);
      const foreign = await h.request(`/api/user/grocery/items/${item.id}/toggle`, 'PATCH', {}, stranger.token);
      assert.ok(foreign.status >= 400 && foreign.status < 500, JSON.stringify(foreign.body));
      assert.equal((await prisma.groceryItem.findUniqueOrThrow({ where: { id: item.id } })).isChecked, true);
      const pdf = await h.request('/api/user/grocery/pdf', 'GET', undefined, f.token);
      assert.equal(pdf.status, 200, JSON.stringify(pdf.body));
      assert.match(pdf.headers.get('content-type') || '', /application\/pdf/);
      assert.ok(pdf.body.raw.startsWith('%PDF-'));
      return { items: grocery.groceryItems.length, foreignToggle: foreign.status, pdfSignature: '%PDF-' };
    });
    await h.check('Hydration add, remove, reset and boundary validation', async () => {
      assert.equal((await h.request('/api/user/water/today', 'DELETE', undefined, f.token)).status, 200);
      assert.equal((await h.request('/api/user/water', 'POST', { amountMl: 250 }, f.token)).status, 201);
      assert.equal((await h.request('/api/user/water/remove', 'POST', { amountMl: 100 }, f.token)).status, 200);
      assert.equal((await h.request('/api/user/water', 'POST', { amountMl: -250 }, f.token)).status, 400);
      const water = await h.request('/api/user/water/today', 'GET', undefined, f.token);
      assert.equal(water.status, 200);
      assert.equal(water.body.data.totalMl, 150, JSON.stringify(water.body));
      assert.equal((await h.request('/api/user/water/today', 'DELETE', undefined, f.token)).status, 200);
      return { totalMl: 150 };
    });
    await h.check('Outside meal unresolved preview, confirm, history and void with no AI key', async () => {
      const response = await h.request(
        '/api/user/meals/log-outside',
        'POST',
        {
          mealName: 'Unknown synthetic snack',
          mealType: 'SNACK',
          useAiEstimate: false,
          requestKey: randomUUID(),
          items: [
            { name: 'Unknown synthetic snack', reportedNutrition: { calories: 120, proteinG: 2, carbsG: 20, fatG: 4 } },
          ],
        },
        f.token
      );
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.data.warningRequired, true);
      const confirmation = {
        mealType: 'SNACK',
        warningAcknowledged: true,
        confirmationId: response.body.data.confirmationId,
      };
      const confirmed = await h.request('/api/user/meals/log-outside', 'POST', confirmation, f.token);
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
      const logId = confirmed.body.data.log.id;
      assert.ok(logId);
      const replay = await h.request('/api/user/meals/log-outside', 'POST', confirmation, f.token);
      assert.ok([200, 201, 409].includes(replay.status), JSON.stringify(replay.body));
      assert.equal(await prisma.mealLog.count({ where: { id: logId } }), 1);
      const foreign = await h.request(
        `/api/user/meals/logs/${logId}/void`,
        'POST',
        { reason: 'Synthetic foreign void' },
        stranger.token
      );
      assert.ok(foreign.status >= 400 && foreign.status < 500, JSON.stringify(foreign.body));
      assert.equal((await h.request('/api/user/meals/history', 'GET', undefined, f.token)).status, 200);
      const voided = await h.request(
        `/api/user/meals/logs/${logId}/void`,
        'POST',
        { reason: 'Synthetic capture test complete' },
        f.token
      );
      assert.equal(voided.status, 200, JSON.stringify(voided.body));
      return {
        preview: true,
        confirmed: confirmed.status,
        replay: replay.status,
        foreignVoid: foreign.status,
        voided: true,
      };
    });
    await h.check('Weekly check-in due boundary, unchanged receipt and idempotent resubmit', async () => {
      assert.equal((await h.request('/api/user/checkin/submit', 'POST', { changed: false }, f.token)).status, 409);
      // Move only the synthetic fixture's age anchor; clock-driven behavior uses the ordinary API.
      await prisma.userProfile.update({
        where: { userId: f.id },
        data: { firstReportAcknowledgedAt: new Date(Date.now() - 8 * 86400_000) },
      });
      const due = await h.request('/api/user/checkin/status', 'GET', undefined, f.token);
      assert.equal(due.body.data.isDue, true, JSON.stringify(due.body));
      const submitted = await h.request(
        '/api/user/checkin/submit',
        'POST',
        { changed: false, profileRevision: due.body.data.profileRevision },
        f.token
      );
      assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
      assert.equal((await h.request('/api/user/checkin/submit', 'POST', { changed: false }, f.token)).status, 200);
      assert.equal(await prisma.weeklyCheckin.count({ where: { userId: f.id } }), 1);
      return { due: true, savedOnce: true };
    });
    await h.check('Weight validation and authenticated progress export', async () => {
      assert.equal((await h.request('/api/user/weight-log', 'POST', { weightKg: -1 }, stranger.token)).status, 400);
      const weight = await h.request('/api/user/weight-log', 'POST', { weightKg: 69 }, stranger.token);
      assert.equal(weight.status, 201, JSON.stringify(weight.body));
      assert.equal((await h.request('/api/user/progress/history', 'GET', undefined, stranger.token)).status, 200);
      const exported = await h.request('/api/user/account/export', 'GET', undefined, stranger.token);
      assert.equal(exported.status, 200);
      assert.ok(!JSON.stringify(exported.body).includes('passwordHash'));
      return { weight: 69, exportIncludesPasswordHash: false };
    });
    await h.check('Refresh rotation and invalid login do not change member data', async () => {
      const login = await h.login('none');
      const refreshed = await h.request('/api/auth/refresh', 'POST', {}, undefined, login.cookie);
      assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
      const replay = await h.request('/api/auth/refresh', 'POST', {}, undefined, login.cookie);
      assert.equal(replay.status, 401);
      assert.equal(
        (await h.request('/api/auth/login', 'POST', { email: f.email, password: 'WrongPassword123!' })).status,
        400
      );
      return { refreshed: refreshed.status, oldCookieReplay: replay.status };
    });
    await h.check('Deletion rejects wrong password, then removes only the synthetic member', async () => {
      const victim = h.state.fixtures.pescatarian;
      await h.login('pescatarian');
      const body = { password: 'IncorrectPassword123!', confirmation: 'DELETE MY KAINARA ACCOUNT' };
      const wrong = await h.request('/api/user/account', 'DELETE', body, victim.token);
      assert.ok(wrong.status >= 400 && wrong.status < 500, JSON.stringify(wrong.body));
      assert.ok(await prisma.user.findUnique({ where: { id: victim.id } }));
      const removed = await h.request('/api/user/account', 'DELETE', { ...body, password }, victim.token);
      assert.equal(removed.status, 200, JSON.stringify(removed.body));
      assert.equal(await prisma.user.findUnique({ where: { id: victim.id } }), null);
      assert.ok(await prisma.user.findUnique({ where: { id: f.id } }));
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
