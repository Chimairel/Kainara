import assert from 'node:assert/strict';
import test from 'node:test';

test('shutdown drains and releases the owned turn, refuses parallel/new work, and preserves the retry', async (context) => {
  process.env.JWT_SECRET ||= 'worker-test-only-access';
  process.env.JWT_REFRESH_SECRET ||= 'worker-test-only-refresh';
  const shared = globalThis as unknown as { prisma: unknown };
  const previous = shared.prisma;
  let loaded!: () => void;
  const loading = new Promise<void>((resolve) => {
    loaded = resolve;
  });
  let finish!: () => void;
  const interruptedRead = new Promise<null>((resolve) => {
    finish = () => resolve(null);
  });
  const job = {
    id: 'owned-job',
    planGroupId: 'cycle',
    attempts: 1,
    startedAt: new Date(),
    nextAttemptAt: new Date(),
    cycle: null,
  };
  let state = 'WAITING_FOR_AI';
  let owner: string | null = null;
  let release: Record<string, unknown> | undefined;
  shared.prisma = {
    mealPlanGenerationJob: {
      findMany: async () => [job],
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!where.id) return { count: 0 }; // No abandoned leases in this fixture.
        if (data.status === 'PROCESSING_AI') {
          assert.equal(state, 'WAITING_FOR_AI');
          state = 'PROCESSING_AI';
          owner = String(data.processingToken);
          return { count: 1 };
        }
        assert.equal(where.id, job.id);
        assert.equal(where.processingToken, owner);
        release = data;
        state = String(data.status);
        owner = null;
        return { count: 1 };
      },
    },
    mealPlanCycle: {
      findUnique: () => {
        loaded();
        return interruptedRead;
      },
    },
  };
  context.after(() => {
    shared.prisma = previous;
  });
  const { MealAiQueueService } = await import('../src/services/meal-ai-queue.service');
  // Recovery is covered by SQL acceptance; focus this fixture on one already admitted turn.
  (MealAiQueueService as unknown as { recoveryAt: number }).recoveryAt = Date.now() + 600_000;
  const turn = MealAiQueueService.runOne();
  await loading;
  assert.equal(await MealAiQueueService.runOne(), false);
  let drained = false;
  const shutdown = MealAiQueueService.shutdown().then(() => {
    drained = true;
  });
  await Promise.resolve();
  assert.equal(drained, false, 'shutdown waits for its active turn');
  finish();
  await shutdown;
  assert.equal(await turn, true);
  assert.equal(state, 'WAITING_FOR_AI');
  assert.equal(owner, null);
  assert.equal(release?.lastErrorCode, 'WORKER_INTERRUPTED');
  assert.ok(release?.nextAttemptAt instanceof Date);
  assert.equal(await MealAiQueueService.runOne(), false, 'no new turn after shutdown');
});
