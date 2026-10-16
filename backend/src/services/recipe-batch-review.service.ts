import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import {
  recipeBatchReviewIssues,
  recipeBatchReviewSchema,
  recipeReviewEvidenceHash,
} from '@/domain/recipe-batch-review.policy';
import {
  MealBaseVerificationService,
  mealBaseVerificationTarget,
  rawBaseVerificationEvidence,
} from './meal-base-verification.service';

/** Authenticated RND export. It does not create claims, decisions or approvals. */
export async function recipeBatchReviewPreview(cursor?: string) {
  const rows = await prisma.rawRecipeCandidate.findMany({
    where: { sourceName: 'PANLASANG_PINOY', status: 'AVAILABLE', libraryVariants: { none: { status: 'FLAGGED' } } },
    orderBy: { id: 'asc' },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, 50);
  const reviews = await prisma.mealBaseVerification.findMany({
    where: { targetKind: 'RAW_RECIPE', targetId: { in: page.map((row) => row.id) } },
    select: { targetId: true, revisionKey: true, status: true, reviewedByNutritionistId: true, reviewedAt: true },
  });
  return {
    nextCursor: rows.length > 50 ? page[page.length - 1].id : null,
    items: page.map((row) => {
      const evidence = rawBaseVerificationEvidence(row);
      const review = reviews.find((item) => item.targetId === row.id && item.revisionKey === row.contentSignature);
      return {
        ...evidence,
        evidenceHash: recipeReviewEvidenceHash(evidence),
        issues: recipeBatchReviewIssues(evidence),
        alreadyVerified: Boolean(review?.status === 'VERIFIED' && review.reviewedByNutritionistId && review.reviewedAt),
        reviewed: false,
        rationale: '',
      };
    }),
  };
}

/** Each item uses the ordinary claim/serializable decision path, with explicit partial results. */
export async function confirmRecipeBatchReview(profileId: string, input: z.infer<typeof recipeBatchReviewSchema>) {
  const batch = recipeBatchReviewSchema.parse(input);
  const results: Array<{ id: string; status: 'VERIFIED' | 'ALREADY_VERIFIED' | 'FAILED'; message?: string }> = [];
  for (const item of batch.items) {
    let claimed = false;
    try {
      const row = await mealBaseVerificationTarget('RAW_RECIPE', item.id);
      if (row.source !== 'PANLASANG_PINOY')
        throw new AppError('Use the existing review queue for this recipe.', 409, 'BATCH_SOURCE_UNSUPPORTED');
      if (row.revisionKey !== item.revisionKey || recipeReviewEvidenceHash(row) !== item.evidenceHash)
        throw new AppError('Recipe changed. Export and review it again.', 409, 'RECIPE_REVIEW_STALE');
      const issues = recipeBatchReviewIssues(row);
      if (issues.length) throw new AppError(issues.join(' '), 409, 'RECIPE_EVIDENCE_INCOMPLETE');
      const existing = await prisma.mealBaseVerification.findUnique({
        where: {
          targetKind_targetId_revisionKey: {
            targetKind: 'RAW_RECIPE',
            targetId: item.id,
            revisionKey: item.revisionKey,
          },
        },
      });
      if (existing?.status === 'VERIFIED' && existing.reviewedByNutritionistId && existing.reviewedAt) {
        results.push({ id: item.id, status: 'ALREADY_VERIFIED' });
        continue;
      }
      await MealBaseVerificationService.claim(profileId, 'RAW_RECIPE', item.id);
      claimed = true;
      await MealBaseVerificationService.decide(
        profileId,
        'RAW_RECIPE',
        item.id,
        'VERIFIED',
        item.rationale,
        item.revisionKey,
        item.evidenceHash
      );
      claimed = false;
      results.push({ id: item.id, status: 'VERIFIED' });
    } catch (error) {
      if (claimed) {
        // Release only this request's claim; never clear a competing review or decision.
        await prisma.mealBaseVerification.updateMany({
          where: {
            targetKind: 'RAW_RECIPE',
            targetId: item.id,
            revisionKey: item.revisionKey,
            claimedByNutritionistId: profileId,
            status: { in: ['PENDING', 'REJECTED'] },
          },
          data: { claimedByNutritionistId: null, claimedAt: null },
        });
      }
      results.push({
        id: item.id,
        status: 'FAILED',
        message: sanitizeErrorMessage(error, 'Review could not complete. Refresh before retrying.'),
      });
    }
  }
  return { results };
}
