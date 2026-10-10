import assert from 'node:assert/strict';
import test from 'node:test';
const shared = globalThis as unknown as { prisma: unknown };
shared.prisma = { mealPlanGenerationJob: { updateMany: async () => ({ count: 1 }) } };
const prisma = shared.prisma as {
  mealPlanGenerationJob: { updateMany: (args?: unknown) => Promise<{ count: number }> };
};

test('a lost worker stops when its ownership heartbeat is rejected', async (context) => {
  const { MEAL_JOB_HEARTBEAT_MS, startMealJobHeartbeat } = await import('../src/services/meal-job-lease.service');
  context.mock.timers.enable({ apis: ['setInterval'] });
  const update = context.mock.method(prisma.mealPlanGenerationJob, 'updateMany', async () => ({ count: 0 }));
  const controller = new AbortController();
  const stop = startMealJobHeartbeat('job', 'old-owner', controller);
  context.mock.timers.tick(MEAL_JOB_HEARTBEAT_MS);
  await stop();
  assert.equal(controller.signal.aborted, true);
  assert.deepEqual((update.mock.calls[0].arguments[0] as { where: unknown }).where, {
    id: 'job',
    status: 'PROCESSING_AI',
    processingToken: 'old-owner',
  });
  context.mock.timers.tick(MEAL_JOB_HEARTBEAT_MS * 3);
  assert.equal(update.mock.callCount(), 1, 'stopping cancels further heartbeats');
});

test('slow heartbeats do not overlap and shutdown waits for the current write', async (context) => {
  const { MEAL_JOB_HEARTBEAT_MS, startMealJobHeartbeat } = await import('../src/services/meal-job-lease.service');
  context.mock.timers.enable({ apis: ['setInterval'] });
  let finish!: (result: { count: number }) => void;
  const write = new Promise<{ count: number }>((resolve) => {
    finish = resolve;
  });
  const update = context.mock.method(prisma.mealPlanGenerationJob, 'updateMany', () => write);
  const controller = new AbortController();
  const stop = startMealJobHeartbeat('job', 'owner', controller);
  context.mock.timers.tick(MEAL_JOB_HEARTBEAT_MS * 4);
  assert.equal(update.mock.callCount(), 1);
  let stopped = false;
  const shutdown = stop().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  assert.equal(stopped, false);
  finish({ count: 1 });
  await shutdown;
  assert.equal(controller.signal.aborted, false);
  context.mock.timers.tick(MEAL_JOB_HEARTBEAT_MS);
  assert.equal(update.mock.callCount(), 1);
});
