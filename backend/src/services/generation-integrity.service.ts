import type { Prisma } from '@prisma/client';

export async function assertFoodCompositionRevisions(tx: Prisma.TransactionClient, revisions: Map<string, number>) {
  const foods = await tx.foodItem.findMany({
    where: { id: { in: [...revisions.keys()] } },
    select: { id: true, compositionRevision: true },
  });
  if (foods.length !== revisions.size || foods.some((food) => food.compositionRevision !== revisions.get(food.id)))
    throw new Error('Food composition changed during generation. Please retry.');
}

export async function assertGenerationIntegrity(
  tx: Prisma.TransactionClient,
  userId: string,
  start: Date,
  end: Date,
  revisions: Map<string, number>,
  reconciled?: { retainedMealIds: string[]; purchasedItemIds: string[] }
) {
  await assertFoodCompositionRevisions(tx, revisions);
  const existing = await tx.mealPlan.findMany({
    where: { userId, status: { in: ['APPROVED', 'PENDING_REVIEW'] }, scheduledDate: { gte: start, lte: end } },
    select: {
      id: true,
      planGroupId: true,
      mealLogs: { where: { status: { in: ['DONE', 'SKIPPED'] } }, select: { id: true } },
    },
  });
  const purchased = await tx.groceryItem.count({
    where: {
      purchasedQuantity: { gt: 0 },
      ...(reconciled ? { id: { notIn: reconciled.purchasedItemIds } } : {}),
      groceryList: { userId, planGroupId: { in: existing.map((meal) => meal.planGroupId) } },
    },
  });
  // Only the exact histories rechecked under the member lock may be retained by a repair.
  // Ordinary generation and any unaccounted history keep the existing protection.
  if (purchased || existing.some((meal) => meal.mealLogs.length && !reconciled?.retainedMealIds.includes(meal.id)))
    throw new Error(
      'This cycle already has purchases or logged meals. Swap individual uneaten meals to preserve your shopping and history.'
    );
}
