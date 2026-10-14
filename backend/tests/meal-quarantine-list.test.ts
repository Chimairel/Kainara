import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import prisma from '../src/lib/prisma';
import { MealReviewService } from '../src/services/meal-review.service';
import { mealReviewRouter } from '../src/routes/meal-review.routes';

test('quarantine state filter is applied before the queue limit; default review queue retains both states', async context => {
  const calls: Array<Record<string, unknown>> = [];
  const original = prisma.mealReviewLineage.findMany;
  context.after(() => { prisma.mealReviewLineage.findMany = original; });
  prisma.mealReviewLineage.findMany = (async (args: Record<string, unknown>) => {
    calls.push(args);
    return [{ state: 'QUARANTINED', incidentCount: 2, meals: [{ id: 'meal', mealName: 'Recorded meal' }] }];
  }) as unknown as typeof original;
  const rows = await MealReviewService.queue('QUARANTINED');
  assert.deepEqual(calls[0].where, { state: 'QUARANTINED' });
  assert.equal(calls[0].take, 100);
  assert.equal(rows[0].id, 'meal');
  await MealReviewService.queue();
  assert.deepEqual(calls[1].where, { state: { in: ['PENDING_REREVIEW', 'QUARANTINED'] } });
});

for (const role of ['admin', 'rnd'] as const) test(`${role} queue route validates the quarantine selector and returns no-store`, async context => {
  const calls: unknown[] = [];
  context.mock.method(MealReviewService, 'queue', async (state?: 'QUARANTINED' | 'PENDING_REREVIEW') => { calls.push(state); return []; });
  const app = express();
  app.use('/cases', mealReviewRouter(role)); // Live authorization is provided by the existing parent router.
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await new Promise<void>(resolve => server.on('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/cases`;
  for (const query of ['state=PUBLISHED', 'state=QUARANTINED&actorId=other', 'state=QUARANTINED&state=PENDING_REREVIEW']) {
    assert.equal((await fetch(`${base}?${query}`)).status, 400);
  }
  assert.equal(calls.length, 0);
  const response = await fetch(`${base}?state=QUARANTINED`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(calls, ['QUARANTINED']);
  await fetch(base);
  assert.deepEqual(calls, ['QUARANTINED', undefined]);
});
