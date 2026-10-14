import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { assertReviewSwapClaim, reviewSwapVersion } from '@/domain/review-swap.policy';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { requiresEscalatedMealReview } from '@/domain/meal-plan-production-safety.policy';
import { savePreparedCorpusMeal } from './meal-plan-corpus-persistence.service';
import { assertFoodCompositionRevisions } from './generation-integrity.service';
import { assertObservedSourceStillAvailable } from './observed-source-guard.service';
import { lockUserProfile } from './profile-revision.service';
import { assertCurrentMealReviewContext } from './meal-case-context.service';
import { currentReviewProfile } from './meal-review-context.service';
import { ReviewRoutingService } from './review-routing.service';
import { assertRecipeNotRejectedForSlot } from './rejected-slot-recipes.service';
import { setMealLogAuditContext } from './meal-log-audit-context.service';
import type { ReviewNutrientFilters } from '@/domain/review-nutrient-filter.policy';
import { searchReviewSourceSwaps, REVIEW_SOURCE_PREFIX } from './review-source-search.service';
import { rawRecipeSourceRevision } from './panlasang-recipe-candidate.provider';

type Plan = Prisma.MealPlanGetPayload<{ include: { cycle: { include: { snapshot: true } } } }>;

export async function executeReviewSourceSwap(
  profileId: string,
  plan: Plan,
  input: {
    expectedContextKey?: string;
    libraryMealId: string;
    expectedVersion: string;
    expectedRecipeSignature: string;
    expectedServingKey?: string;
    expectedEvidenceRevision: number;
    filters?: ReviewNutrientFilters;
    note: string;
  }
) {
  const context = await loadPlanningNutritionContext(prisma, plan.userId, 'Planning profile unavailable.');
  const sourceId = input.libraryMealId.slice(REVIEW_SOURCE_PREFIX.length);
  const page = await searchReviewSourceSwaps(plan, context, input.filters ?? {}, undefined, sourceId);
  const selected = page.items.find((item) => item.option.id === input.libraryMealId);
  const source = selected ? await prisma.rawRecipeCandidate.findUnique({ where: { id: sourceId } }) : null;
  const candidate = selected && source ? { ...selected, source } : null;
  if (
    !candidate ||
    candidate.option.id !== input.libraryMealId ||
    candidate.option.servingKey !== input.expectedServingKey ||
    candidate.option.recipeSignature !== input.expectedRecipeSignature ||
    input.expectedEvidenceRevision !== 1 ||
    rawRecipeSourceRevision(candidate.source) !== candidate.sourceRevisionKey
  )
    throw new AppError('Candidate changed. Refresh the replacement search.', 409, 'REVIEW_SWAP_CHANGED');
  return prisma.$transaction(
    async (tx) => {
      await lockUserProfile(tx, plan.userId);
      await assertCurrentMealReviewContext(plan.id, input.expectedContextKey, tx, profileId);
      await ReviewRoutingService.assertMeal(profileId, plan.id, tx);
      const reviewer = await currentReviewProfile(tx, profileId);
      const current = await tx.mealPlan.findUniqueOrThrow({ where: { id: plan.id } });
      assertReviewSwapClaim(current, profileId);
      const currentContext = await loadPlanningNutritionContext(tx, plan.userId, 'Planning profile unavailable.');
      const cycle = await tx.mealPlanCycle.findUniqueOrThrow({ where: { id: plan.planGroupId } });
      if (
        !reviewer ||
        cycle.shoppingStartedAt ||
        cycle.supersededById ||
        current.scheduledDate < getStartOfManilaBusinessDay() ||
        reviewSwapVersion(current, currentContext.profile) !== input.expectedVersion
      )
        throw new AppError('Review or planning context changed. Refresh the case.', 409, 'REVIEW_SWAP_CHANGED');
      const key = `source:${candidate.source.id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      await tx.$queryRaw`SELECT id FROM "RawRecipeCandidate" WHERE id = ${candidate.source.id} FOR SHARE`;
      const currentSource = await tx.rawRecipeCandidate.findUniqueOrThrow({ where: { id: candidate.source.id } });
      if (
        rawRecipeSourceRevision(currentSource) !== candidate.sourceRevisionKey ||
        currentSource.contentSignature !== candidate.source.contentSignature ||
        ['calories', 'proteinG', 'carbsG', 'fatG', 'riceRole', 'riceRoleReviewStatus', 'includedRiceG'].some(
          (key) =>
            currentSource[key as keyof typeof currentSource] !== candidate.source[key as keyof typeof candidate.source]
        ) ||
        JSON.stringify(currentSource.ingredients) !== JSON.stringify(candidate.source.ingredients)
      )
        throw new AppError('Source serving evidence changed. Refresh the search.', 409, 'REVIEW_SWAP_CHANGED');
      const lineage = await tx.mealReviewLineage.findUnique({ where: { key }, select: { state: true } });
      if (lineage && lineage.state !== 'PUBLISHED')
        throw new AppError('Recipe is held for review.', 409, 'REVIEW_SWAP_CHANGED');
      await assertObservedSourceStillAvailable(tx, candidate.source.id);
      await assertFoodCompositionRevisions(tx, candidate.compositionRevisions);
      await assertRecipeNotRejectedForSlot(tx, plan, {
        sourceRawRecipeCandidateId: candidate.source.id,
        libraryMealId: null,
        baseRecipeSignature: candidate.source.contentSignature,
      });
      const pinned = await tx.mealPlan.findFirst({
        where: {
          planGroupId: plan.planGroupId,
          scheduledDate: plan.scheduledDate,
          mealType: plan.mealType,
          status: 'APPROVED',
          userSelectionPinnedAt: { not: null },
        },
        select: { id: true },
      });
      if (pinned) throw new AppError('This slot already has a member-selected meal.', 409, 'REVIEW_SWAP_CHANGED');
      const replacement = await savePreparedCorpusMeal(tx, {
        meal: candidate.meal,
        autoGeneralBase: false,
        sourceEvidence: candidate.source,
        userId: plan.userId,
        planGroupId: plan.planGroupId,
        planType: plan.planType,
        highRiskReviewRequired: requiresEscalatedMealReview(context.conditions, context.otherConditions),
        userConditions: context.conditions,
        userAllergens: context.allergens,
        planConditions: context.conditions,
        otherConditions: context.otherConditions,
        otherAllergies: context.otherAllergies,
        safetyEntries: context.user.safetyProfileEntries,
        riceFood: candidate.rice,
        selectionEvidence: {
          schemaVersion: 1,
          fallbackReasonCode: 'RND_SELECTED_REPLACEMENT',
          nutrientFilters: input.filters ?? {},
          reviewedPlate: candidate.option.nutrients,
          estimatedNutrientKeys: candidate.option.estimatedNutrientKeys,
          sourceCandidateId: candidate.source.id,
          servingKey: candidate.option.servingKey,
        } as Prisma.InputJsonObject,
      });
      await tx.mealPlan.update({
        where: { id: replacement.id },
        data: { claimedByNutritionistId: profileId, claimedAt: new Date() },
      });
      await tx.mealPlan.update({
        where: { id: plan.id },
        data: {
          status: 'CANCELLED',
          supersededByMealPlanId: replacement.id,
          claimedByNutritionistId: null,
          claimedAt: null,
        },
      });
      await setMealLogAuditContext(tx, reviewer.userId, 'RND swapped pending meal');
      await tx.mealLog.updateMany({ where: { mealPlanId: plan.id, status: 'PENDING' }, data: { status: 'VOIDED' } });
      await tx.groceryList.updateMany({
        where: { userId: plan.userId, planGroupId: plan.planGroupId },
        data: { isStale: true },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          actorName: reviewer.user.name,
          actorRole: 'NUTRITIONIST',
          action: 'MEAL_PLAN_SLOT_REPLACED_PENDING_REVIEW',
          entityType: 'MealPlan',
          entityId: replacement.id,
          metadata: {
            supersededMealPlanId: plan.id,
            reasonCode: 'RND_SELECTED_REPLACEMENT',
            rationale: input.note,
            reviewerProfileId: profileId,
            sourceCandidateId: candidate.source.id,
            nutrientFilters: input.filters ?? {},
            servingKey: candidate.option.servingKey,
            status: 'PENDING_REVIEW',
          } as Prisma.InputJsonObject,
        },
      });
      return { replaced: true, replacementPlanId: replacement.id };
    },
    { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
