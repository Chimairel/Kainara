import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { hasDeclaredSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { isUnrestrictedPanlasangBaseEligible } from '@/domain/unrestricted-panlasang-base.policy';
import { getManilaDateKey, getManilaMidnight } from '@/domain/meal-plan-cycle.policy';
import { membershipEnabled } from '@/domain/membership.policy';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { MembershipService } from './membership.service';
import { sourceRawRecipeCandidates } from './raw-recipe-candidate.service';
import { prepareGeneratedMealIngredients } from './meal-generation-ingredient-preparation.service';
import { savePreparedCorpusMeal } from './meal-plan-corpus-persistence.service';
import { assertFoodCompositionRevisions } from './generation-integrity.service';
import { lockUserProfile } from './profile-revision.service';
import { GroceryService } from './grocery.service';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { composedNutritionTotal, scaleFnriFoodToGrams } from '@/domain/composed-serving.policy';
import { assertMealSlotCalories } from '@/domain/generated-plan-calories.policy';
import { NotificationService } from './notification.service';

const retiredWhere = (userId: string, cycleId: string, today: Date): Prisma.MealPlanWhereInput => ({
  userId,
  planGroupId: cycleId,
  status: 'APPROVED',
  requiresSafetyRevalidation: true,
  scheduledDate: { gte: today },
  libraryMeal: { status: 'ARCHIVED', safetyInvalidationReason: 'SEEDED_FIXTURE_RETIRED' },
  mealLogs: { none: { status: { in: ['DONE', 'SKIPPED'] } } },
});

/** Repair only retired, uneaten slots in their existing episode; never grant approval or consume a swap. */
export async function replaceRetiredPlanMeals(userId: string, cycleId: string, now = new Date()) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await repairRetiredPlanMeals(userId, cycleId, now);
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034')
        throw error;
    }
  }
}

async function repairRetiredPlanMeals(userId: string, cycleId: string, now: Date) {
  await ClinicalEvidenceService.assertReadyForMealPlanning(userId);
  await ClinicalProfileReviewService.assertReadyForMealPlanning(userId);
  const today = getManilaMidnight(getManilaDateKey(now));
  const cycle = await prisma.mealPlanCycle.findFirst({ where: { id: cycleId, userId }, include: { snapshot: true } });
  if (
    !cycle?.snapshot ||
    ['SUPERSEDED', 'COMPLETED'].includes(cycle.status) ||
    cycle.endDate < today ||
    cycle.profileAdaptationState !== 'CURRENT'
  )
    throw new AppError('This cycle cannot be repaired. Review your current planning status.', 409);
  const context = await loadPlanningNutritionContext(prisma, userId, 'Profile missing.');
  const { profile, conditions, allergens, otherConditions, otherAllergies } = context;
  const assertProfile = (revision: number, safetyRevision: number) => {
    if (revision !== cycle.snapshot!.profileRevision || safetyRevision !== cycle.snapshot!.safetyRevision)
      throw new AppError('Your report changed. Review your plan before replacing retired meals.', 409);
  };
  assertProfile(profile.revision, profile.safetyRevision);
  const reviewFree = !hasDeclaredSafetyRestrictions({
    healthConditions: conditions,
    allergies: allergens,
    otherConditions,
    otherAllergies,
    safetyEntries: context.user.safetyProfileEntries,
  });
  const assertEpisode = async (tx: Prisma.TransactionClient, admit = false) => {
    if (!membershipEnabled() || reviewFree) return;
    const admitted = await tx.membershipUsage.findFirst({
      where: { userId, feature: 'PLAN_REVIEW', resultEntityId: cycleId, completedAt: { not: null } },
    });
    if (admitted) return null;
    await MembershipService.assertNewPlan(userId, cycle.startDate, tx);
    return admit
      ? MembershipService.reserve(userId, 'PLAN_REVIEW', `retired-repair:${cycleId}`, cycleId, tx, now, cycle.startDate)
      : null;
  };
  await assertEpisode(prisma);
  const old = await prisma.mealPlan.findMany({
    where: retiredWhere(userId, cycleId, today),
    orderBy: [{ scheduledDate: 'asc' }, { mealType: 'asc' }],
  });
  if (!old.length) return { replaced: 0, awaitingReplacement: 0 };
  const riceFood =
    profile.ricePreference === 'NO_RICE'
      ? null
      : await prisma.foodItem.findFirst({
          where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
        });
  const slots = old.map((meal) => ({
    dayNumber: Math.round((meal.scheduledDate.getTime() - cycle.startDate.getTime()) / 86400000) + 1,
    mealType: meal.mealType,
    scheduledDate: meal.scheduledDate,
  }));
  const sourced = await sourceRawRecipeCandidates({
    slots,
    dailyCalorieTarget: cycle.snapshot.dailyCalorieTarget,
    dietaryPreference: profile.dietaryPreference || 'OMNIVORE',
    conditions,
    allergens,
    otherConditions,
    otherAllergies,
    reviewFreeBaseOnly: reviewFree,
    ricePreference: profile.ricePreference,
    riceFood,
  });
  const { preparedMeals, compositionRevisions } = await prepareGeneratedMealIngredients({
    meals: sourced.meals.map((meal) => ({ ...meal, candidateProvenance: 'RAW_RECIPE_CORPUS' as const })),
    unmatchedSlots: slots,
    startDate: cycle.startDate,
    userHasConditions: !reviewFree,
    groundedFoodById: new Map(),
  });
  if (riceFood) compositionRevisions.set(riceFood.id, riceFood.compositionRevision);
  const sources = await prisma.rawRecipeCandidate.findMany({
    where: { id: { in: preparedMeals.flatMap((meal) => (meal.rawCandidateId ? [meal.rawCandidateId] : [])) } },
  });
  const byId = new Map(sources.map((source) => [source.id, source]));
  const eligible = preparedMeals.filter(
    (meal) =>
      !reviewFree ||
      isUnrestrictedPanlasangBaseEligible({
        source: byId.get(meal.rawCandidateId!),
        candidateId: meal.rawCandidateId,
        conditions,
        allergens,
        otherConditions,
        otherAllergies,
        safetyEntries: context.user.safetyProfileEntries,
        preparedIngredients: meal.ingredientsData,
        preparedNutrition: meal,
        servingScale: meal.servingScale,
      })
  );
  if (!eligible.length)
    throw new AppError(
      'No eligible source replacements are available for these slots yet. Other cleared meals remain available.',
      409
    );
  for (const meal of eligible) {
    const plate =
      meal.pairedRiceG && riceFood
        ? composedNutritionTotal(meal, scaleFnriFoodToGrams(riceFood, meal.pairedRiceG))
        : meal;
    assertMealSlotCalories(plate.calories, cycle.snapshot.dailyCalorieTarget, meal.mealType);
  }
  const result = await prisma.$transaction(
    async (tx) => {
      await lockUserProfile(tx, userId);
      const latest = await loadPlanningNutritionContext(tx, userId, 'Profile missing.');
      assertProfile(latest.profile.revision, latest.profile.safetyRevision);
      const currentCycle = await tx.mealPlanCycle.findFirst({ where: { id: cycleId, userId } });
      if (
        !currentCycle ||
        currentCycle.profileAdaptationState !== 'CURRENT' ||
        ['SUPERSEDED', 'COMPLETED'].includes(currentCycle.status)
      )
        throw new AppError('Cycle changed during replacement. Refresh and try again.', 409);
      // Check only composition revisions here; existing purchases/logs elsewhere in the cycle stay untouched.
      await assertFoodCompositionRevisions(tx, compositionRevisions);
      const stillRetired = await tx.mealPlan.findMany({ where: retiredWhere(userId, cycleId, today) });
      const reservation = stillRetired.length ? await assertEpisode(tx, true) : null;
      let replaced = 0;
      for (const meal of eligible) {
        const target = stillRetired.find(
          (row) => row.mealType === meal.mealType && row.scheduledDate.getTime() === meal.scheduledDate.getTime()
        );
        if (!target) continue; // An earlier retry already repaired this slot.
        await savePreparedCorpusMeal(tx, {
          meal,
          autoGeneralBase: reviewFree,
          sourceEvidence: byId.get(meal.rawCandidateId!),
          userId,
          planGroupId: cycleId,
          planType: cycle.planType,
          highRiskReviewRequired: target.highRiskReviewRequired,
          userConditions: conditions,
          userAllergens: allergens,
          planConditions: conditions.filter((item) => item !== 'NONE'),
          otherConditions,
          otherAllergies,
          safetyEntries: latest.user.safetyProfileEntries,
          riceFood,
          selectionEvidence: {
            schemaVersion: 1,
            source: 'RAW_RECIPE_CORPUS',
            servingScale: meal.servingScale ?? 1,
            dailyCalorieTarget: cycle.snapshot!.dailyCalorieTarget,
            capturedAt: now.toISOString(),
            reason: 'RETIRED_FIXTURE_REPAIR',
          },
        });
        await tx.mealPlan.update({ where: { id: target.id }, data: { status: 'CANCELLED' } });
        replaced++;
      }
      if (replaced) {
        if (reservation && !reservation.replayed) await MembershipService.complete(reservation.id, tx, cycleId);
        const plans = await tx.mealPlan.findMany({
          where: { userId, planGroupId: cycleId, status: { in: ['APPROVED', 'PENDING_REVIEW'] } },
        });
        const macros: Record<string, { calories: number; proteinG: number; carbsG: number; fatG: number }> = {};
        for (const plan of plans) {
          const day = getManilaDateKey(plan.scheduledDate);
          macros[day] ??= { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
          for (const key of ['calories', 'proteinG', 'carbsG', 'fatG'] as const) macros[day][key] += plan[key];
        }
        await tx.mealPlanCycleSnapshot.update({ where: { planGroupId: cycleId }, data: { dailyMacroTargets: macros } });
        await tx.groceryList.updateMany({ where: { userId, planGroupId: cycleId }, data: { isStale: true } });
        await tx.auditEvent.create({
          data: {
            actorUserId: userId,
            action: 'RETIRED_MEAL_SLOTS_REPLACED',
            entityType: 'MealPlanCycle',
            entityId: cycleId,
            metadata: { replaced },
          },
        });
        if (!reviewFree)
          await NotificationService.notifyReviewers(
            'Replacement meals awaiting review',
            'Retired recipe replacements are ready in the case review queue.',
            tx
          );
      }
      return { replaced, awaitingReplacement: stillRetired.length - replaced };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }
  );
  try {
    await MealPlanCycleService.synchronizeLifecycle(userId);
    if (result.replaced && (await MealPlanCycleService.getClearedMealPlanIds(userId, cycleId)).length)
      await GroceryService.generateGroceryList(userId, undefined, cycleId, 'EXPLICIT');
  } catch {
    console.warn('[RetiredPlanRepair] Saved replacements; cycle and grocery projections will retry on refresh.');
  }
  return result;
}
