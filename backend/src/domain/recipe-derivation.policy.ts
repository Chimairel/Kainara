export function recipeDerivationKind(
  original: readonly { foodItemId: string | null }[],
  proposed: readonly { foodItemId: string }[]
) {
  const oldIds = original.map((item) => item.foodItemId).sort();
  const newIds = proposed.map((item) => item.foodItemId).sort();
  return oldIds.length === newIds.length && oldIds.every((id, index) => id && id === newIds[index])
    ? ('SERVING_VERSION' as const)
    : ('ADAPTED' as const);
}

export function assertIndependentRecipeReviewer(authorId: string | null | undefined, reviewerId: string) {
  if (authorId && authorId === reviewerId)
    throw new Error('A different nutritionist must review a recipe you authored or adapted.');
}
