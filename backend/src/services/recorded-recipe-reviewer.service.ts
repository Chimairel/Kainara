import prisma from '@/lib/prisma';
import { toPublicVerifier } from './meal-plan-presentation.service';

/** Two bounded reads per plan response; no per-meal query or invented historical reviewer. */
export async function recordedRecipeReviewers(
  meals: readonly {
    sourceRawRecipeCandidate?: { id?: string; contentSignature?: string } | null;
  }[]
) {
  const revisions = new Map(
    meals.flatMap((meal) => {
      const source = meal.sourceRawRecipeCandidate;
      return source?.id && source.contentSignature ? [[source.id, source.contentSignature] as const] : [];
    })
  );
  const result = new Map<string, NonNullable<ReturnType<typeof toPublicVerifier>>>();
  if (!revisions.size) return result;
  const records = await prisma.mealBaseVerification.findMany({
    where: {
      targetKind: 'RAW_RECIPE',
      targetId: { in: [...revisions.keys()] },
      status: 'VERIFIED',
      reviewedByNutritionistId: { not: null },
      reviewedAt: { not: null },
    },
    select: { targetId: true, revisionKey: true, reviewedByNutritionistId: true },
  });
  const current = records.filter((record) => record.revisionKey === revisions.get(record.targetId));
  const reviewerIds = [
    ...new Set(current.flatMap((record) => (record.reviewedByNutritionistId ? [record.reviewedByNutritionistId] : []))),
  ];
  if (!reviewerIds.length) return result;
  const profiles = await prisma.nutritionistProfile.findMany({
    where: { id: { in: reviewerIds } },
    include: { user: { select: { name: true, image: true } } },
  });
  for (const record of current) {
    const verifier = toPublicVerifier(profiles.find((profile) => profile.id === record.reviewedByNutritionistId));
    if (verifier) result.set(record.targetId, verifier);
  }
  return result;
}
