import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { publishMealClarificationSchema } from '@/domain/clinical-clarification.policy';
import { getReviewClaimCutoff, isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { lockUserProfile } from './profile-revision.service';
import { assertCurrentMealReviewContext } from './meal-case-context.service';
import { ClinicalClarificationService, currentClarificationContext } from './clinical-clarification.service';
import { ReviewRoutingService } from './review-routing.service';

/** Meal reviewers may ask questions; changes and resolutions stay in the Profile queue. */
export class MealClarificationService {
  static async publish(reviewerId: string, mealId: string, supplied: z.infer<typeof publishMealClarificationSchema>) {
    ClinicalClarificationService.assertEnabled();
    const input = publishMealClarificationSchema.parse(supplied);
    const owner = await prisma.mealPlan.findUnique({ where: { id: mealId }, select: { userId: true } });
    if (!owner) throw new AppError('Review case not found.', 404, 'REVIEW_NOT_FOUND');
    return prisma.$transaction(async tx => {
      await lockUserProfile(tx, owner.userId);
      const reviewer = await tx.nutritionistProfile.findUnique({ where: { id: reviewerId }, include: { user: true } });
      if (!reviewer || !isNutritionistEligibleForReview(reviewer))
        throw new AppError('A currently eligible RND is required.', 403, 'NUTRITIONIST_INELIGIBLE');
      // A successful retry still works after its publication released the meal claim or the week expired.
      const prior = await tx.clinicalClarificationForm.findUnique({
        where: { userId_requestKey: { userId: owner.userId, requestKey: input.requestKey } },
      });
      if (prior) {
        const source = (prior.profileSnapshot as Record<string, Prisma.JsonValue>)?.sourceReview as Record<string, Prisma.JsonValue> | undefined;
        if (prior.authorUserId !== reviewer.userId || prior.sourceMealPlanId !== mealId ||
          prior.sourceContextKey !== input.expectedContextKey || source?.scopeKey !== input.scopeKey ||
          source?.profileRevision !== input.profileRevision || prior.title !== input.title ||
          !isDeepStrictEqual(prior.questions, input.questions))
          throw new AppError('This request key was used for different questions.', 409, 'CLARIFICATION_RETRY_CONFLICT');
        return { id: prior.id };
      }
      await ReviewRoutingService.assertMeal(reviewerId, mealId, tx);
      const opened = await assertCurrentMealReviewContext(mealId, input.expectedContextKey, tx, reviewerId);
      if (!opened || opened.profileRevision !== input.profileRevision || opened.scopeKey !== input.scopeKey)
        throw new AppError('The case changed. Open the current review.', 409, 'MEAL_REVIEW_CONTEXT_CHANGED');
      const meal = await tx.mealPlan.findUniqueOrThrow({ where: { id: mealId } });
      if (meal.status !== 'PENDING_REVIEW' || meal.claimedByNutritionistId !== reviewerId ||
        !meal.claimedAt || meal.claimedAt < getReviewClaimCutoff())
        throw new AppError('Claim this meal before sending questions.', 409, 'MEAL_REVIEW_CLAIM_REQUIRED');

      await tx.clinicalProfileReviewEpoch.upsert({
        where: { userId: owner.userId },
        create: { userId: owner.userId, key: randomUUID() },
        update: { key: randomUUID() },
      });
      const reopened = await currentClarificationContext(tx, owner.userId);
      const form = await tx.clinicalClarificationForm.create({ data: {
        userId: owner.userId, authorUserId: reviewer.userId,
        profileRevision: reopened.profile.revision, scopeKey: reopened.scopeKey,
        sourceMealPlanId: mealId, sourceContextKey: opened.contextKey,
        profileSnapshot: { ...reopened.snapshot, sourceReview: {
          profileRevision: opened.profileRevision, scopeKey: opened.scopeKey,
          contextKey: opened.contextKey, snapshot: opened.snapshot,
        } },
        title: input.title, questions: input.questions, requestKey: input.requestKey,
      } });
      await tx.mealPlan.updateMany({ where: { userId: owner.userId, status: 'PENDING_REVIEW' },
        data: { claimedByNutritionistId: null, claimedAt: null } });
      await tx.clinicalProfileReview.updateMany({ where: { userId: owner.userId, status: { not: 'APPROVED' } },
        data: { claimedByNutritionistId: null, claimedAt: null } });
      await tx.auditEvent.create({ data: {
        actorUserId: reviewer.userId, action: 'CLINICAL_CLARIFICATION_PUBLISHED',
        entityType: 'ClinicalClarificationForm', entityId: form.id,
        metadata: { profileRevision: form.profileRevision, sourceMealPlanId: mealId,
          questionCount: input.questions.length, profileReopened: true },
      } });
      await tx.notification.create({ data: {
        userId: owner.userId, title: 'An RND requested clarification', type: 'REVIEW_REQUEST',
        message: 'Open Health details to answer the questions. Meal review is paused until your profile case is confirmed.',
        targetPath: '/profile/clinical-evidence',
      } });
      return { id: form.id };
    }, { timeout: 30_000 });
  }
}
