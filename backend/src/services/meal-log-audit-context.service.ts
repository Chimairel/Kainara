import type { Prisma } from '@prisma/client';
import { mealLogAuditWrite } from '@/domain/meal-log-audit.policy';

/** Transaction-local attribution; never persists payment configuration in a log or response. */
export async function setMealLogAuditContext(tx: Prisma.TransactionClient, actorUserId: string | null, reason: string) {
  const context = JSON.stringify(mealLogAuditWrite(actorUserId, reason));
  await tx.$executeRaw`SELECT set_config('kainara.meal_log_write', ${context}, true)`;
}
