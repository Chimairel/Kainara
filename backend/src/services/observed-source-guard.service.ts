import type { Prisma } from '@prisma/client';

export async function assertObservedSourceStillAvailable(tx: Prisma.TransactionClient, rawCandidateId: string | null) {
  if (!rawCandidateId) return;
  const candidate = await tx.rawRecipeCandidate.findUnique({
    where: { id: rawCandidateId },
    select: {
      sourceName: true,
      status: true,
      libraryVariants: { where: { status: 'FLAGGED' }, select: { id: true }, take: 1 },
    },
  });
  if (candidate?.libraryVariants.length)
    throw new Error('This recipe is flagged for base-meal review. Replace the candidate before approving.');
  if (candidate?.sourceName === 'USER_OBSERVED' && candidate.status !== 'AVAILABLE')
    throw new Error('This observed recipe was withdrawn. Replace the candidate before approving.');
}
