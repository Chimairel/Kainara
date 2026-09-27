import 'dotenv/config';
import { MealPlanStatus, Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { adaptUserSafetyRestrictions } from '../src/domain/structured-restriction.adapter';

/** One-time cleanup of pre-policy queue rows. Dry run unless --apply is passed. */
async function main() {
  const pending = await prisma.mealPlan.findMany({
    where: { status: MealPlanStatus.PENDING_REVIEW },
    include: {
      user: { include: { userProfile: true, healthConditions: true, allergies: true, safetyProfileEntries: true } },
      clinicalEvidence: { select: { id: true } },
      reviewDecisions: { select: { id: true } },
      mealLogs: { select: { id: true } },
      sourceRawRecipeCandidate: { select: { sourceName: true } },
    },
  });
  const eligible = pending.filter((plan) => {
    const profile = plan.user.userProfile;
    if (!profile || plan.sourceRawRecipeCandidate?.sourceName !== 'PANLASANG_PINOY' ||
      plan.highRiskReviewRequired || plan.reviewApprovalCount || plan.reviewDecisions.length ||
      plan.clinicalEvidence.length || plan.mealLogs.length) return false;
    const restrictions = adaptUserSafetyRestrictions({
      healthConditions: plan.user.healthConditions.map((item) => item.condition),
      allergies: plan.user.allergies.map((item) => item.allergen),
      otherConditions: profile.otherConditions,
      otherAllergies: profile.otherAllergies,
      safetyEntries: plan.user.safetyProfileEntries,
    });
    return !restrictions.requiresReview && !restrictions.conditions.length && !restrictions.allergies.length &&
      !restrictions.customConditions.length && !restrictions.customFoodRestrictions.length;
  });
  console.log(JSON.stringify({ pending: pending.length, eligibleToRetire: eligible.length, retained: pending.length - eligible.length }));
  if (!process.argv.includes('--apply') || !eligible.length) return;
  await prisma.$transaction(async (tx) => {
    const result = await tx.mealPlan.updateMany({
      where: { id: { in: eligible.map((plan) => plan.id) }, status: MealPlanStatus.PENDING_REVIEW },
      data: { status: MealPlanStatus.CANCELLED, claimedByNutritionistId: null, claimedAt: null },
    });
    if (result.count !== eligible.length) throw new Error('Queue changed during cleanup; transaction rolled back.');
    await tx.groceryList.updateMany({
      where: { userId: { in: [...new Set(eligible.map((plan) => plan.userId))] } },
      data: { isStale: true },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: null,
        action: 'UNRESTRICTED_LEGACY_REVIEW_ROWS_RETIRED',
        entityType: 'MealPlan',
        entityId: '2026-09-27-unrestricted-queue',
        metadata: { count: result.count, planIds: eligible.map((plan) => plan.id) } as Prisma.InputJsonObject,
      },
    });
    console.log(JSON.stringify({ retired: result.count }));
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
