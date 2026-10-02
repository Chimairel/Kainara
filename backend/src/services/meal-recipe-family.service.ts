import type { Prisma } from '@prisma/client';

/** Resolve legacy source servings and all quantity versions of those servings. */
export async function recipeFamilyWhere(tx: Pick<Prisma.TransactionClient, 'mealLibrary'>, mealId: string) {
  const selected = await tx.mealLibrary.findUnique({
    where: { id: mealId },
    select: { id: true, recipeFamilyId: true, sourceRawRecipeCandidateId: true },
  });
  if (!selected) throw new Error('Library meal not found.');
  const root = selected.recipeFamilyId
    ? await tx.mealLibrary.findUniqueOrThrow({
        where: { id: selected.recipeFamilyId },
        select: { id: true, sourceRawRecipeCandidateId: true },
      })
    : selected;
  const sourceId = root.sourceRawRecipeCandidateId;
  const roots = sourceId
    ? await tx.mealLibrary.findMany({
        where: { sourceRawRecipeCandidateId: sourceId },
        select: { id: true },
      })
    : [root];
  const ids = roots.map((meal) => meal.id);
  return { OR: [{ id: { in: ids } }, { recipeFamilyId: { in: ids } }] } satisfies Prisma.MealLibraryWhereInput;
}
