import type { Prisma } from '@prisma/client';

/** Called within the swap transaction, after its idempotency check and writes. */
export async function recordMealSwapNotification(
  tx: Prisma.TransactionClient,
  userId: string,
  allowance?: { limit: number; used: number }
) {
  const swapsRemaining = allowance ? Math.max(0, allowance.limit - allowance.used - 1) : null;
  const remaining =
    swapsRemaining === null
      ? ''
      : ` ${swapsRemaining} ${swapsRemaining === 1 ? 'swap' : 'swaps'} left in this plan cycle.`;
  await tx.notification.create({
    data: {
      userId,
      title: 'Meal swap used',
      message: `Your meal was swapped. You used 1 meal swap.${remaining}`,
      type: 'MEMBERSHIP_UPDATED',
    },
  });
  return swapsRemaining;
}
