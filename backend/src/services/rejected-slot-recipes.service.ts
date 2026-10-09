import type { MealType, Prisma } from '@prisma/client';
import { requiresExplicitReplacementReview } from '@/domain/review-swap.policy';
import { AppError } from '@/errors/AppError';

type Slot = { userId: string; planGroupId: string; scheduledDate: Date; mealType: MealType };
type Recipe = {
  libraryMealId?: string | null;
  sourceRawRecipeCandidateId?: string | null;
  baseRecipeSignature?: string | null;
};

/** A recorded no-match decision holds automatic replacement across competing rows of the same dated slot. */
export async function hasRecordedReplacementHold(db: Pick<Prisma.TransactionClient, 'mealPlan'>, slot: Slot) {
  return (await db.mealPlan.findMany({ where: { userId: slot.userId, planGroupId: slot.planGroupId,
    scheduledDate: slot.scheduledDate, mealType: slot.mealType, status: 'REJECTED', supersededByMealPlanId: null },
    select: { status: true, selectionEvidence: true } })).some(requiresExplicitReplacementReview);
}
export async function assertNoAutomaticSlotReplacement(db: Pick<Prisma.TransactionClient, 'mealPlan'>, slot: Slot) {
  if (await hasRecordedReplacementHold(db, slot))
    throw new AppError('An RND recorded no suitable replacement for this slot.', 409, 'RND_REPLACEMENT_HELD');
}

/** A rejection applies to the recipe in this dated slot, including another library variant. */
export async function rejectedSlotRecipes(db: Pick<Prisma.TransactionClient, 'mealPlan'>, slot: Slot) {
  const rows = await db.mealPlan.findMany({
    where: {
      userId: slot.userId,
      planGroupId: slot.planGroupId,
      scheduledDate: slot.scheduledDate,
      mealType: slot.mealType,
      status: 'REJECTED',
    },
    select: { libraryMealId: true, sourceRawRecipeCandidateId: true, baseRecipeSignature: true },
  });
  const libraryIds = new Set(rows.flatMap((row) => (row.libraryMealId ? [row.libraryMealId] : [])));
  const rawIds = new Set(
    rows.flatMap((row) => (row.sourceRawRecipeCandidateId ? [row.sourceRawRecipeCandidateId] : []))
  );
  const signatures = new Set(rows.flatMap((row) => (row.baseRecipeSignature ? [row.baseRecipeSignature] : [])));
  return {
    libraryIds,
    rawIds,
    signatures,
    includes: (recipe: Recipe) =>
      Boolean(
        (recipe.libraryMealId && libraryIds.has(recipe.libraryMealId)) ||
        (recipe.sourceRawRecipeCandidateId && rawIds.has(recipe.sourceRawRecipeCandidateId)) ||
        (recipe.baseRecipeSignature && signatures.has(recipe.baseRecipeSignature))
      ),
  };
}

/** Recheck under the profile lock; an intervening rejection must not be reintroduced. */
export async function assertRecipeNotRejectedForSlot(
  db: Pick<Prisma.TransactionClient, 'mealPlan'>,
  slot: Slot,
  recipe: Recipe
) {
  if ((await rejectedSlotRecipes(db, slot)).includes(recipe)) {
    throw new Error('This recipe was already rejected for this meal slot. Select another candidate.');
  }
}
