import { FlagStatus, MealLibraryStatus, NotificationType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';

async function eligibleReviewer(profileId: string) {
  const profile = await prisma.nutritionistProfile.findUnique({
    where: { id: profileId },
    include: { user: { select: { id: true, role: true, isSuspended: true } } },
  });
  if (!profile || !isNutritionistEligibleForReview(profile)) {
    throw new Error('Only a currently verified nutritionist may review a meal flag.');
  }
  return profile;
}

function reviewReason(value: string) {
  const reason = value.trim();
  if (reason.length < 10 || reason.length > 1000) throw new Error('Give a reason of 10 to 1000 characters.');
  return reason;
}

/** A source recipe and its serving variants are one meal for a base-meal flag. */
async function mealVariants(tx: Prisma.TransactionClient, mealId: string) {
  const selected = await tx.mealLibrary.findUnique({
    where: { id: mealId }, select: { id: true, sourceRawRecipeCandidateId: true },
  });
  if (!selected) throw new Error('Library meal not found.');
  return tx.mealLibrary.findMany({
    where: selected.sourceRawRecipeCandidateId
      ? { sourceRawRecipeCandidateId: selected.sourceRawRecipeCandidateId, status: { not: MealLibraryStatus.ARCHIVED } }
      : { id: selected.id },
    select: { id: true, mealName: true, status: true, sourceRawRecipeCandidateId: true },
  });
}

export async function flagWholeMeal(profileId: string, mealId: string, explanation: string) {
  const actor = await eligibleReviewer(profileId);
  const reason = reviewReason(explanation);
  return prisma.$transaction(async (tx) => {
    const variants = await mealVariants(tx, mealId);
    if (!variants.length || variants.some((variant) => variant.status !== MealLibraryStatus.APPROVED)) {
      throw new Error('All serving variants must be available before this meal can be flagged.');
    }
    const ids = variants.map((variant) => variant.id);
    const sourceId = variants[0]?.sourceRawRecipeCandidateId;
    const now = new Date();
    const changed = await tx.mealLibrary.updateMany({
      where: { id: { in: ids }, status: MealLibraryStatus.APPROVED },
      data: { status: MealLibraryStatus.FLAGGED },
    });
    if (changed.count !== ids.length) throw new Error('Meal status changed. Reload and try again.');
    await tx.mealLibraryFlag.createMany({
      data: ids.map((id) => ({
        mealLibraryId: id, flaggedByNutritionistId: actor.id, reason, status: FlagStatus.PENDING,
      })),
    });
    const users = await tx.mealPlan.findMany({
      where: {
        OR: [{ libraryMealId: { in: ids } }, ...(sourceId ? [{ sourceRawRecipeCandidateId: sourceId }] : [])],
        status: 'APPROVED', requiresSafetyRevalidation: false,
      },
      select: { userId: true }, distinct: ['userId'],
    });
    await tx.mealPlan.updateMany({
      where: {
        OR: [{ libraryMealId: { in: ids } }, ...(sourceId ? [{ sourceRawRecipeCandidateId: sourceId }] : [])],
        status: 'APPROVED',
      },
      data: { requiresSafetyRevalidation: true },
    });
    if (users.length) {
      const userIds = users.map((user) => user.userId);
      await tx.groceryList.updateMany({ where: { userId: { in: userIds } }, data: { isStale: true } });
      await tx.notification.createMany({ data: userIds.map((userId) => ({
        userId, type: NotificationType.MEAL_FLAGGED,
        title: 'A meal in your plan needs review',
        message: 'A recipe in your plan was flagged and is temporarily unavailable. Review your plan and grocery list for the current options.',
      })) });
    }
    await tx.auditEvent.create({ data: {
      actorUserId: actor.userId, action: 'MEAL_BASE_FLAGGED', entityType: 'MealLibrary', entityId: mealId,
      metadata: { reason, variantIds: ids, affectedUsers: users.length, flaggedAt: now.toISOString() },
    } });
    return { flaggedAt: now, affectedVariants: ids.length, affectedUsers: users.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Releasing a base meal never clears separately flagged approvals or restores old plan slots. */
export async function releaseWholeMeal(profileId: string, mealId: string, findings: string) {
  const actor = await eligibleReviewer(profileId);
  const rationale = reviewReason(findings);
  return prisma.$transaction(async (tx) => {
    const variants = await mealVariants(tx, mealId);
    if (!variants.length || variants.some((variant) => variant.status !== MealLibraryStatus.FLAGGED)) {
      throw new Error('All serving variants must be flagged before this meal can be released.');
    }
    const ids = variants.map((variant) => variant.id);
    const flags = await tx.mealLibraryFlag.findMany({
      where: { mealLibraryId: { in: ids }, status: FlagStatus.PENDING },
      select: { id: true, flaggedByNutritionistId: true },
    });
    if (flags.length !== ids.length) throw new Error('The meal flag record is incomplete.');
    if (flags.some((flag) => flag.flaggedByNutritionistId === actor.id)) {
      throw new Error('A different nutritionist must review and release this meal flag.');
    }
    const changed = await tx.mealLibrary.updateMany({
      where: { id: { in: ids }, status: MealLibraryStatus.FLAGGED },
      data: { status: MealLibraryStatus.APPROVED },
    });
    if (changed.count !== ids.length) throw new Error('Meal status changed. Reload and try again.');
    await tx.mealLibraryFlag.updateMany({
      where: { id: { in: flags.map((flag) => flag.id) }, status: FlagStatus.PENDING },
      data: { status: FlagStatus.RESOLVED_KEPT, resolvedAt: new Date() },
    });
    await tx.auditEvent.create({ data: {
      actorUserId: actor.userId, action: 'MEAL_BASE_FLAG_RELEASED', entityType: 'MealLibrary', entityId: mealId,
      metadata: { rationale, variantIds: ids, flagIds: flags.map((flag) => flag.id) },
    } });
    return { releasedVariants: ids.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
