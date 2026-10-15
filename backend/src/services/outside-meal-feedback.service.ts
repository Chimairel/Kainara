import { NotificationType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';

/** Advice about already logged food never revises nutrition or grants meal clearance. */
export async function sendOutsideMealFeedback(
  reviewerId: string,
  reviewId: string,
  expectedRevision: number | undefined,
  reason: string
) {
  const content = reason.trim();
  if (expectedRevision === undefined || content.length < 3 || content.length > 500)
    throw new AppError('Open the current food log and write your feedback.', 422, 'INVALID_FEEDBACK');
  return prisma.$transaction(
    async (tx) => {
      const now = new Date();
      const available: Prisma.OutsideMealReviewWhereInput = {
        id: reviewId,
        requestedByUserAt: { not: null },
        status: { in: ['PENDING', 'CLAIMED'] },
        outsideMealLogItem: { currentRevision: expectedRevision, mealLog: { status: 'DONE' } },
        OR: [
          { claimedByNutritionistId: null },
          { claimedByNutritionistId: reviewerId },
          { claimedAt: { lt: new Date(now.getTime() - 30 * 60_000) } },
        ],
      };
      const review = await tx.outsideMealReview.findFirst({
        where: available,
        include: { outsideMealLogItem: { include: { mealLog: true } } },
      });
      if (!review)
        throw new AppError(
          'This request changed or is being handled by another RND. Refresh the queue.',
          409,
          'FEEDBACK_CONFLICT'
        );
      const reviewer = await tx.nutritionistProfile.findUniqueOrThrow({
        where: { id: reviewerId },
        select: { userId: true },
      });
      const updated = await tx.outsideMealReview.updateMany({
        where: available,
        data: {
          status: 'FEEDBACK_SENT',
          reviewedAt: now,
          reviewedRevision: expectedRevision,
          claimedByNutritionistId: null,
          claimedAt: null,
          claimedRevision: null,
        },
      });
      if (updated.count !== 1)
        throw new AppError('This feedback request has already changed.', 409, 'FEEDBACK_CONFLICT');
      const item = review.outsideMealLogItem;
      await tx.outsideMealReviewMessage.create({
        data: {
          outsideMealReviewId: review.id,
          sender: 'NUTRITIONIST',
          authorUserId: reviewer.userId,
          itemRevision: expectedRevision,
          content,
        },
      });
      await tx.notification.create({
        data: {
          userId: item.mealLog.userId,
          title: 'RND feedback on your food',
          message: `Feedback on “${item.name}”: ${content}`,
          type: NotificationType.OUTSIDE_MEAL_REVIEWED,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'OUTSIDE_MEAL_FEEDBACK_SENT',
          entityType: 'OutsideMealLogItem',
          entityId: item.id,
          metadata: {
            reviewId,
            reviewedRevision: expectedRevision,
            reason: content,
            nutritionUnchanged: true,
            food: { name: item.name, source: item.source, nutritionStatus: item.nutritionStatus },
          },
        },
      });
      return {
        reviewId,
        itemId: item.id,
        status: 'FEEDBACK_SENT',
        reviewedRevision: expectedRevision,
        revision: expectedRevision,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 15_000 }
  );
}
