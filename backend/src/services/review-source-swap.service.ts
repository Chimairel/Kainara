import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { screenFoodExclusions } from '@/domain/food-exclusion.policy';
import { assertReviewSwapClaim, reviewSwapVersion } from '@/domain/review-swap.policy';
import { evaluateNutrientFilters, plateNutrients, replacementServingKey, type ReviewNutrientFilters } from '@/domain/review-nutrient-filter.policy';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { toPublicRawRecipeImage } from '@/domain/meal-image.policy';
import { requiresEscalatedMealReview } from '@/domain/meal-plan-production-safety.policy';
import { sourceRawRecipeCandidates } from './raw-recipe-candidate.service';
import { projectRawRecipeCandidate } from './panlasang-recipe-candidate.provider';
import { rawRecipeServing } from './raw-recipe-serving.service';
import { loadReviewRice } from './review-replacement-search.service';
import { swapMacroContext } from './meal-macro-context.service';
import { prepareGeneratedMealIngredients } from './meal-generation-ingredient-preparation.service';
import { savePreparedCorpusMeal } from './meal-plan-corpus-persistence.service';
import { assertFoodCompositionRevisions } from './generation-integrity.service';
import { assertObservedSourceStillAvailable } from './observed-source-guard.service';
import { lockUserProfile } from './profile-revision.service';
import { assertCurrentMealReviewContext } from './meal-case-context.service';
import { currentReviewProfile } from './meal-review-context.service';
import { ReviewRoutingService } from './review-routing.service';
import { rejectedSlotRecipes, assertRecipeNotRejectedForSlot } from './rejected-slot-recipes.service';
import { setMealLogAuditContext } from './meal-log-audit-context.service';

type Plan = Prisma.MealPlanGetPayload<{ include: { cycle: { include: { snapshot: true } } } }>;
type Context = Awaited<ReturnType<typeof loadPlanningNutritionContext>>;
export const REVIEW_SOURCE_PREFIX = 'review-source:';

/** The generation ranking supplies a pending recipe only in the RND workflow. */
export async function bestReviewSourceSwap(plan: Plan, context: Context, filters: ReviewNutrientFilters) {
  const snapshot = plan.cycle.snapshot;
  if (!snapshot) return null;
  const [rice, macros, rejected, held] = await Promise.all([
    loadReviewRice(), swapMacroContext(prisma, plan.userId, plan, context.planningTargets),
    rejectedSlotRecipes(prisma, plan),
    prisma.mealReviewLineage.findMany({ where: { state: { not: 'PUBLISHED' }, key: { startsWith: 'source:' } }, select: { key: true } }),
  ]);
  const restrictions = adaptUserSafetyRestrictions({ healthConditions: context.conditions, allergies: context.allergens,
    otherConditions: context.otherConditions, otherAllergies: context.otherAllergies, safetyEntries: context.user.safetyProfileEntries });
  const plateFor = (candidate: Parameters<typeof rawRecipeServing>[0]['candidate']) => rawRecipeServing({ candidate,
    mealType: plan.mealType, dailyCalorieTarget: snapshot.dailyCalorieTarget, ricePreference: snapshot.ricePreference,
    riceFood: rice, macroTarget: macros.budget, scoreNutrition: macros.scoreReplacement });
  // Source projections contain macros only. Extended nutrients stay unknown, rather than being inferred by AI.
  const nutrientsFor = (plate: NonNullable<ReturnType<typeof rawRecipeServing>>) => plateNutrients(plate.nutrition!, rice ? {
    ...rice, sugarG: rice.sugar, sodiumMg: rice.sodium, fiberG: rice.fiber, potassiumMg: rice.potassium,
    phosphorusMg: rice.phosphorus, saturatedFatG: rice.saturatedFat,
  } : null, plate.pairedRiceG);
  const result = await sourceRawRecipeCandidates({
    slots: [{ dayNumber: 1, mealType: plan.mealType, scheduledDate: plan.scheduledDate }],
    dailyCalorieTarget: snapshot.dailyCalorieTarget, planningTargets: context.planningTargets,
    existingNutrition: macros.dayMeals.filter(meal => meal.id !== plan.id).map(meal => ({ ...meal, dayNumber: 1 })),
    dietaryPreference: context.profile.dietaryPreference || 'OMNIVORE', conditions: context.conditions,
    allergens: context.allergens, otherConditions: context.otherConditions, otherAllergies: context.otherAllergies,
    ricePreference: snapshot.ricePreference, riceFood: rice,
    excludeCandidateIds: [...held.map(row => row.key.slice('source:'.length)), ...(plan.sourceRawRecipeCandidateId ? [plan.sourceRawRecipeCandidateId] : [])],
    recentCandidateIds: macros.dayMeals.flatMap(meal => meal.sourceRawRecipeCandidateId ? [meal.sourceRawRecipeCandidateId] : []),
    acceptCandidate: candidate => {
      if (rejected.includes({ sourceRawRecipeCandidateId: candidate.id, libraryMealId: null, baseRecipeSignature: candidate.contentSignature })) return false;
      const excluded = screenFoodExclusions(candidate.ingredients, restrictions.foodExclusions);
      const plate = plateFor(candidate);
      return excluded.complete && !excluded.conflicts.length && Boolean(plate && evaluateNutrientFilters(nutrientsFor(plate), filters).matches);
    },
  });
  const selected = result.meals[0];
  if (!selected) return null;
  const source = await prisma.rawRecipeCandidate.findUniqueOrThrow({ where: { id: selected.rawCandidateId }, include: { applicableMealTypes: true } });
  const plate = plateFor(projectRawRecipeCandidate(source));
  if (!plate) return null;
  const prepared = await prepareGeneratedMealIngredients({ meals: [{ ...selected, ...plate.nutrition!,
    ingredients: plate.ingredients.map(item => ({ ...item, foodItemId: item.foodItemId ?? null })),
    servingScale: plate.servingScale, pairedRiceG: plate.pairedRiceG, candidateProvenance: 'RAW_RECIPE_CORPUS' }],
    unmatchedSlots: [{ dayNumber: 1, mealType: plan.mealType, scheduledDate: plan.scheduledDate }], startDate: plan.scheduledDate,
    userHasConditions: context.conditions.some(value => value !== 'NONE'), groundedFoodById: new Map(),
    restrictions: { dietaryPreference: context.profile.dietaryPreference || 'OMNIVORE', allergens: context.allergens,
      customAllergies: (context.otherAllergies ?? '').split(',').filter(Boolean) } });
  const meal = prepared.preparedMeals[0];
  if (!meal) return null;
  const nutrients = nutrientsFor({ ...plate, nutrition: meal });
  if (!evaluateNutrientFilters(nutrients, filters).matches) return null;
  const servingKey = replacementServingKey({ recipeSignature: source.contentSignature, evidenceRevision: 1, nutrients,
    riceFoodId: plate.pairedRiceG ? rice?.id ?? null : null, riceRevision: plate.pairedRiceG ? rice?.compositionRevision ?? null : null,
    pairedRiceG: plate.pairedRiceG });
  const option = { id: REVIEW_SOURCE_PREFIX + source.id, mealName: meal.mealName, mealType: meal.mealType,
    description: meal.description, mealTypes: plate.applicableMealTypes, riceRole: plate.riceRole,
    ...Object.fromEntries(['calories', 'proteinG', 'carbsG', 'fatG'].map(key => [key, nutrients[key as keyof typeof nutrients]])),
    nutrients, pairedRiceG: plate.pairedRiceG, servingKey, recipeSignature: source.contentSignature, evidenceRevision: 1,
    requiresReview: true, verifier: null, verifiedBy: 'Recorded source recipe · not case approved', prcLicenseNumber: '',
    image: toPublicRawRecipeImage({ recipeName: source.recipeName, sourceName: source.sourceName, sourceUrl: source.sourceUrl,
      sourceImageUrl: source.sourceImageUrl, sourceVideoUrl: source.sourceVideoUrl }),
    ingredients: [...meal.ingredientsData.map(item => ({ name: item.ingredientName, quantity: item.quantity, unit: item.unit, source: item.dataSource })),
      ...(plate.pairedRiceG ? [{ name: 'Rice, well-milled, boiled', quantity: plate.pairedRiceG, unit: 'g', source: 'FNRI' as const }] : [])],
  };
  return { option, meal, source, rice, compositionRevisions: prepared.compositionRevisions };
}

export async function executeReviewSourceSwap(profileId: string, plan: Plan, input: {
  expectedContextKey?: string; libraryMealId: string; expectedVersion: string; expectedRecipeSignature: string;
  expectedServingKey?: string; expectedEvidenceRevision: number; filters?: ReviewNutrientFilters; note: string;
}) {
  const context = await loadPlanningNutritionContext(prisma, plan.userId, 'Planning profile unavailable.');
  const candidate = await bestReviewSourceSwap(plan, context, input.filters ?? {});
  if (!candidate || candidate.option.id !== input.libraryMealId || candidate.option.servingKey !== input.expectedServingKey ||
    candidate.option.recipeSignature !== input.expectedRecipeSignature || input.expectedEvidenceRevision !== 1)
    throw new AppError('Candidate changed. Refresh the replacement search.', 409, 'REVIEW_SWAP_CHANGED');
  return prisma.$transaction(async tx => {
    await lockUserProfile(tx, plan.userId);
    await assertCurrentMealReviewContext(plan.id, input.expectedContextKey, tx, profileId);
    await ReviewRoutingService.assertMeal(profileId, plan.id, tx);
    const reviewer = await currentReviewProfile(tx, profileId);
    const current = await tx.mealPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assertReviewSwapClaim(current, profileId);
    const currentContext = await loadPlanningNutritionContext(tx, plan.userId, 'Planning profile unavailable.');
    const cycle = await tx.mealPlanCycle.findUniqueOrThrow({ where: { id: plan.planGroupId } });
    if (!reviewer || cycle.shoppingStartedAt || cycle.supersededById || current.scheduledDate < getStartOfManilaBusinessDay() ||
      reviewSwapVersion(current, currentContext.profile) !== input.expectedVersion)
      throw new AppError('Review or planning context changed. Refresh the case.', 409, 'REVIEW_SWAP_CHANGED');
    const key = `source:${candidate.source.id}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    await tx.$queryRaw`SELECT id FROM "RawRecipeCandidate" WHERE id = ${candidate.source.id} FOR SHARE`;
    const currentSource = await tx.rawRecipeCandidate.findUniqueOrThrow({ where: { id: candidate.source.id } });
    if (currentSource.contentSignature !== candidate.source.contentSignature ||
      ['calories', 'proteinG', 'carbsG', 'fatG', 'riceRole', 'riceRoleReviewStatus', 'includedRiceG'].some(key =>
        currentSource[key as keyof typeof currentSource] !== candidate.source[key as keyof typeof candidate.source]) ||
      JSON.stringify(currentSource.ingredients) !== JSON.stringify(candidate.source.ingredients))
      throw new AppError('Source serving evidence changed. Refresh the search.', 409, 'REVIEW_SWAP_CHANGED');
    const lineage = await tx.mealReviewLineage.findUnique({ where: { key }, select: { state: true } });
    if (lineage && lineage.state !== 'PUBLISHED') throw new AppError('Recipe is held for review.', 409, 'REVIEW_SWAP_CHANGED');
    await assertObservedSourceStillAvailable(tx, candidate.source.id);
    await assertFoodCompositionRevisions(tx, candidate.compositionRevisions);
    await assertRecipeNotRejectedForSlot(tx, plan, { sourceRawRecipeCandidateId: candidate.source.id, libraryMealId: null,
      baseRecipeSignature: candidate.source.contentSignature });
    const pinned = await tx.mealPlan.findFirst({ where: { planGroupId: plan.planGroupId, scheduledDate: plan.scheduledDate,
      mealType: plan.mealType, status: 'APPROVED', userSelectionPinnedAt: { not: null } }, select: { id: true } });
    if (pinned) throw new AppError('This slot already has a member-selected meal.', 409, 'REVIEW_SWAP_CHANGED');
    const replacement = await savePreparedCorpusMeal(tx, { meal: candidate.meal, autoGeneralBase: false, sourceEvidence: candidate.source,
      userId: plan.userId, planGroupId: plan.planGroupId, planType: plan.planType,
      highRiskReviewRequired: requiresEscalatedMealReview(context.conditions, context.otherConditions),
      userConditions: context.conditions, userAllergens: context.allergens, planConditions: context.conditions,
      otherConditions: context.otherConditions, otherAllergies: context.otherAllergies, safetyEntries: context.user.safetyProfileEntries,
      riceFood: candidate.rice, selectionEvidence: { schemaVersion: 1, fallbackReasonCode: 'RND_SELECTED_REPLACEMENT',
        nutrientFilters: input.filters ?? {}, reviewedPlate: candidate.option.nutrients, servingKey: candidate.option.servingKey } as Prisma.InputJsonObject });
    await tx.mealPlan.update({ where: { id: replacement.id }, data: { claimedByNutritionistId: profileId, claimedAt: new Date() } });
    await tx.mealPlan.update({ where: { id: plan.id }, data: { status: 'CANCELLED', supersededByMealPlanId: replacement.id,
      claimedByNutritionistId: null, claimedAt: null } });
    await setMealLogAuditContext(tx, reviewer.userId, 'RND swapped pending meal');
    await tx.mealLog.updateMany({ where: { mealPlanId: plan.id, status: 'PENDING' }, data: { status: 'VOIDED' } });
    await tx.groceryList.updateMany({ where: { userId: plan.userId, planGroupId: plan.planGroupId }, data: { isStale: true } });
    await tx.auditEvent.create({ data: { actorUserId: reviewer.userId, actorName: reviewer.user.name, actorRole: 'NUTRITIONIST',
      action: 'MEAL_PLAN_SLOT_REPLACED_PENDING_REVIEW', entityType: 'MealPlan', entityId: replacement.id,
      metadata: { supersededMealPlanId: plan.id, reasonCode: 'RND_SELECTED_REPLACEMENT', rationale: input.note,
        reviewerProfileId: profileId, sourceCandidateId: candidate.source.id, nutrientFilters: input.filters ?? {},
        servingKey: candidate.option.servingKey, status: 'PENDING_REVIEW' } as Prisma.InputJsonObject } });
    return { replaced: true, replacementPlanId: replacement.id };
  }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
