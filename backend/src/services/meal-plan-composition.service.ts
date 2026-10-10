import { selectLibraryMealSlots } from './meal-library-slot-selection.service';
import { dailyTargetMap } from './meal-macro-context.service';
import { savePreparedCorpusMeals } from './meal-plan-corpus-persistence.service';
import { buildComposedServing, composedNutritionTotal, scaleFnriFoodToGrams } from '@/domain/composed-serving.policy';
import prisma from '@/lib/prisma';
import { requiresMealCandidateReview } from '@/domain/meal-candidate-review.policy';
import { assertGenerationIntegrity } from './generation-integrity.service';
import { updateGenerationProgress } from './generation-progress.service';
import { lockUserProfile } from './profile-revision.service';
import { assertAcknowledgedGenerationProfile, repairBillingStart } from './acknowledged-cycle-rebuild.service';
import { env } from '@/config/env';
import {
  loadRepairHistory,
  retainedSlotKeys,
  assertUnchangedRepairHistory,
  recordRepairHistory,
} from './plan-repair-history.service';
import { AppError } from '@/errors/AppError';
import { assertEmptyPlanRetry } from './empty-plan-retry.service';
import {
  MealType,
  MealPlanStatus,
  AIConfidenceFlag,
  HealthConditionType,
  PlanType,
  MealPlanCycleDeadlineOutcome,
  MealPlanCycleStatus,
  MealCandidateProvenance,
  RicePreference,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { assertMealSlotCalories, validateGeneratedDayCalories } from '@/domain/generated-plan-calories.policy';
import { getMealPlanCycleTiming, getScheduledMealDate } from '@/domain/meal-plan-cycle.policy';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { MembershipService } from './membership.service';
import { notifyPreparedPlan } from './meal-plan-notification.service';
import {
  MEAL_PLAN_SAFETY_POLICY_VERSION,
  requiresEscalatedMealReview,
} from '@/domain/meal-plan-production-safety.policy';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { getMealSlotCalorieRange, isPrimaryMealType } from '@/domain/meal-calorie-allocation.policy';
import type { MealSelectionEvidence } from '@/domain/meal-explanation.policy';
import {
  certifiedLibraryMealInclude,
  isCertifiedLibraryMealCompatible,
  isLibraryMealSafeToQueueForCaseReview,
  isProfileApprovedLibraryMealCompatible,
  queryEligibleLibraryMeals,
} from './meal-library-candidate-query.service';
import { sourceRawRecipeCandidates } from './raw-recipe-candidate.service';
import { prepareGeneratedMealIngredients, type GeneratedMeal } from './meal-generation-ingredient-preparation.service';
import { buildBaseServingPersistence, composePlanWithPairedRice } from './meal-plan-serving.service';
import { getMaximumAssuranceTier } from '@/domain/assurance-tier.policy';
import { isUnrestrictedPanlasangBaseEligible } from '@/domain/unrestricted-panlasang-base.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { GroceryService } from './grocery.service';
import {
  buildReviewWorkKey,
  getPreparationLeadDays,
  scorePreparationCandidate,
  UPCOMING_PREPARATION_POLICY_VERSION,
} from '@/domain/upcoming-preparation.policy';

export async function generate7DayPlan(
  userId: string,
  planType: PlanType = PlanType.WEEKLY,
  numDays: number = 7,
  startDate: Date = new Date(),
  generationJobId?: string,
  membershipReservationIds: readonly string[] = [],
  expectedEmptyCycleId?: string,
  repair?: { cycleId: string; profileRevision: number; billingStart: Date }
): Promise<string> {
  await MembershipService.assertNewPlan(userId, repair?.billingStart ?? startDate);
  await ClinicalProfileReviewService.assertReadyForMealPlanning(userId);
  await updateGenerationProgress(
    generationJobId,
    10,
    'PROFILE',
    'Applying your goals, preferences, and health safeguards.'
  );
  // 1. Fetch live user details, profile, conditions, and allergies
  const {
    user,
    profile,
    planningTargets,
    conditions: userConditions,
    allergens: userAllergens,
    otherConditions,
    otherAllergies,
  } = await loadPlanningNutritionContext(
    prisma,
    userId,
    'User profile must be initialized before generating a meal plan.'
  );
  const highRiskReviewRequired = requiresEscalatedMealReview(userConditions, otherConditions);
  const restrictions = adaptUserSafetyRestrictions({
    healthConditions: userConditions,
    allergies: userAllergens,
    otherConditions,
    otherAllergies,
    safetyEntries: user.safetyProfileEntries,
  });
  const reviewFreeBaseOnly =
    !restrictions.requiresReview &&
    !restrictions.conditions.length &&
    !restrictions.allergies.length &&
    !restrictions.customConditions.length &&
    !restrictions.customFoodRestrictions.length;
  const individualReviewRequired = requiresMealCandidateReview(restrictions);
  const assuranceTier = getMaximumAssuranceTier(userConditions);

  const { age, heightCm, weightKg, goal, activityLevel, dailyCalorieTarget } = profile;
  if (!age || !heightCm || !weightKg || !goal || !activityLevel || !dailyCalorieTarget) {
    throw new Error('Please complete your onboarding profile statistics first.');
  }

  // --- STEP 1: Check MealLibrary for pre-verified clinical matches ---
  console.log(`[Meal Generation] Step 1: Checking MealLibrary for pre-verified clinical matches...`);
  await updateGenerationProgress(
    generationJobId,
    25,
    'LIBRARY_MATCH',
    'Screening nutritionist-certified meals for safe matches.'
  );
  const slotTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER] as const;
  const libraryMeals = (
    await Promise.all(
      slotTypes.map((mealType) =>
        queryEligibleLibraryMeals({
          mealType,
          dailyCalorieTarget,
          skipCalorieFilter: true,
          userConditions,
          userAllergens,
          profile: { ...profile, userId, safetyEntries: user.safetyProfileEntries },
          limit: 120,
          includeUnapprovedCaseCandidates: individualReviewRequired,
        })
      )
    )
  ).flat();
  const caseReviewCandidateIds = new Set(
    libraryMeals
      .filter(
        (meal) =>
          !isCertifiedLibraryMealCompatible(meal, userConditions, userAllergens, {
            ...profile,
            userId,
            safetyEntries: user.safetyProfileEntries,
          }) &&
          !isProfileApprovedLibraryMealCompatible(meal, userConditions, userAllergens, {
            ...profile,
            userId,
            safetyEntries: user.safetyProfileEntries,
          })
      )
      .map((meal) => meal.id)
  );
  const userHasConditions = userConditions.some((condition) => condition !== HealthConditionType.NONE);
  const cookedRiceFood =
    profile.ricePreference !== RicePreference.NO_RICE
      ? await prisma.foodItem.findFirst({
          where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
        })
      : null;
  const recentlyUsedLibraryIds = new Set(
    (
      await prisma.mealPlan.findMany({
        where: { userId, libraryMealId: { not: null }, status: MealPlanStatus.APPROVED },
        orderBy: { scheduledDate: 'desc' },
        take: 42,
        select: { libraryMealId: true },
      })
    ).flatMap((meal) => (meal.libraryMealId ? [meal.libraryMealId] : []))
  );
  const repairHistory = repair
    ? await loadRepairHistory(userId, repair.cycleId, {
        startDate,
        endDate: getScheduledMealDate(startDate, numDays - 1),
      })
    : null;
  const retainedSlots = retainedSlotKeys(repairHistory?.meals ?? []);

  const { matchedSlots, unmatchedSlots, selectedNutrition } = selectLibraryMealSlots({
    libraryMeals,
    caseReviewCandidateIds,
    recentlyUsedLibraryIds,
    cookedRiceFood,
    retainedSlots,
    planningTargets,
    dailyCalorieTarget,
    individualReviewRequired,
    profile,
    startDate,
    numDays,
  });

  // --- STEP 2: Search the broader recipe corpus without granting it safety authority. ---
  await updateGenerationProgress(
    generationJobId,
    35,
    'CORPUS_LOOKUP',
    'Ranking existing recipes for the remaining meal slots.'
  );
  const rawCorpusResult = await sourceRawRecipeCandidates({
    slots: unmatchedSlots,
    planningTargets,
    existingNutrition: selectedNutrition,
    dailyCalorieTarget,
    dietaryPreference: profile.dietaryPreference || 'OMNIVORE',
    conditions: userConditions,
    allergens: userAllergens,
    otherConditions,
    otherAllergies,
    reviewFreeBaseOnly,
    ricePreference: profile.ricePreference,
    riceFood: cookedRiceFood,
    recentCandidateIds: (
      await prisma.mealPlan.findMany({
        where: { userId, sourceRawRecipeCandidateId: { not: null }, status: MealPlanStatus.APPROVED },
        orderBy: { scheduledDate: 'desc' },
        take: 63,
        select: { sourceRawRecipeCandidateId: true },
      })
    ).flatMap((meal) => (meal.sourceRawRecipeCandidateId ? [meal.sourceRawRecipeCandidateId] : [])),
  });
  const rawCorpusMeals: GeneratedMeal[] = rawCorpusResult.meals.map((meal) => ({
    ...meal,
    candidateProvenance: MealCandidateProvenance.RAW_RECIPE_CORPUS,
  }));
  // Persist the library and real-recipe candidates before any AI request.
  // Remaining slots are durable gaps handled by the capacity-governed queue.
  const aiMeals = rawCorpusMeals;

  const newPlanGroupId = randomUUID();
  const evidenceCapturedAt = new Date().toISOString();
  const selectionEvidenceFor = (
    source: MealSelectionEvidence['source'],
    mealType: MealType,
    ranking?: { score?: number | null; reasonCodes?: readonly string[]; servingScale?: number }
  ): MealSelectionEvidence => {
    const range = isPrimaryMealType(mealType) ? getMealSlotCalorieRange(dailyCalorieTarget, mealType) : null;
    return {
      schemaVersion: 1,
      source,
      dailyCalorieTarget,
      slotCalorieTarget: range?.target ?? null,
      slotCalorieLower: range?.minimum ?? null,
      slotCalorieUpper: range?.maximum ?? null,
      planningLocationLabel: 'Philippines',
      consumptionEvidenceScope: null,
      consumptionEvidenceRelease: null,
      rankingScore: ranking?.score ?? null,
      rankingReasonCodes: [...(ranking?.reasonCodes ?? [])],
      ...(ranking?.servingScale && ranking.servingScale !== 1
        ? { servingScale: ranking.servingScale, dataAdjustment: 'CODEX_PUBLISHED_SERVING_SCALE_V1' as const }
        : {}),
      capturedAt: evidenceCapturedAt,
    };
  };
  const cycleTiming = getMealPlanCycleTiming(planType, startDate, numDays, getPreparationLeadDays(assuranceTier));
  const targetPlanEndDate = cycleTiming.endDate;
  const planConditions = userConditions.filter((condition) => condition !== HealthConditionType.NONE);
  const createdPlansList: any[] = [];

  // Resolve ingredient identities and composition snapshots before opening the save transaction.
  await updateGenerationProgress(
    generationJobId,
    65,
    'INGREDIENT_RECONCILIATION',
    'Checking recipe ingredients against FNRI food records.'
  );
  const { preparedMeals: preparedCandidates, compositionRevisions } = await prepareGeneratedMealIngredients({
    meals: aiMeals,
    unmatchedSlots,
    startDate,
    userHasConditions,
    groundedFoodById: new Map(),
  });
  const rawSources = await prisma.rawRecipeCandidate.findMany({
    where: {
      id: { in: preparedCandidates.flatMap((meal) => (meal.rawCandidateId ? [meal.rawCandidateId] : [])) },
      libraryVariants: { none: { status: 'FLAGGED' } },
    },
  });
  const sourceById = new Map(rawSources.map((source) => [source.id, source]));
  // Unrestricted candidates need published base evidence. Restricted proposals,
  // including allergy-only profiles, stay pending until a meal review clears them.
  const unflaggedCandidates = preparedCandidates.filter(
    (meal) => !meal.rawCandidateId || sourceById.has(meal.rawCandidateId)
  );
  const preparedAiMeals = !individualReviewRequired
    ? unflaggedCandidates.filter((meal) =>
        isUnrestrictedPanlasangBaseEligible({
          source: meal.rawCandidateId ? sourceById.get(meal.rawCandidateId) : null,
          candidateId: meal.rawCandidateId,
          conditions: userConditions,
          allergens: userAllergens,
          otherConditions,
          otherAllergies,
          safetyEntries: user.safetyProfileEntries,
          preparedIngredients: meal.ingredientsData,
          servingScale: meal.servingScale,
          preparedNutrition: meal,
        })
      )
    : unflaggedCandidates;
  const unrestrictedBaseIds = new Set(
    preparedAiMeals.flatMap((meal) =>
      isUnrestrictedPanlasangBaseEligible({
        source: meal.rawCandidateId ? sourceById.get(meal.rawCandidateId) : null,
        candidateId: meal.rawCandidateId,
        conditions: userConditions,
        allergens: userAllergens,
        otherConditions,
        otherAllergies,
        safetyEntries: user.safetyProfileEntries,
        preparedIngredients: meal.ingredientsData,
        servingScale: meal.servingScale,
        preparedNutrition: meal,
      }) && meal.rawCandidateId
        ? [meal.rawCandidateId]
        : []
    )
  );
  await updateGenerationProgress(
    generationJobId,
    72,
    'INGREDIENT_VALIDATION',
    'Validating ingredient evidence and grocery quantities.'
  );

  if (cookedRiceFood) compositionRevisions.set(cookedRiceFood.id, cookedRiceFood.compositionRevision);
  const plateNutrition = (meal: (typeof preparedAiMeals)[number]) =>
    meal.pairedRiceG && cookedRiceFood
      ? composedNutritionTotal(meal, scaleFnriFoodToGrams(cookedRiceFood, meal.pairedRiceG))
      : { calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG };
  // Recheck authoritative totals after all FNRI lookups, before replacing any saved plans.
  for (const meal of preparedAiMeals) {
    assertMealSlotCalories(plateNutrition(meal).calories, dailyCalorieTarget, meal.mealType);
    if (meal.rankingScore === undefined || !meal.rankingReasonCodes?.length) {
      if (!isPrimaryMealType(meal.mealType)) {
        throw new Error(`Unsupported generated meal slot: ${meal.mealType}`);
      }
      const range = getMealSlotCalorieRange(dailyCalorieTarget, meal.mealType);
      const ranking = scorePreparationCandidate({
        activeClearanceCoverage: false,
        allergenDeclarationsComplete: false,
        ingredientsResolved: meal.ingredientsData.every((ingredient) => Boolean(ingredient.foodItemId)),
        nutrientsComplete: [meal.calories, meal.proteinG, meal.carbsG, meal.fatG].every(Number.isFinite),
        dietCompatible: true,
        remainingReviews: 1,
        calorieDeviationRatio: Math.abs(plateNutrition(meal).calories - range.target) / range.target,
        mealTypeMatch: true,
        ricePreference: profile.ricePreference,
        usedInRecentCycle: false,
      });
      meal.candidateRank = meal.candidateRank ?? 1;
      meal.rankingScore = ranking.score;
      meal.rankingReasonCodes = ranking.reasonCodes;
    }
  }
  const finalCalorieIssues = validateGeneratedDayCalories(
    [
      ...matchedSlots.map((slot) => ({
        dayNumber: slot.dayNumber,
        mealType: slot.mealType,
        calories:
          slot.libraryMeal.calories +
          (slot.pairedRiceG && cookedRiceFood ? (cookedRiceFood.calories * slot.pairedRiceG) / 100 : 0),
      })),
      ...preparedAiMeals.map((meal) => ({
        dayNumber: unmatchedSlots.find(
          (slot) => slot.mealType === meal.mealType && slot.scheduledDate.getTime() === meal.scheduledDate.getTime()
        )!.dayNumber,
        mealType: meal.mealType,
        calories: plateNutrition(meal).calories,
      })),
    ],
    dailyCalorieTarget
  );
  if (finalCalorieIssues.length) throw new Error(finalCalorieIssues.join(' '));

  const dailyMacroTargets = dailyTargetMap(
    Array.from({ length: numDays }, (_, day) => getScheduledMealDate(startDate, day)),
    planningTargets
  );
  const now = new Date();
  const businessDay = MealPlanCycleService.getBusinessDay(now);
  const completeSlotSet =
    matchedSlots.every((slot) => !slot.requiresCaseApproval) &&
    preparedAiMeals.every((meal) => Boolean(meal.rawCandidateId && unrestrictedBaseIds.has(meal.rawCandidateId))) &&
    matchedSlots.length + preparedAiMeals.length + retainedSlots.size >= cycleTiming.expectedSlotCount;
  const deadlinePassed = now.getTime() >= cycleTiming.shoppingDeadlineAt.getTime();
  const cycleStatus =
    cycleTiming.endDate < businessDay
      ? MealPlanCycleStatus.COMPLETED
      : cycleTiming.startDate <= businessDay
        ? MealPlanCycleStatus.ACTIVE
        : deadlinePassed
          ? MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE
          : MealPlanCycleStatus.UNDER_REVIEW;
  const deadlineOutcome = deadlinePassed ? MealPlanCycleDeadlineOutcome.INCOMPLETE : null;

  // Save plans atomically in a Prisma Transaction (with a 30-second timeout to support sequential batch inserts)
  await prisma.$transaction(
    async (tx) => {
      await lockUserProfile(tx, userId);
      if (repair) await repairBillingStart(userId, repair, tx);
      if (repair && repairHistory)
        await assertUnchangedRepairHistory(
          tx,
          userId,
          repair.cycleId,
          { startDate, endDate: targetPlanEndDate },
          repairHistory
        );
      if (env.CLINICAL_CLARIFICATIONS_ENABLED) {
        await assertAcknowledgedGenerationProfile(userId, tx);
        if (!(await ClinicalProfileReviewService.hasCurrentApproval(userId, tx)))
          throw new AppError(
            'The profile case must be confirmed before meal publication.',
            409,
            'PROFILE_REVIEW_REQUIRED'
          );
      }
      const { profile: currentProfileRevision } = await loadPlanningNutritionContext(tx, userId, 'Profile missing.');
      if (currentProfileRevision.revision !== profile.revision)
        throw new Error('Profile changed during generation. Please retry.');
      if (expectedEmptyCycleId)
        await assertEmptyPlanRetry(tx, userId, expectedEmptyCycleId, profile.revision, profile.safetyRevision);
      if (!repair && cycleTiming.startDate > MealPlanCycleService.getBusinessDay(new Date())) {
        const current = await tx.mealPlanCycle.findFirst({
          where: {
            userId,
            status: { not: MealPlanCycleStatus.SUPERSEDED },
            startDate: { lte: MealPlanCycleService.getBusinessDay(new Date()) },
            endDate: { gte: cycleTiming.startDate },
          },
          select: { id: true },
        });
        if (current)
          throw new AppError(
            'Upcoming preparation overlaps the current plan. Wait until its recorded end date.',
            409,
            'PLAN_WINDOW_OVERLAP'
          );
      }
      await assertGenerationIntegrity(
        tx,
        userId,
        startDate,
        targetPlanEndDate,
        compositionRevisions,
        repairHistory
          ? {
              retainedMealIds: repairHistory.meals.map((meal) => meal.id),
              purchasedItemIds: repairHistory.purchasedItems.map((item) => item.sourceItemId),
            }
          : undefined
      );
      await tx.groceryList.updateMany({ where: { userId }, data: { isStale: true } });
      const overlappingCycles = await tx.mealPlanCycle.findMany({
        where: {
          userId,
          status: { not: MealPlanCycleStatus.SUPERSEDED },
          startDate: { lte: targetPlanEndDate },
          endDate: { gte: cycleTiming.startDate },
        },
        select: { id: true },
      });
      const priorRevision = await tx.mealPlanCycle.aggregate({
        where: { userId, planType, startDate: cycleTiming.startDate },
        _max: { cycleRevision: true },
      });
      if (overlappingCycles.length) {
        await tx.mealPlanCycle.updateMany({
          where: { id: { in: overlappingCycles.map((cycle) => cycle.id) } },
          data: {
            status: MealPlanCycleStatus.SUPERSEDED,
            supersededAt: now,
            supersededById: null,
          },
        });
      }
      // 1. Replace only plans that overlap this exact target window. A future
      // pending plan must never cancel the user's currently active approved week.
      await tx.mealPlan.updateMany({
        where: {
          userId,
          status: { in: [MealPlanStatus.APPROVED, MealPlanStatus.PENDING_REVIEW] },
          scheduledDate: { gte: startDate, lte: targetPlanEndDate },
          mealLogs: { none: { status: { in: ['DONE', 'SKIPPED'] } } },
        },
        data: { status: MealPlanStatus.CANCELLED },
      });

      await tx.mealPlanCycle.create({
        data: {
          id: newPlanGroupId,
          userId,
          planType,
          cycleRevision: (priorRevision._max.cycleRevision ?? 0) + 1,
          startDate: cycleTiming.startDate,
          endDate: cycleTiming.endDate,
          preparationOpensAt: cycleTiming.preparationOpensAt,
          shoppingDeadlineAt: cycleTiming.shoppingDeadlineAt,
          preparationPolicyVersion: UPCOMING_PREPARATION_POLICY_VERSION,
          assuranceTier,
          preparationTriggeredAt: now,
          expectedSlotCount: cycleTiming.expectedSlotCount,
          status: cycleStatus,
          deadlineOutcome,
          readyAt: null,
          activatedAt: cycleStatus === MealPlanCycleStatus.ACTIVE ? now : null,
        },
      });
      if (overlappingCycles.length) {
        await tx.mealPlanCycle.updateMany({
          where: { id: { in: overlappingCycles.map((cycle) => cycle.id) } },
          data: { supersededById: newPlanGroupId },
        });
      }

      await tx.mealPlanCycleSnapshot.create({
        data: {
          planGroupId: newPlanGroupId,
          userId,
          profileRevision: profile.revision,
          nutritionReportVersion: profile.planningReportVersion,
          safetyRevision: profile.safetyRevision,
          weightKg,
          activityLevel,
          goal,
          dailyCalorieTarget,
          dailyMacroTargets: dailyMacroTargets as Prisma.InputJsonObject,
          dietaryPreference: profile.dietaryPreference,
          ricePreference: profile.ricePreference,
          ricePreferenceProvenance: profile.ricePreferenceProvenance,
          foodCulture: profile.foodCulture,
          planningGeographyLevel: profile.planningGeographyLevel,
          planningRegionName: profile.planningRegionName,
          planningProvinceHucName: profile.planningProvinceHucName,
          shoppingDayGroup: profile.shoppingDayGroup,
          shoppingDayOfWeek: profile.shoppingDayOfWeek,
        },
      });
      if (repair && repairHistory)
        await recordRepairHistory(tx, userId, repair.cycleId, newPlanGroupId, profile.revision, repairHistory);

      // 2. Create matched library meals from the exact certified library snapshot.
      if (matchedSlots.length > 0) {
        for (const slot of matchedSlots) {
          const latest = await tx.mealLibrary.findUniqueOrThrow({
            where: { id: slot.libraryMeal.id },
            include: certifiedLibraryMealInclude,
          });
          const currentProfile = { ...profile, userId, safetyEntries: user.safetyProfileEntries };
          const certified = isCertifiedLibraryMealCompatible(latest, userConditions, userAllergens, currentProfile);
          const profileApproved =
            !certified && isProfileApprovedLibraryMealCompatible(latest, userConditions, userAllergens, currentProfile);
          const requiresCaseApproval =
            Boolean(slot.pairedRiceG && individualReviewRequired) ||
            (!certified &&
              !profileApproved &&
              slot.requiresCaseApproval &&
              isLibraryMealSafeToQueueForCaseReview(latest, userConditions, userAllergens, currentProfile));
          const scope = profileApproved
            ? mealApprovalSafetyScope({
                conditions: userConditions,
                allergens: userAllergens,
                otherConditions,
                otherAllergies,
                safetyEntries: user.safetyProfileEntries,
              })
            : null;
          const approval = profileApproved
            ? latest.profileApprovals.find(
                (item) =>
                  item.safetyScopeKey === scope?.key &&
                  !item.flaggedAt &&
                  item.recipeSignature === latest.recipeSignature &&
                  item.evidenceRevision === latest.safetyEvidenceRevision
              )
            : null;
          if (
            latest.safetyEvidenceRevision !== slot.libraryMeal.safetyEvidenceRevision ||
            latest.status !== 'APPROVED' ||
            (!certified && !approval && !requiresCaseApproval)
          )
            throw new Error('Recipe or clearance evidence changed during generation. Please retry.');
          const ingredientsData = latest.ingredients.map((ing) => ({
            ingredientName: ing.ingredientName,
            category: ing.category,
            foodItemId: ing.foodItemId,
            dataSource: ing.dataSource,
            quantity: ing.quantity,
            unit: ing.unit,
          }));
          const serving = buildBaseServingPersistence({
            ...latest,
            mealType: slot.mealType,
            recipeSignature: latest.recipeSignature,
            ingredients: ingredientsData,
            evidenceSource: 'CERTIFIED_LIBRARY',
          });

          // Only fully compatible evidence is actionable immediately.
          // Other clinical candidates still need their case review decision.
          const createdPlan = await tx.mealPlan.create({
            data: {
              planGroupId: newPlanGroupId,
              userId,
              status: requiresCaseApproval ? MealPlanStatus.PENDING_REVIEW : MealPlanStatus.APPROVED,
              candidateProvenance: MealCandidateProvenance.CERTIFIED_LIBRARY,
              libraryMealId: slot.libraryMeal.id,
              profileApprovalId: approval?.id ?? null,
              nutritionistId: requiresCaseApproval
                ? null
                : (approval?.reviewerNutritionistId ?? latest.safetyReviewedByNutritionistId),
              planType,
              mealType: slot.mealType,
              mealName: latest.mealName,
              description: latest.description,
              calories: latest.calories,
              proteinG: latest.proteinG,
              carbsG: latest.carbsG,
              fatG: latest.fatG,
              aiConfidenceFlag: AIConfidenceFlag.SAFE,
              scheduledDate: slot.scheduledDate,
              reviewedAt: requiresCaseApproval ? null : (approval?.approvedAt ?? latest.safetyReviewedAt),
              requiresSafetyRevalidation: requiresCaseApproval,
              safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
              highRiskReviewRequired,
              reviewApprovalCount: requiresCaseApproval ? 0 : 1,
              reviewWorkKey: requiresCaseApproval
                ? buildReviewWorkKey({
                    recipeSignature:
                      slot.pairedRiceG && cookedRiceFood
                        ? buildComposedServing({
                            baseRecipeSignature: serving.baseRecipeSignature,
                            baseNutrition: latest,
                            riceFood: cookedRiceFood,
                            cookedRiceG: slot.pairedRiceG,
                          }).composedServingSignature
                        : serving.baseRecipeSignature,
                    evidenceRevision: latest.safetyEvidenceRevision,
                    conditions: planConditions,
                    allergens: userAllergens,
                    safetyScopeKey: mealApprovalSafetyScope({
                      conditions: userConditions,
                      allergens: userAllergens,
                      otherConditions,
                      otherAllergies,
                      safetyEntries: user.safetyProfileEntries,
                    }).key,
                    policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
                    requiredReviewerCount: 1,
                  })
                : null,
              candidateRank: slot.candidateRank,
              rankingScore: slot.rankingScore,
              rankingReasonCodes: slot.rankingReasonCodes,
              fallbackAvailable: slot.fallbackAvailable,
              selectionEvidence: selectionEvidenceFor('VERIFIED_LIBRARY', slot.mealType, {
                score: slot.rankingScore,
                reasonCodes: slot.rankingReasonCodes,
              }) as unknown as Prisma.InputJsonValue,
              ingredients: {
                create: ingredientsData,
              },
              ...serving,
            },
          });
          createdPlansList.push(createdPlan);

          if (planConditions.length && !requiresCaseApproval) {
            const clearanceUsages = planConditions.map((condition) => {
              const clearance = latest.conditionClearances.find(
                (candidate) =>
                  candidate.condition === condition &&
                  candidate.state === 'ACTIVE' &&
                  candidate.recipeSignature === latest.recipeSignature &&
                  candidate.evidenceRevision === latest.safetyEvidenceRevision &&
                  (!candidate.userScopeId || candidate.userScopeId === userId) &&
                  (!candidate.expiresAt || candidate.expiresAt > new Date())
              );
              if (!clearance) throw new Error('Condition clearance changed during generation. Please retry.');
              return {
                mealPlanId: createdPlan.id,
                clearanceId: clearance.id,
                condition: condition as HealthConditionType,
                composedServingSignature: createdPlan.composedServingSignature,
              };
            });
            await tx.mealPlanClearanceUsage.createMany({ data: clearanceUsages });
          }

          if (slot.pairedRiceG && cookedRiceFood) {
            await composePlanWithPairedRice(tx, {
              mealPlanId: createdPlan.id,
              cookedRiceG: slot.pairedRiceG,
              fnriRiceFoodItemId: cookedRiceFood.id,
            });
          }

          // Increment library entry usage count
          await tx.mealLibrary.update({
            where: { id: slot.libraryMeal.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      createdPlansList.push(
        ...(await savePreparedCorpusMeals(
          tx,
          preparedAiMeals.map((meal) => ({
            meal,
            autoGeneralBase: Boolean(meal.rawCandidateId && unrestrictedBaseIds.has(meal.rawCandidateId)),
            sourceEvidence: meal.rawCandidateId ? sourceById.get(meal.rawCandidateId) : undefined,
            userId,
            planGroupId: newPlanGroupId,
            planType,
            highRiskReviewRequired,
            userConditions,
            userAllergens,
            planConditions,
            otherConditions,
            otherAllergies,
            safetyEntries: user.safetyProfileEntries,
            riceFood: cookedRiceFood,
            selectionEvidence: selectionEvidenceFor(
              meal.candidateProvenance === MealCandidateProvenance.RAW_RECIPE_CORPUS
                ? 'RAW_RECIPE_CORPUS'
                : 'AI_GENERATED',
              meal.mealType,
              { score: meal.rankingScore, reasonCodes: meal.rankingReasonCodes, servingScale: meal.servingScale }
            ) as unknown as Prisma.InputJsonValue,
          }))
        ))
      );
      for (const id of membershipReservationIds) await MembershipService.complete(id, tx, newPlanGroupId);
    },
    { timeout: 30000 }
  );

  await updateGenerationProgress(
    generationJobId,
    92,
    'SAVING',
    'Saving the plan and preparing its professional review queue.'
  );

  if (completeSlotSet && cycleTiming.startDate > businessDay) {
    try {
      await GroceryService.generateGroceryList(userId, undefined, newPlanGroupId);
    } catch (error) {
      console.error('[Meal Generation] Upcoming grocery projection failed; cycle remains under review:', error);
    }
  }

  await notifyPreparedPlan(userId, planType, cycleTiming.endDate, createdPlansList);

  return newPlanGroupId;
}
