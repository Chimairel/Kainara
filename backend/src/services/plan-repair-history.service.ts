import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { env } from '@/config/env';
import { getManilaBusinessDateKey } from '@/domain/meal-actionability.policy';
import { referenceServingDigest } from '@/domain/reusable-review-reference.policy';
import { AppError } from '@/errors/AppError';

const ids = (value: unknown) =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 100) : [];
const slotKey = (row: { scheduledDate: Date; mealType: string }) =>
  `${getManilaBusinessDateKey(row.scheduledDate)}:${row.mealType}`;
export const retainedSlotKeys = (rows: { scheduledDate: Date; mealType: string }[]) => new Set(rows.map(slotKey));

export async function retainedMealsForCycle(
  userId: string,
  cycleId: string,
  client: Partial<Pick<Prisma.TransactionClient, 'mealPlan' | 'mealPlanRepairReceipt'>> = prisma
) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return [];
  if (!client.mealPlanRepairReceipt || !client.mealPlan)
    throw new Error('Repair history requires a complete database client.');
  const receipt = await client.mealPlanRepairReceipt.findFirst({ where: { userId, replacementCycleId: cycleId } });
  const retainedIds = ids(receipt?.retainedMealIds);
  if (!retainedIds.length) return [];
  const rows = await client.mealPlan.findMany({
    where: { userId, id: { in: retainedIds }, mealLogs: { some: { userId, status: { in: ['DONE', 'SKIPPED'] } } } },
    select: {
      id: true,
      mealType: true,
      mealName: true,
      scheduledDate: true,
      calories: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
      mealLogs: {
        where: { userId, status: { in: ['DONE', 'SKIPPED'] } },
        select: { id: true, status: true, loggedAt: true, calories: true, proteinG: true, carbsG: true, fatG: true },
      },
    },
    orderBy: [{ scheduledDate: 'asc' }, { mealType: 'asc' }, { id: 'asc' }],
  });
  return rows.map((row) => ({
    ...row,
    calories: row.mealLogs[0].calories,
    proteinG: row.mealLogs[0].proteinG,
    carbsG: row.mealLogs[0].carbsG,
    fatG: row.mealLogs[0].fatG,
  }));
}
type Purchase = {
  sourceItemId: string;
  sourceCycleId: string;
  ingredientName: string;
  quantity: number;
  unit: string | null;
};
function savedPurchases(value: unknown): Purchase[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Purchase =>
      Boolean(
        item &&
        typeof item === 'object' &&
        typeof item.sourceItemId === 'string' &&
        typeof item.sourceCycleId === 'string' &&
        typeof item.ingredientName === 'string' &&
        typeof item.quantity === 'number' &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        (item.unit === null || typeof item.unit === 'string')
      )
    )
    .slice(0, 500);
}
/** The member lock serializes the final capture against logs/purchases. Original records are never moved or credited as pantry stock. */
export async function loadRepairHistory(
  userId: string,
  sourceCycleId: string,
  window: { startDate: Date; endDate: Date },
  client: Prisma.TransactionClient = prisma
) {
  const source = await client.mealPlanCycle.findFirst({ where: { id: sourceCycleId, userId }, select: { id: true } });
  if (!source) throw new AppError('Repair source does not belong to this member.', 409, 'MEAL_REVIEW_CONTEXT_CHANGED');
  const inherited = await client.mealPlanRepairReceipt.findFirst({
    where: { userId, replacementCycleId: sourceCycleId },
  });
  const meals = await client.mealPlan.findMany({
    where: {
      userId,
      OR: [{ planGroupId: sourceCycleId }, { id: { in: ids(inherited?.retainedMealIds) } }],
      scheduledDate: { gte: window.startDate, lte: window.endDate },
      mealLogs: { some: { userId, status: { in: ['DONE', 'SKIPPED'] } } },
    },
    select: {
      id: true,
      mealType: true,
      scheduledDate: true,
      calories: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
      mealLogs: {
        where: { userId, status: { in: ['DONE', 'SKIPPED'] } },
        select: { id: true, status: true, loggedAt: true },
      },
    },
    orderBy: { id: 'asc' },
    take: 101,
  });
  const purchases = await client.groceryItem.findMany({
    where: { purchasedQuantity: { gt: 0 }, groceryList: { userId, planGroupId: sourceCycleId } },
    select: { id: true, ingredientName: true, purchasedQuantity: true, unit: true },
    orderBy: { id: 'asc' },
    take: 501,
  });
  const allPurchases = new Map<string, Purchase>(
    savedPurchases(inherited?.purchasedItems).map((item) => [item.sourceItemId, item])
  );
  for (const item of purchases)
    allPurchases.set(item.id, {
      sourceItemId: item.id,
      sourceCycleId,
      ingredientName: item.ingredientName,
      quantity: item.purchasedQuantity,
      unit: item.unit,
    });
  if (meals.length > 100 || allPurchases.size > 500)
    throw new AppError('This plan needs manual history reconciliation.', 409, 'PLAN_REPAIR_HISTORY_CONFLICT');
  const purchasedItems = [...allPurchases.values()].sort((a, b) => a.sourceItemId.localeCompare(b.sourceItemId));
  return { meals, purchasedItems, version: referenceServingDigest({ meals, purchasedItems }) };
}
export async function previousPlanPurchases(
  userId: string,
  cycleId: string,
  client: Prisma.TransactionClient = prisma
) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return [];
  const receipt = await client.mealPlanRepairReceipt.findFirst({
    where: { userId, replacementCycleId: cycleId },
    select: { purchasedItems: true },
  });
  return savedPurchases(receipt?.purchasedItems).map(({ ingredientName, quantity, unit }) => ({
    ingredientName,
    quantity,
    unit,
  }));
}

type RepairHistory = Awaited<ReturnType<typeof loadRepairHistory>>;
export async function assertUnchangedRepairHistory(
  tx: Prisma.TransactionClient,
  userId: string,
  sourceCycleId: string,
  window: { startDate: Date; endDate: Date },
  expected: RepairHistory
) {
  const latest = await loadRepairHistory(userId, sourceCycleId, window, tx);
  if (latest.version !== expected.version)
    throw new AppError(
      'Meal logs or purchases changed during repair. Refresh the plan.',
      409,
      'MEAL_REVIEW_CONTEXT_CHANGED'
    );
}

export async function recordRepairHistory(
  tx: Prisma.TransactionClient,
  userId: string,
  sourceCycleId: string,
  replacementCycleId: string,
  profileRevision: number,
  history: RepairHistory
) {
  await tx.mealPlanRepairReceipt.create({
    data: {
      userId,
      sourceCycleId,
      replacementCycleId,
      profileRevision,
      retainedMealIds: history.meals.map((meal) => meal.id),
      purchasedItems: history.purchasedItems as unknown as Prisma.InputJsonArray,
    },
  });
  await tx.auditEvent.create({
    data: {
      actorUserId: userId,
      action: 'PLAN_REPAIR_HISTORY_RECONCILED',
      entityType: 'MealPlanCycle',
      entityId: replacementCycleId,
      metadata: {
        sourceCycleId,
        profileRevision,
        retainedMealCount: history.meals.length,
        retainedSlotCount: retainedSlotKeys(history.meals).size,
        previousPurchaseCount: history.purchasedItems.length,
      },
    },
  });
}
