import { randomUUID } from 'node:crypto';
import { MealPlanGenerationJobStatus } from '@prisma/client';
import prisma from '@/lib/prisma';

export const MEAL_JOB_LEASE_MS = 2 * 60_000;
export const MEAL_JOB_HEARTBEAT_MS = 20_000;
const LEGACY_LEASE_MS = 20 * 60_000;
const PREFIX = 'heartbeat:';
export const newMealJobToken = () => PREFIX + randomUUID();

export async function recoverExpiredMealJobLeases(now: Date): Promise<void> {
  await prisma.mealPlanGenerationJob.updateMany({
    where: {
      status: MealPlanGenerationJobStatus.PROCESSING_AI,
      OR: [
        { processingToken: { startsWith: PREFIX }, updatedAt: { lt: new Date(now.getTime() - MEAL_JOB_LEASE_MS) } },
        {
          AND: [
            { OR: [{ processingToken: null }, { NOT: { processingToken: { startsWith: PREFIX } } }] },
            { updatedAt: { lt: new Date(now.getTime() - LEGACY_LEASE_MS) } },
          ],
        },
      ],
    },
    data: { status: MealPlanGenerationJobStatus.WAITING_FOR_AI, processingToken: null, nextAttemptAt: now },
  });
}

/** Heartbeats and release can only affect the job bearing this worker's token. */
export function startMealJobHeartbeat(jobId: string, token: string, controller: AbortController) {
  let stopped = false;
  let pending: Promise<void> | null = null;
  const where = { id: jobId, status: MealPlanGenerationJobStatus.PROCESSING_AI, processingToken: token };
  const beat = () => {
    if (stopped || pending) return;
    pending = prisma.mealPlanGenerationJob
      .updateMany({ where, data: { updatedAt: new Date() } })
      .then((result) => {
        if (!result.count) controller.abort();
      })
      .catch(() => {
        console.warn('[MealAiQueue] Heartbeat unavailable; ownership will be rechecked before saving.');
      })
      .finally(() => {
        pending = null;
      });
  };
  const timer = setInterval(beat, MEAL_JOB_HEARTBEAT_MS);
  timer.unref();
  return async () => {
    stopped = true;
    clearInterval(timer);
    if (pending) await pending;
  };
}
