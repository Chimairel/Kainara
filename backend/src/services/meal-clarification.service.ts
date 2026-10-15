import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { publishMealClarificationSchema, resolveClarificationSchema } from '@/domain/clinical-clarification.policy';
import { getReviewClaimCutoff, isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { lockUserProfile } from './profile-revision.service';
import { assertCurrentMealReviewContext } from './meal-case-context.service';
import { ClinicalClarificationService, currentClarificationContext } from './clinical-clarification.service';
import { ReviewRoutingService } from './review-routing.service';

/** Meal questions stay in their case; profile questions retain the explicit profile handoff. */
export class MealClarificationService {
  static async publish(reviewerId: string, mealId: string, supplied: z.input<typeof publishMealClarificationSchema>) {
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
          prior.purpose !== input.purpose || source?.contextKey !== input.expectedContextKey || source?.scopeKey !== input.scopeKey ||
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

      if (input.purpose === 'PROFILE') await tx.clinicalProfileReviewEpoch.upsert({
        where: { userId: owner.userId },
        create: { userId: owner.userId, key: randomUUID() },
        update: { key: randomUUID() },
      });
      const reopened = await currentClarificationContext(tx, owner.userId);
      const form = await tx.clinicalClarificationForm.create({ data: {
        purpose: input.purpose,
        userId: owner.userId, authorUserId: reviewer.userId,
        profileRevision: reopened.profile.revision, scopeKey: reopened.scopeKey,
        sourceMealPlanId: mealId, sourceContextKey: input.purpose === 'MEAL' ? opened.baseContextKey : opened.contextKey,
        profileSnapshot: { ...reopened.snapshot, sourceReview: {
          profileRevision: opened.profileRevision, scopeKey: opened.scopeKey,
          contextKey: opened.contextKey, snapshot: opened.snapshot,
        } },
        title: input.title, questions: input.questions, requestKey: input.requestKey,
      } });
      await tx.mealPlan.updateMany({ where: { userId: owner.userId, status: 'PENDING_REVIEW',
          ...(input.purpose === 'MEAL' ? { id: mealId } : {}) },
        data: { claimedByNutritionistId: null, claimedAt: null } });
      if (input.purpose === 'PROFILE') await tx.clinicalProfileReview.updateMany({ where: { userId: owner.userId, status: { not: 'APPROVED' } },
        data: { claimedByNutritionistId: null, claimedAt: null } });
      await tx.auditEvent.create({ data: {
        actorUserId: reviewer.userId, action: 'CLINICAL_CLARIFICATION_PUBLISHED',
        entityType: 'ClinicalClarificationForm', entityId: form.id,
        metadata: { profileRevision: form.profileRevision, sourceMealPlanId: mealId,
          questionCount: input.questions.length, purpose: input.purpose, profileReopened: input.purpose === 'PROFILE' },
      } });
      await tx.notification.create({ data: {
        userId: owner.userId, title: input.purpose === 'MEAL' ? `Question about ${meal.mealName}` : 'An RND requested profile clarification', type: 'REVIEW_REQUEST',
        message: input.purpose === 'MEAL'
          ? 'Open Meals to answer your RND’s question. Only this meal is waiting; your profile approval is unchanged.'
          : 'Open Health details to answer the questions. Meal review is paused until your profile case is confirmed.',
        targetPath: input.purpose === 'MEAL' ? `/meals?tab=plan&questions=${form.id}` : '/profile/clinical-evidence',
      } });
      return { id: form.id };
    }, { timeout: 30_000 });
  }

  static async resolve(reviewerId: string, mealId: string, formId: string,
    supplied: z.infer<typeof resolveClarificationSchema> & { expectedContextKey: string }) {
    ClinicalClarificationService.assertEnabled();
    const input = resolveClarificationSchema.parse({ profileRevision: supplied.profileRevision, scopeKey: supplied.scopeKey,
      responseId: supplied.responseId, rationale: supplied.rationale });
    const owner = await prisma.mealPlan.findFirstOrThrow({ where: { id: mealId }, select: { userId: true } });
    return prisma.$transaction(async tx => {
      await lockUserProfile(tx, owner.userId);
      await ReviewRoutingService.assertMeal(reviewerId, mealId, tx);
      const reviewer = await tx.nutritionistProfile.findFirst({ where: { id: reviewerId }, include: { user: true } });
      if (!reviewer || !isNutritionistEligibleForReview(reviewer))
        throw new AppError('A currently eligible RND is required.', 403, 'NUTRITIONIST_INELIGIBLE');
      const form = await tx.clinicalClarificationForm.findFirst({
        where: { id: formId, userId: owner.userId, sourceMealPlanId: mealId, purpose: 'MEAL' },
        include: { responses: { orderBy: { version: 'desc' }, take: 1 }, resolution: true },
      });
      if (form?.resolution) {
        if (form.resolution.responseId === input.responseId && form.resolution.reviewerUserId === reviewer.userId &&
          form.resolution.rationale === input.rationale) return { id: form.resolution.id };
        throw new AppError('This question is already resolved.', 409, 'CLARIFICATION_RESOLVED');
      }
      const opened = await assertCurrentMealReviewContext(mealId, supplied.expectedContextKey, tx, reviewerId);
      const meal = await tx.mealPlan.findFirstOrThrow({ where: { id: mealId } });
      if (meal.status !== 'PENDING_REVIEW' || meal.claimedByNutritionistId !== reviewerId ||
        !meal.claimedAt || meal.claimedAt < getReviewClaimCutoff())
        throw new AppError('Claim this meal before resolving its questions.', 409, 'MEAL_REVIEW_CLAIM_REQUIRED');
      if (!form || form.sourceContextKey !== opened?.baseContextKey || form.scopeKey !== input.scopeKey ||
        form.profileRevision !== input.profileRevision || form.responses[0]?.id !== input.responseId)
        throw new AppError('This meal or its answers changed. Open the current case.', 409, 'CLARIFICATION_STALE');
      const resolution = await tx.clinicalClarificationResolution.create({ data: {
        formId, responseId: input.responseId, reviewerUserId: reviewer.userId, rationale: input.rationale,
      } });
      await tx.auditEvent.create({ data: { actorUserId: reviewer.userId, action: 'CLINICAL_CLARIFICATION_RESOLVED',
        entityType: 'ClinicalClarificationForm', entityId: formId,
        metadata: { sourceMealPlanId: mealId, responseId: input.responseId, purpose: 'MEAL' } } });
      return { id: resolution.id };
    });
  }
}
