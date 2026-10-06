import type { MealType, Prisma } from '@prisma/client';

type Slot = { userId: string; planGroupId: string; scheduledDate: Date; mealType: MealType };
type Recipe = {
  libraryMealId?: string | null;
  sourceRawRecipeCandidateId?: string | null;
  baseRecipeSignature?: string | null;
};

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
