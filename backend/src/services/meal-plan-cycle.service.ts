import prisma from '@/lib/prisma';
import { MembershipService } from './membership.service';
import { admittedLibraryBaseIds } from './meal-base-admission.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { deriveMealPlanCycleLifecycle, getManilaDateKey, getManilaMidnight } from '@/domain/meal-plan-cycle.policy';
import {
  ConditionClearanceState,
  MealPlanStatus,
  MealPlanCycleStatus,
  MealLibrarySafetyEvidenceStatus,
  MealLibraryStatus,
  Prisma,
  ProfileCycleAdaptationState,
} from '@prisma/client';

type CycleClient = Pick<Prisma.TransactionClient, 'mealPlanCycle'> &
  Partial<Pick<Prisma.TransactionClient, 'user' | 'clinicalProfileReview'>>;

export const mealPlanCycleSummarySelect = {
  id: true,
  planType: true,
  cycleRevision: true,
  startDate: true,
  endDate: true,
  preparationOpensAt: true,
  shoppingDeadlineAt: true,
  expectedSlotCount: true,
  status: true,
  profileAdaptationState: true,
  requestedProfileRevision: true,
  requestedSafetyRevision: true,
  acknowledgedProfileRevision: true,
  pendingProfileChangeKinds: true,
  deadlineOutcome: true,
  readyAt: true,
  activatedAt: true,
  incompleteAcknowledgedAt: true,
  shoppingStartedAt: true,
  supersededAt: true,
  supersededById: true,
  snapshot: {
    select: {
      profileRevision: true,
      safetyRevision: true,
      dailyCalorieTarget: true,
      generatedAt: true,
    },
  },
  _count: { select: { mealPlans: true } },
} satisfies Prisma.MealPlanCycleSelect;

export class MealPlanCycleService {
  static getBusinessDay(now: Date = new Date()): Date {
    return getManilaMidnight(getManilaDateKey(now));
  }

  /**
   * Returns only slots whose complete reusable/manual evidence is current for
   * this cycle's user. Grocery projection and lifecycle readiness share this
   * authority so APPROVED alone can never leak an invalidated meal.
   */
  static async getClearedMealPlanIds(
    userId: string,
    cycleId: string,
    now: Date = new Date(),
    client: CycleClient = prisma
  ): Promise<string[]> {
    // Legacy approved slots cannot become actionable before the current
    // restricted profile has received its separate nutritionist review.
    const profileClient =
      client.user && client.clinicalProfileReview
        ? (client as Pick<Prisma.TransactionClient, 'user' | 'clinicalProfileReview'>)
        : prisma;
    if (!(await ClinicalProfileReviewService.hasCurrentApproval(userId, profileClient))) return [];
    const cycle = await client.mealPlanCycle.findFirst({
      where: { id: cycleId, userId },
      select: {
        user: {
          select: {
            healthConditions: { select: { condition: true } },
            allergies: { select: { allergen: true } },
            userProfile: { select: { otherConditions: true, otherAllergies: true } },
            safetyProfileEntries: {
              select: { domain: true, canonicalCode: true, originalText: true, supportState: true },
            },
          },
        },
        mealPlans: {
          where: { status: { not: MealPlanStatus.CANCELLED } },
          select: {
            id: true,
            status: true,
            requiresSafetyRevalidation: true,
            libraryMealId: true,
            baseRecipeSignature: true,
            composedServingSignature: true,
            safetyPolicyVersion: true,
            highRiskReviewRequired: true,
            reviewApprovalCount: true,
            profileApproval: {
              select: {
                safetyScopeKey: true,
                recipeSignature: true,
                evidenceRevision: true,
                reviewPolicyVersion: true,
                reviewDueAt: true,
                flaggedAt: true,
                reviewerNutritionist: {
                  include: { user: { select: { role: true, isSuspended: true } } },
                },
              },
            },
            candidateProvenance: true,
            sourceRawRecipeCandidate: {
              select: {
                sourceName: true,
                status: true,
                publishedNutrition: true,
                libraryVariants: { where: { status: 'FLAGGED' }, select: { id: true }, take: 1 },
              },
            },
            libraryMeal: {
              select: {
                id: true,
                description: true,
                sourceRawRecipeCandidateId: true,
                sourceRawRecipeCandidate: { select: { sourceName: true, status: true, contentSignature: true } },
                status: true,
                safetyEvidenceStatus: true,
                safetyEvidenceRevision: true,
                recipeSignature: true,
              },
            },
            servingComponents: {
              select: {
                componentType: true,
                foodItemId: true,
                evidenceSource: true,
                foodItem: { select: { compositionRevision: true } },
              },
            },
            clearanceUsages: {
              select: {
                condition: true,
                composedServingSignature: true,
                clearance: {
                  select: {
                    state: true,
                    recipeSignature: true,
                    evidenceRevision: true,
                    composedServingSignature: true,
                    expiresAt: true,
                    auditDueAt: true,
                    userScopeId: true,
                  },
                },
              },
            },
            reviewDecisions: {
              where: { decision: 'APPROVE' },
              select: { nutritionistProfileId: true },
            },
          },
        },
      },
    });
    if (!cycle) return [];
    const requiredConditions = new Set(
      cycle.user.healthConditions.map((item) => item.condition).filter((condition) => condition !== 'NONE')
    );
    const safetyRestrictions = adaptUserSafetyRestrictions({
      healthConditions: cycle.user.healthConditions.map((item) => item.condition),
      allergies: cycle.user.allergies.map((item) => item.allergen),
      otherConditions: cycle.user.userProfile?.otherConditions,
      otherAllergies: cycle.user.userProfile?.otherAllergies,
      safetyEntries: cycle.user.safetyProfileEntries,
    });
    const profileScope = mealApprovalSafetyScope({
      conditions: cycle.user.healthConditions.map((item) => item.condition),
      allergens: cycle.user.allergies.map((item) => item.allergen),
      otherConditions: cycle.user.userProfile?.otherConditions,
      otherAllergies: cycle.user.userProfile?.otherAllergies,
      safetyEntries: cycle.user.safetyProfileEntries,
    });
    const libraries = cycle.mealPlans.flatMap((meal) => (meal.libraryMeal ? [meal.libraryMeal] : []));
    const admittedLibraries = await admittedLibraryBaseIds(libraries);
    const generatedSignatures = [
      ...new Set(
        cycle.mealPlans.flatMap((meal) =>
          meal.candidateProvenance === 'AI_FROM_SCRATCH' && meal.baseRecipeSignature ? [meal.baseRecipeSignature] : []
        )
      ),
    ];
    const verifiedGenerated = generatedSignatures.length
      ? await prisma.mealBaseVerification.findMany({
          where: { targetKind: 'GENERATED_RECIPE', status: 'VERIFIED', targetId: { in: generatedSignatures } },
          select: { targetId: true, revisionKey: true },
        })
      : [];
    const verifiedGeneratedSignatures = new Set(
      verifiedGenerated.flatMap((row) => (row.targetId === row.revisionKey ? [row.targetId] : []))
    );
    return cycle.mealPlans
      .filter((meal) => {
        if (
          meal.status !== MealPlanStatus.APPROVED ||
          meal.requiresSafetyRevalidation ||
          !meal.baseRecipeSignature ||
          !meal.composedServingSignature ||
          !meal.safetyPolicyVersion
        ) {
          return false;
        }
        if (
          meal.servingComponents?.some(
            (component) =>
              component.componentType === 'COOKED_RICE' &&
              (!component.foodItem || component.evidenceSource !== `FNRI:${component.foodItem.compositionRevision}`)
          )
        ) {
          return false;
        }
        if (meal.libraryMealId) {
          const library = meal.libraryMeal;
          if (
            !library ||
            !admittedLibraries.has(library.id) ||
            library.status !== MealLibraryStatus.APPROVED ||
            library.recipeSignature !== meal.baseRecipeSignature
          ) {
            return false;
          }
          const profileApproval = meal.profileApproval;
          const profileApprovalCurrent =
            profileApproval &&
            profileScope.supported &&
            safetyRestrictions.conditions.length === 0 &&
            profileApproval.safetyScopeKey === profileScope.key &&
            profileApproval.recipeSignature === library.recipeSignature &&
            profileApproval.evidenceRevision === library.safetyEvidenceRevision &&
            profileApproval.reviewPolicyVersion === MEAL_PLAN_SAFETY_POLICY_VERSION &&
            !profileApproval.flaggedAt &&
            isNutritionistEligibleForReview(profileApproval.reviewerNutritionist, now);
          const distinctCaseReviewers = new Set(meal.reviewDecisions.map((decision) => decision.nutritionistProfileId));
          const caseReviewComplete = distinctCaseReviewers.size >= 1;
          // An allergy-absent declaration belongs to the base recipe. Legacy
          // auto-approved allergy plans without a scoped approval or an actual
          // case decision must not remain usable after the policy correction.
          if (safetyRestrictions.allergies.length && !profileApprovalCurrent) {
            if (!caseReviewComplete) return false;
          }
          if (!profileApprovalCurrent && library.safetyEvidenceStatus !== MealLibrarySafetyEvidenceStatus.COMPLETE) {
            return false;
          }
          const validConditions = new Set(
            meal.clearanceUsages
              .filter(
                (usage) =>
                  usage.clearance.state === ConditionClearanceState.ACTIVE &&
                  usage.clearance.recipeSignature === library.recipeSignature &&
                  usage.clearance.evidenceRevision === library.safetyEvidenceRevision &&
                  usage.composedServingSignature === meal.composedServingSignature &&
                  (!usage.clearance.composedServingSignature ||
                    usage.clearance.composedServingSignature === meal.composedServingSignature) &&
                  (!usage.clearance.expiresAt || usage.clearance.expiresAt > now) &&
                  (!usage.clearance.userScopeId || usage.clearance.userScopeId === userId)
              )
              .map((usage) => usage.condition)
          );
          const clearedForConditions = [...requiredConditions].every((condition) => validConditions.has(condition));
          const directlyReviewedCase = meal.clearanceUsages.length === 0 && caseReviewComplete;
          return (
            (clearedForConditions || directlyReviewedCase) && (!profileApproval || Boolean(profileApprovalCurrent))
          );
        }
        if (meal.candidateProvenance === 'RAW_RECIPE_CORPUS' && meal.reviewApprovalCount === 0) {
          return (
            !safetyRestrictions.requiresReview &&
            safetyRestrictions.conditions.length === 0 &&
            safetyRestrictions.allergies.length === 0 &&
            safetyRestrictions.customConditions.length === 0 &&
            safetyRestrictions.customFoodRestrictions.length === 0 &&
            meal.sourceRawRecipeCandidate?.sourceName === 'PANLASANG_PINOY' &&
            meal.sourceRawRecipeCandidate.status === 'AVAILABLE' &&
            meal.sourceRawRecipeCandidate.libraryVariants.length === 0 &&
            Boolean(meal.sourceRawRecipeCandidate.publishedNutrition)
          );
        }
        if (
          meal.candidateProvenance === 'AI_FROM_SCRATCH' &&
          !verifiedGeneratedSignatures.has(meal.baseRecipeSignature)
        )
          return false;
        const distinctApprovers = new Set(meal.reviewDecisions.map((decision) => decision.nutritionistProfileId));
        const requiredApprovals = 1;
        return meal.reviewApprovalCount >= requiredApprovals && distinctApprovers.size >= requiredApprovals;
      })
      .map((meal) => meal.id);
  }

  static async synchronizeLifecycle(
    userId: string,
    now: Date = new Date(),
    client: CycleClient = prisma,
    clearedIdsByCycle?: Map<string, string[]>
  ): Promise<void> {
    const cycles = await client.mealPlanCycle.findMany({
      where: {
        userId,
        status: { not: MealPlanCycleStatus.SUPERSEDED },
      },
      select: {
        id: true,
        status: true,
        profileAdaptationState: true,
        startDate: true,
        endDate: true,
        shoppingDeadlineAt: true,
        expectedSlotCount: true,
        deadlineOutcome: true,
        readyAt: true,
        activatedAt: true,
        shoppingStartedAt: true,
        groceryList: { select: { isStale: true } },
        mealPlans: {
          where: { status: { not: MealPlanStatus.CANCELLED } },
          select: {
            id: true,
            mealType: true,
            scheduledDate: true,
            createdAt: true,
            reviewedAt: true,
          },
        },
      },
    });

    // The current and upcoming cycles have independent clearance evidence.
    // On a normal read, overlap their remote database reads before applying
    // lifecycle updates. Keep transaction-backed calls in their original
    // sequence so a caller's transaction observes its own writes in order.
    const prefetchedClearance =
      client === prisma
        ? new Map(
            await Promise.all(
              cycles
                .filter((cycle) => cycle.profileAdaptationState === ProfileCycleAdaptationState.CURRENT)
                .map(
                  async (cycle) => [cycle.id, await this.getClearedMealPlanIds(userId, cycle.id, now, client)] as const
                )
            )
          )
        : null;

    for (const cycle of cycles) {
      if (cycle.profileAdaptationState !== ProfileCycleAdaptationState.CURRENT) {
        const gatedStatus =
          cycle.profileAdaptationState === ProfileCycleAdaptationState.SAFETY_REVALIDATION_REQUIRED
            ? MealPlanCycleStatus.REVALIDATION_REQUIRED
            : MealPlanCycleStatus.PREPARING;
        if (cycle.status !== gatedStatus) {
          await client.mealPlanCycle.updateMany({
            where: { id: cycle.id, userId, status: cycle.status },
            data: { status: gatedStatus },
          });
        }
        continue;
      }
      const clearedIds =
        prefetchedClearance?.get(cycle.id) ?? (await this.getClearedMealPlanIds(userId, cycle.id, now, client));
      clearedIdsByCycle?.set(cycle.id, clearedIds);
      const clearedMealPlanIds = new Set(clearedIds);
      const clearedMeals = cycle.mealPlans.filter((meal) => clearedMealPlanIds.has(meal.id));
      if (
        client === prisma &&
        cycle.status !== MealPlanCycleStatus.COMPLETED &&
        clearedMeals.length &&
        cycle.startDate <= getManilaMidnight(getManilaDateKey(now)) &&
        cycle.endDate >= getManilaMidnight(getManilaDateKey(now))
      ) {
        const availableAt = new Date(
          Math.max(
            cycle.startDate.getTime(),
            Math.min(...clearedMeals.map((meal) => (meal.reviewedAt ?? meal.createdAt).getTime()))
          )
        );
        await MembershipService.startTrial(userId, availableAt, now);
      }
      const clearedSlots = new Set(clearedMeals.map((meal) => `${meal.scheduledDate.getTime()}:${meal.mealType}`));
      const allSlotsCleared = clearedSlots.size >= cycle.expectedSlotCount;
      const groceryProjectionReady = Boolean(cycle.groceryList && !cycle.groceryList.isStale);
      const hasCompleteSlotSet = allSlotsCleared && groceryProjectionReady;
      const observedReadyAt = hasCompleteSlotSet
        ? (cycle.readyAt ??
          new Date(Math.max(...clearedMeals.map((meal) => (meal.reviewedAt ?? meal.createdAt).getTime()))))
        : cycle.readyAt;
      const next = deriveMealPlanCycleLifecycle({
        ...cycle,
        readyAt: observedReadyAt,
        now,
        hasAnySlots: cycle.mealPlans.length > 0,
        hasCompleteSlotSet,
      });
      const readyAt = observedReadyAt;
      const activatedAt = next.status === MealPlanCycleStatus.ACTIVE ? (cycle.activatedAt ?? now) : cycle.activatedAt;
      if (
        next.status === cycle.status &&
        next.deadlineOutcome === cycle.deadlineOutcome &&
        readyAt === cycle.readyAt &&
        activatedAt === cycle.activatedAt
      ) {
        continue;
      }
      await client.mealPlanCycle.updateMany({
        where: { id: cycle.id, userId, status: cycle.status },
        data: {
          status: next.status,
          deadlineOutcome: next.deadlineOutcome,
          readyAt,
          activatedAt,
        },
      });
    }
  }

  static async getCurrentCycle(userId: string, now: Date = new Date()) {
    await this.synchronizeLifecycle(userId, now);
    const businessDay = this.getBusinessDay(now);
    return prisma.mealPlanCycle.findFirst({
      where: {
        userId,
        startDate: { lte: businessDay },
        endDate: { gte: businessDay },
        status: { not: MealPlanCycleStatus.SUPERSEDED },
      },
      orderBy: [{ startDate: 'desc' }, { cycleRevision: 'desc' }],
      select: mealPlanCycleSummarySelect,
    });
  }

  /** Reuse the clearance already checked during lifecycle synchronization on this read. */
  static async getCurrentCycleWithClearance(userId: string, now: Date = new Date()) {
    const clearedIdsByCycle = new Map<string, string[]>();
    await this.synchronizeLifecycle(userId, now, prisma, clearedIdsByCycle);
    const businessDay = this.getBusinessDay(now);
    const cycle = await prisma.mealPlanCycle.findFirst({
      where: {
        userId,
        startDate: { lte: businessDay },
        endDate: { gte: businessDay },
        status: { not: MealPlanCycleStatus.SUPERSEDED },
      },
      orderBy: [{ startDate: 'desc' }, { cycleRevision: 'desc' }],
      select: mealPlanCycleSummarySelect,
    });
    return {
      cycle,
      clearedIds: cycle
        ? (clearedIdsByCycle.get(cycle.id) ?? (await this.getClearedMealPlanIds(userId, cycle.id, now)))
        : [],
    };
  }

  static async getUpcomingCycle(userId: string, now: Date = new Date()) {
    await this.synchronizeLifecycle(userId, now);
    const businessDay = this.getBusinessDay(now);
    return prisma.mealPlanCycle.findFirst({
      where: {
        userId,
        startDate: { gt: businessDay },
        status: { notIn: [MealPlanCycleStatus.SUPERSEDED, MealPlanCycleStatus.COMPLETED] },
      },
      orderBy: [{ startDate: 'asc' }, { cycleRevision: 'desc' }],
      select: mealPlanCycleSummarySelect,
    });
  }

  static async getCurrentAndUpcoming(
    userId: string,
    now: Date = new Date(),
    clearedIdsByCycle?: Map<string, string[]>
  ) {
    await this.synchronizeLifecycle(userId, now, prisma, clearedIdsByCycle);
    const businessDay = this.getBusinessDay(now);
    const [current, upcoming] = await Promise.all([
      prisma.mealPlanCycle.findFirst({
        where: {
          userId,
          startDate: { lte: businessDay },
          endDate: { gte: businessDay },
          status: { not: MealPlanCycleStatus.SUPERSEDED },
        },
        orderBy: [{ startDate: 'desc' }, { cycleRevision: 'desc' }],
        select: mealPlanCycleSummarySelect,
      }),
      prisma.mealPlanCycle.findFirst({
        where: {
          userId,
          startDate: { gt: businessDay },
          status: { notIn: [MealPlanCycleStatus.SUPERSEDED, MealPlanCycleStatus.COMPLETED] },
        },
        orderBy: [{ startDate: 'asc' }, { cycleRevision: 'desc' }],
        select: mealPlanCycleSummarySelect,
      }),
    ]);
    return { current, upcoming };
  }

  static async recordShoppingStarted(
    client: Prisma.TransactionClient,
    userId: string,
    cycleId: string,
    now: Date = new Date()
  ): Promise<void> {
    await this.synchronizeLifecycle(userId, now, client);
    const cycle = await client.mealPlanCycle.findFirst({ where: { id: cycleId, userId } });
    if (!cycle) throw new Error('The shopping list is not attached to an accessible plan cycle.');
    if (cycle.profileAdaptationState !== ProfileCycleAdaptationState.CURRENT) {
      throw new Error('This cycle is waiting for profile review or rebuilding and cannot be used for shopping.');
    }
    if (
      cycle.status === MealPlanCycleStatus.PREPARING ||
      cycle.status === MealPlanCycleStatus.UNDER_REVIEW ||
      cycle.status === MealPlanCycleStatus.REVALIDATION_REQUIRED ||
      cycle.status === MealPlanCycleStatus.SUPERSEDED ||
      cycle.status === MealPlanCycleStatus.COMPLETED
    ) {
      throw new Error('This cycle is not ready for shopping.');
    }
    if (cycle.status === MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE && cycle.incompleteAcknowledgedAt === null) {
      throw new Error('Acknowledge the missing plan slots before shopping from this partial list.');
    }
    if (cycle.shoppingStartedAt) return;

    await client.mealPlanCycle.updateMany({
      where: { id: cycle.id, userId, shoppingStartedAt: null },
      data: {
        shoppingStartedAt: now,
        ...(cycle.status === MealPlanCycleStatus.ACTIVE ? {} : { status: MealPlanCycleStatus.SHOPPING_STARTED }),
      },
    });
  }

  static async acknowledgeIncompleteCycle(userId: string, cycleId: string, now: Date = new Date()) {
    return prisma.$transaction(
      async (tx) => {
        await this.synchronizeLifecycle(userId, now, tx);
        const cycle = await tx.mealPlanCycle.findFirst({ where: { id: cycleId, userId } });
        if (!cycle) throw new Error('Meal-plan cycle not found.');
        if (cycle.incompleteAcknowledgedAt) return cycle;
        if (
          cycle.status !== MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE &&
          !(cycle.status === MealPlanCycleStatus.ACTIVE && cycle.deadlineOutcome === 'INCOMPLETE')
        ) {
          throw new Error('Only an incomplete-at-deadline cycle can be acknowledged.');
        }
        return tx.mealPlanCycle.update({
          where: { id: cycle.id },
          data: { incompleteAcknowledgedAt: now },
        });
      },
      { timeout: 90_000 }
    );
  }

  static async startShopping(userId: string, cycleId: string, now: Date = new Date()) {
    return prisma.$transaction(
      async (tx) => {
        const grocery = await tx.groceryList.findUnique({
          where: { planGroupId: cycleId },
          select: { userId: true, isStale: true },
        });
        if (!grocery || grocery.userId !== userId || grocery.isStale) {
          throw new Error('A current shopping list is required before shopping can start.');
        }
        await this.recordShoppingStarted(tx, userId, cycleId, now);
        return tx.mealPlanCycle.findUniqueOrThrow({
          where: { id: cycleId },
          select: mealPlanCycleSummarySelect,
        });
      },
      { timeout: 90_000 }
    );
  }
}
