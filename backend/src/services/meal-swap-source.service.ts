import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { hasDeclaredSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { validateGeneratedMealCandidate } from '@/domain/generated-meal-validation.policy';
import { isUnrestrictedPanlasangBaseEligible } from '@/domain/unrestricted-panlasang-base.policy';
import { getMealSlotCalorieRange, isPrimaryMealType } from '@/domain/meal-calorie-allocation.policy';
import { assertMealSlotCalories } from '@/domain/generated-plan-calories.policy';
import { resolvePlanTargetCalories } from '@/domain/plan-cycle-target.policy';
import { composedNutritionTotal, scaleFnriFoodToGrams } from '@/domain/composed-serving.policy';
import { ricePortionLabel } from '@/domain/rice-portion.policy';
import { toPublicRawRecipeImage } from '@/domain/meal-image.policy';
import { cookingLinkForMeal } from '@/domain/meal-cooking-link.policy';
import { signSwapPreview, verifySwapPreview, SWAP_PREVIEW_TTL_MS } from '@/domain/swap-preview-token';
import { buildSwapShoppingDelta } from '@/domain/swap-shopping.policy';
import {
  getStartOfManilaBusinessDay,
  filterUserActionableMealPlans,
  getApprovedMealPlanStatusWhere,
} from '@/domain/meal-actionability.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { databaseRecipeCandidateProvider, projectRawRecipeCandidate } from './panlasang-recipe-candidate.provider';
import { rawRecipeServing } from './raw-recipe-serving.service';
import { prepareGeneratedMealIngredients } from './meal-generation-ingredient-preparation.service';
import { replacePlanBaseServing, composePlanWithPairedRice } from './meal-plan-serving.service';
import { assertFoodCompositionRevisions } from './generation-integrity.service';
import { loadActionableUnloggedMealPlan } from './meal-swap-read.service';
import { MembershipService } from './membership.service';
import { GroceryService } from './grocery.service';
import { recalculateDailyNutritionLog } from './meal-swap-nutrition.service';
import { lockUserProfile } from './profile-revision.service';
import type { RecipeCandidateProjection } from './recipe-candidate-provider';

export const SOURCE_SWAP_PREFIX = 'source:';
type Slot = Awaited<ReturnType<typeof loadActionableUnloggedMealPlan>>;
type Plate = NonNullable<ReturnType<typeof rawRecipeServing>>;

async function sourceContext(client: Prisma.TransactionClient, userId: string, slot: Slot) {
  const context = await loadPlanningNutritionContext(client, userId, 'User profile not found.');
  const unrestricted = !hasDeclaredSafetyRestrictions({
    healthConditions: context.conditions,
    allergies: context.allergens,
    otherConditions: context.otherConditions,
    otherAllergies: context.otherAllergies,
    safetyEntries: context.user.safetyProfileEntries,
  });
  const snapshot = await client.mealPlanCycleSnapshot.findUnique({ where: { planGroupId: slot.planGroupId } });
  const dailyTarget = resolvePlanTargetCalories(snapshot?.dailyCalorieTarget, context.profile.dailyCalorieTarget, 2000);
  const rice =
    context.profile.ricePreference === 'NO_RICE'
      ? null
      : await client.foodItem.findFirst({
          where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
        });
  return { ...context, unrestricted, dailyTarget, rice };
}

function publicSourceOption(plate: Plate, slot: Slot, alreadyPlannedInCycle = false) {
  const riceLabel = plate.pairedRiceG ? ricePortionLabel(plate.pairedRiceG) : null;
  return {
    id: SOURCE_SWAP_PREFIX + plate.id,
    reuseBasis: 'PANLASANG_GENERAL_BASE' as const,
    mealName: plate.displayName,
    description: plate.description,
    mealType: slot.mealType,
    mealTypes: plate.applicableMealTypes,
    riceRole: plate.riceRole,
    riceRoleReviewStatus: 'NOT_REVIEWED' as const,
    includedRiceG: null,
    pairedRiceG: plate.pairedRiceG,
    ricePortionLabel: riceLabel,
    servingDescription: `One dish serving${plate.servingScale !== 1 ? ` (${plate.servingScale}× published portion)` : ''}${riceLabel ? ` + ${riceLabel}` : ''}`,
    isFavorite: false,
    canFavorite: false,
    alreadyPlannedInCycle,
    calories: plate.plateCalories,
    proteinG: plate.nutrition!.proteinG,
    carbsG: plate.nutrition!.carbsG,
    fatG: plate.nutrition!.fatG,
    verifiedBy: 'Panlasang Pinoy source',
    prcLicenseNumber: '',
    verifier: null,
    image: toPublicRawRecipeImage({
      recipeName: plate.displayName,
      sourceName: 'PANLASANG_PINOY',
      sourceUrl: plate.sourceUrl,
      sourceImageUrl: plate.imageUrl,
      sourceVideoUrl: plate.videoUrl,
    }),
    cookingLink: cookingLinkForMeal({
      sourceRawRecipeCandidate: {
        recipeName: plate.displayName,
        sourceName: 'PANLASANG_PINOY',
        sourceUrl: plate.sourceUrl,
        sourceImageUrl: plate.imageUrl,
        sourceVideoUrl: plate.videoUrl,
      },
    }),
  };
}

function fullPlateOption(
  plate: Plate,
  slot: Slot,
  rice: Awaited<ReturnType<typeof sourceContext>>['rice'],
  alreadyPlanned = false
) {
  const total =
    plate.pairedRiceG && rice
      ? composedNutritionTotal(plate.nutrition!, scaleFnriFoodToGrams(rice, plate.pairedRiceG))
      : plate.nutrition!;
  return { ...publicSourceOption(plate, slot, alreadyPlanned), ...total };
}

/** The same published-source eligibility as general planning; never clinical certification. */
export async function listSourceSwapOptions(userId: string, slot: Slot) {
  const context = await sourceContext(prisma, userId, slot);
  if (!context.unrestricted || !isPrimaryMealType(slot.mealType)) return [];
  const used = await prisma.mealPlan.findMany({
    where: {
      userId,
      planGroupId: slot.planGroupId,
      id: { not: slot.id },
      status: { in: ['APPROVED', 'PENDING_REVIEW'] },
      sourceRawRecipeCandidateId: { not: null },
    },
    select: { sourceRawRecipeCandidateId: true },
  });
  const usedIds = new Set(used.map((meal) => meal.sourceRawRecipeCandidateId));
  const options: ReturnType<typeof fullPlateOption>[] = [];
  let cursor: string | undefined;
  const range = getMealSlotCalorieRange(context.dailyTarget, slot.mealType);
  for (let pageNumber = 0; pageNumber < 18 && options.length < 120; pageNumber++) {
    const page = await databaseRecipeCandidateProvider.list({
      sourceKind: 'PANLASANG_PINOY',
      mealType: slot.mealType,
      dietaryPreference: context.profile.dietaryPreference || 'OMNIVORE',
      excludeIds: slot.sourceRawRecipeCandidateId ? [slot.sourceRawRecipeCandidateId] : [],
      calorieMinimum: Math.max(1, (range.minimum - (context.rice?.calories ?? 0) * 2.25) / 2),
      calorieMaximum: range.maximum / 0.5,
      cursor,
      limit: 120,
    });
    for (const candidate of page.items) {
      if (!candidate.reviewFreeBaseEligible) continue;
      const plate = rawRecipeServing({
        candidate,
        mealType: slot.mealType,
        dailyCalorieTarget: context.dailyTarget,
        ricePreference: context.profile.ricePreference,
        riceFood: context.rice,
      });
      if (
        !plate ||
        !validateGeneratedMealCandidate({
          ingredients: plate.ingredients,
          dietaryPreference: context.profile.dietaryPreference || 'OMNIVORE',
          allergens: [],
        }).accepted
      )
        continue;
      options.push(fullPlateOption(plate, slot, context.rice, usedIds.has(candidate.id)));
    }
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return options
    .sort(
      (a, b) => Math.abs(a.calories - slot.calories) - Math.abs(b.calories - slot.calories) || a.id.localeCompare(b.id)
    )
    .slice(0, 120);
}

async function buildSourcePreview(
  client: Prisma.TransactionClient,
  userId: string,
  mealPlanId: string,
  replacementId: string
) {
  const slot = await loadActionableUnloggedMealPlan(client, userId, mealPlanId);
  const context = await sourceContext(client, userId, slot);
  if (!context.unrestricted)
    throw new Error('Source recipes cannot replace reviewed meals for a health or allergy profile.');
  const candidateId = replacementId.slice(SOURCE_SWAP_PREFIX.length);
  if (!replacementId.startsWith(SOURCE_SWAP_PREFIX) || slot.sourceRawRecipeCandidateId === candidateId)
    throw new Error('Select a different replacement recipe.');
  const source = await client.rawRecipeCandidate.findUnique({
    where: { id: candidateId },
    include: {
      applicableMealTypes: { orderBy: { mealType: 'asc' } },
      libraryVariants: { where: { status: 'FLAGGED' }, select: { id: true }, orderBy: { id: 'asc' } },
    },
  });
  if (
    !source ||
    source.sourceName !== 'PANLASANG_PINOY' ||
    source.status !== 'AVAILABLE' ||
    source.libraryVariants.length
  )
    throw new Error('Selected source recipe is not available.');
  const candidate: RecipeCandidateProjection = projectRawRecipeCandidate(source);
  if (
    !candidate.applicableMealTypes.includes(slot.mealType) ||
    !candidate.dietaryTags.includes(context.profile.dietaryPreference || 'OMNIVORE')
  )
    throw new Error('Replacement must match your meal type and dietary preference.');
  const plate = rawRecipeServing({
    candidate,
    mealType: slot.mealType,
    dailyCalorieTarget: context.dailyTarget,
    ricePreference: context.profile.ricePreference,
    riceFood: context.rice,
  });
  if (
    !plate ||
    !validateGeneratedMealCandidate({
      ingredients: plate.ingredients,
      dietaryPreference: context.profile.dietaryPreference || 'OMNIVORE',
      allergens: [],
    }).accepted
  )
    throw new Error('This replacement does not fit the whole-plate target or rice preference.');
  const { preparedMeals, compositionRevisions } = await prepareGeneratedMealIngredients({
    meals: [
      {
        dayNumber: 1,
        mealType: slot.mealType,
        mealName: plate.displayName,
        description: `Source: ${plate.sourceUrl}\n${plate.description ?? ''}`,
        ...plate.nutrition!,
        ingredients: plate.ingredients.map((item) => ({ ...item, foodItemId: item.foodItemId ?? null })),
        rawCandidateId: candidateId,
        servingScale: plate.servingScale,
        pairedRiceG: plate.pairedRiceG,
        candidateProvenance: 'RAW_RECIPE_CORPUS',
      },
    ],
    unmatchedSlots: [{ dayNumber: 1, mealType: slot.mealType, scheduledDate: slot.scheduledDate }],
    startDate: slot.scheduledDate,
    userHasConditions: false,
    groundedFoodById: new Map(),
  });
  const prepared = preparedMeals[0];
  if (
    !prepared ||
    !isUnrestrictedPanlasangBaseEligible({
      source,
      candidateId,
      conditions: context.conditions,
      allergens: context.allergens,
      otherConditions: context.otherConditions,
      otherAllergies: context.otherAllergies,
      safetyEntries: context.user.safetyProfileEntries,
      preparedIngredients: prepared.ingredientsData,
      preparedNutrition: prepared,
      servingScale: prepared.servingScale,
    })
  )
    throw new Error('Source serving evidence is not eligible.');
  if (context.rice) compositionRevisions.set(context.rice.id, context.rice.compositionRevision);
  const replacement = fullPlateOption(
    {
      ...plate,
      nutrition: {
        calories: prepared.calories,
        proteinG: prepared.proteinG,
        carbsG: prepared.carbsG,
        fatG: prepared.fatG,
      },
    },
    slot,
    context.rice
  );
  assertMealSlotCalories(replacement.calories, context.dailyTarget, slot.mealType);
  const plans = await client.mealPlan.findMany({
    where: { userId, planGroupId: slot.planGroupId, ...getApprovedMealPlanStatusWhere() },
    include: {
      ingredients: true,
      servingComponents: { where: { componentType: 'COOKED_RICE' }, include: { foodItem: true } },
    },
    orderBy: { id: 'asc' },
  });
  const start = getStartOfManilaBusinessDay(slot.scheduledDate);
  const end = new Date(start.getTime() + 86400000);
  const projectedDayTotal = filterUserActionableMealPlans(plans)
    .filter((meal) => meal.scheduledDate >= start && meal.scheduledDate < end)
    .reduce((sum, meal) => sum + (meal.id === slot.id ? replacement.calories : meal.calories), 0);
  const projection = (meal: (typeof plans)[number]) => [
    ...meal.ingredients.map((item) => ({
      ingredientName: item.ingredientName,
      quantity: item.quantity,
      unit: item.unit,
    })),
    ...meal.servingComponents.flatMap((component) =>
      component.foodItem && component.quantityG
        ? [{ ingredientName: component.foodItem.name, quantity: component.quantityG, unit: 'g' }]
        : []
    ),
  ];
  const replacementIngredients = [
    ...prepared.ingredientsData.map((item) => ({
      ingredientName: item.ingredientName,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
    })),
    ...(plate.pairedRiceG && context.rice
      ? [{ ingredientName: context.rice.name, quantity: plate.pairedRiceG, unit: 'g' }]
      : []),
  ];
  const purchases = (await GroceryService.findCycleList(client, userId, slot.planGroupId))?.groceryItems ?? [];
  const delta = buildSwapShoppingDelta(
    plans.flatMap(projection),
    plans.flatMap((meal) => (meal.id === slot.id ? replacementIngredients : projection(meal))),
    purchases
  );
  replacement.alreadyPlannedInCycle = plans.some(
    (meal) => meal.id !== slot.id && meal.sourceRawRecipeCandidateId === candidateId
  );
  const snapshotHash = createHash('sha256')
    .update(
      JSON.stringify({
        userId,
        replacementId,
        slot,
        source,
        prepared,
        foodRevisions: [...compositionRevisions],
        profile: context.profile,
        safetyEntries: context.user.safetyProfileEntries,
        rice: context.rice,
        plans,
        purchases,
        replacement,
      })
    )
    .digest('hex');
  const requestKey = randomUUID();
  const expiresAt = Date.now() + SWAP_PREVIEW_TTL_MS;
  const preview = {
    previewToken: signSwapPreview({ requestKey, snapshotHash, expiresAt }),
    requestKey,
    expiresAt: new Date(expiresAt).toISOString(),
    snapshotHash,
    shoppingNeeds: delta.additions,
    shoppingRemovals: delta.removals,
    shoppingStarted: Boolean(slot.cycle.shoppingStartedAt),
    groceryDeltaAcknowledgmentRequired: Boolean(slot.cycle.shoppingStartedAt),
    alreadyPlannedInCycle: replacement.alreadyPlannedInCycle,
    pairedRiceG: plate.pairedRiceG,
    riceFoodItemId: plate.pairedRiceG ? context.rice?.id : null,
    originalMealName: slot.mealName,
    originalCalories: slot.calories,
    newMealName: replacement.mealName,
    newCalories: replacement.calories,
    calorieDelta: replacement.calories - slot.calories,
    projectedDayTotal: Math.round(projectedDayTotal),
    dailyTarget: context.dailyTarget,
    warningRequired: projectedDayTotal < context.dailyTarget * 0.85 || projectedDayTotal > context.dailyTarget * 1.15,
    replacement,
  };
  return { preview, prepared, slot, compositionRevisions, source };
}

export async function getSourceSwapPreview(
  userId: string,
  slotId: string,
  replacementId: string,
  client: Prisma.TransactionClient = prisma
) {
  return (await buildSourcePreview(client, userId, slotId, replacementId)).preview;
}

/** Replace dish, ingredients and all rice components atomically, retaining the existing slot ID. */
export async function executeSourceSwap(
  userId: string,
  slotId: string,
  replacementId: string,
  previewToken?: string,
  requestKey?: string,
  warningAcknowledged = false,
  groceryDeltaAcknowledged = false
) {
  await prisma.$transaction(
    async (tx) => {
      await lockUserProfile(tx, userId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
      if (!previewToken || !requestKey) throw new Error('Preview this swap before confirming.');
      const key = `${userId}:${requestKey}`;
      const replay = await tx.swapLog.findUnique({ where: { requestKey: key } });
      if (replay) {
        if (replay.mealPlanId !== slotId || replay.newLibraryMealId !== replacementId)
          throw new Error('Request key already used for a different swap.');
        return;
      }
      const proof = verifySwapPreview(previewToken);
      const { preview, prepared, slot, compositionRevisions } = await buildSourcePreview(
        tx,
        userId,
        slotId,
        replacementId
      );
      if (proof.requestKey !== requestKey || proof.snapshotHash !== preview.snapshotHash)
        throw new Error('Your recipe, profile, plan or shopping list changed. Review a fresh preview.');
      if (preview.warningRequired && !warningAcknowledged)
        throw new Error('Acknowledge the current calorie warning before swapping.');
      if (preview.groceryDeltaAcknowledgmentRequired && !groceryDeltaAcknowledged)
        throw new Error('Acknowledge the grocery additions and removals before swapping.');
      await MembershipService.assertSwap(userId, slot.planGroupId, tx);
      await assertFoodCompositionRevisions(tx, compositionRevisions);
      await tx.mealPlan.updateMany({
        where: {
          userId,
          planGroupId: slot.planGroupId,
          scheduledDate: slot.scheduledDate,
          mealType: slot.mealType,
          id: { not: slotId },
          status: { in: ['APPROVED', 'PENDING_REVIEW'] },
        },
        data: { status: 'CANCELLED' },
      });
      await tx.mealPlanClearanceUsage.deleteMany({ where: { mealPlanId: slotId } });
      await tx.mealPlan.update({
        where: { id: slotId },
        data: {
          mealName: prepared.mealName,
          description: prepared.description,
          calories: prepared.calories,
          proteinG: prepared.proteinG,
          carbsG: prepared.carbsG,
          fatG: prepared.fatG,
          libraryMealId: null,
          profileApprovalId: null,
          sourceRawRecipeCandidateId: prepared.rawCandidateId,
          candidateProvenance: 'RAW_RECIPE_CORPUS',
          aiConfidenceFlag: 'CAUTION',
          status: 'APPROVED',
          requiresSafetyRevalidation: false,
          safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
          highRiskReviewRequired: false,
          reviewApprovalCount: 0,
          firstApprovedByNutritionistId: null,
          firstApprovedAt: null,
          nutritionistId: null,
          nutritionistNote: null,
          reviewedAt: null,
          claimedByNutritionistId: null,
          claimedAt: null,
          reviewWorkKey: null,
          userSelectionPinnedAt: new Date(),
          selectionEvidence: {
            source: 'USER_SWAP',
            replacementKind: 'PANLASANG_SOURCE',
            sourceRawRecipeCandidateId: prepared.rawCandidateId!,
            servingScale: prepared.servingScale ?? 1,
            pinned: true,
          },
        },
      });
      await tx.mealIngredient.deleteMany({ where: { mealPlanId: slotId } });
      await tx.mealIngredient.createMany({
        data: prepared.ingredientsData.map((ingredient) => ({ ...ingredient, mealPlanId: slotId })),
      });
      await replacePlanBaseServing(tx, slotId, {
        ...prepared,
        ingredients: prepared.ingredientsData,
        evidenceSource: 'PANLASANG_PINOY_GENERAL_BASE',
      });
      if (preview.pairedRiceG && preview.riceFoodItemId)
        await composePlanWithPairedRice(tx, {
          mealPlanId: slotId,
          cookedRiceG: preview.pairedRiceG,
          fnriRiceFoodItemId: preview.riceFoodItemId,
        });
      await tx.swapLog.create({
        data: {
          mealPlanId: slotId,
          requestKey: key,
          newLibraryMealId: replacementId,
          originalMealName: slot.mealName,
          originalCalories: slot.calories,
          newMealName: prepared.mealName,
          newCalories: preview.newCalories,
          calorieDelta: preview.calorieDelta,
          warningShown: preview.warningRequired,
          warningAcknowledged,
          groceryDeltaAcknowledged,
        },
      });
      const log = {
        source: 'USER_SWAPPED' as const,
        mealName: prepared.mealName,
        calories: preview.replacement.calories,
        proteinG: preview.replacement.proteinG,
        carbsG: preview.replacement.carbsG,
        fatG: preview.replacement.fatG,
        dataSource: 'SYSTEM' as const,
        status: 'PENDING' as const,
      };
      await tx.mealLog.upsert({
        where: { mealPlanId: slotId },
        create: { userId, mealPlanId: slotId, ...log },
        update: log,
      });
      await GroceryService.generateGroceryList(userId, tx, slot.planGroupId, 'EXPLICIT');
      await recalculateDailyNutritionLog(userId, slot.scheduledDate, tx);
    },
    { timeout: 30000 }
  );
  return { success: true };
}
