/** Ownership/recovery acceptance; refuses hosted databases and touches only its own fixture. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import {
  newMealJobToken,
  recoverExpiredMealJobLeases,
  startMealJobHeartbeat,
  MEAL_JOB_HEARTBEAT_MS,
} from '../src/services/meal-job-lease.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.ok(['55487', '55488'].includes(target.port));
  assert.ok(/^\/kainara_(partial|transaction|browser)/u.test(target.pathname));
  assert.equal(process.env.NODE_ENV, 'test');
  const user = await prisma.user.create({
    data: {
      email: `lease-${randomUUID()}@example.invalid`,
      name: 'Synthetic lease acceptance',
      passwordHash: 'NON_LOGIN_FIXTURE',
    },
  });
  const now = new Date();
  try {
    const create = (offset: number, processingToken: string, age: number) =>
      prisma.mealPlanGenerationJob.create({
        data: {
          userId: user.id,
          planType: 'WEEKLY',
          cycleStartDate: new Date(now.getTime() + offset * 86400000),
          status: 'PROCESSING_AI',
          processingToken,
          updatedAt: new Date(now.getTime() - age),
        },
      });
    const [live, dead, legacyLive, legacyDead] = await Promise.all([
      create(1, newMealJobToken(), 30_000),
      create(2, newMealJobToken(), 121_000),
      create(3, randomUUID(), 3 * 60_000),
      create(4, randomUUID(), 21 * 60_000),
    ]);
    // Two recovery workers cannot reclaim a healthy lease or distort ownership.
    await Promise.all([recoverExpiredMealJobLeases(now), recoverExpiredMealJobLeases(now)]);
    const states = await prisma.mealPlanGenerationJob.findMany({ where: { userId: user.id } });
    for (const job of [live, legacyLive]) {
      const saved = states.find((value) => value.id === job.id)!;
      assert.equal(saved.status, 'PROCESSING_AI');
      assert.equal(saved.processingToken, job.processingToken);
    }
    for (const job of [dead, legacyDead]) {
      const saved = states.find((value) => value.id === job.id)!;
      assert.equal(saved.status, 'WAITING_FOR_AI');
      assert.equal(saved.processingToken, null);
    }
    const replacement = newMealJobToken();
    const claim = await prisma.mealPlanGenerationJob.updateMany({
      where: { id: dead.id, status: 'WAITING_FOR_AI' },
      data: {
        status: 'PROCESSING_AI',
        processingToken: replacement,
      },
    });
    assert.equal(claim.count, 1);
    assert.equal(
      (
        await prisma.mealPlanGenerationJob.updateMany({
          where: {
            id: dead.id,
            status: 'PROCESSING_AI',
            processingToken: dead.processingToken,
          },
          data: { status: 'COMPLETED' },
        })
      ).count,
      0,
      'the abandoned owner cannot complete the reclaimed job'
    );
    const controller = new AbortController();
    const stop = startMealJobHeartbeat(dead.id, dead.processingToken!, controller);
    await new Promise((resolve) => setTimeout(resolve, MEAL_JOB_HEARTBEAT_MS + 1500));
    await stop();
    assert.equal(controller.signal.aborted, true);
    const saved = await prisma.mealPlanGenerationJob.findUniqueOrThrow({ where: { id: dead.id } });
    assert.equal(saved.processingToken, replacement);
    assert.equal(saved.status, 'PROCESSING_AI');
    console.log(
      'PASS concurrent recovery, healthy/legacy lease preservation, stale-owner write rejection, lost-owner cancellation'
    );
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
