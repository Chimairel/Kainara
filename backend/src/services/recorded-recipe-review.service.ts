import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

/** Catalogue publication requires a recorded reviewer, decision date and exact source revision. */
export async function recordedRawRecipeReviewWhere(
  db: Pick<typeof prisma, 'mealBaseVerification'> = prisma
): Promise<Prisma.RawRecipeCandidateWhereInput> {
  const reviews = await db.mealBaseVerification.findMany({
    where: {
      targetKind: 'RAW_RECIPE',
      status: 'VERIFIED',
      reviewedByNutritionistId: { not: null },
      reviewedAt: { not: null },
    },
    select: { targetId: true, revisionKey: true },
  });
  return reviews.length
    ? { OR: reviews.map((review) => ({ id: review.targetId, contentSignature: review.revisionKey })) }
    : { id: { in: [] } };
}
