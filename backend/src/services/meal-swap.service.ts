import { swapMacroContext } from './meal-macro-context.service';
import { loadActionableUnloggedMealPlan } from './meal-swap-read.service';
import {
  SOURCE_SWAP_PREFIX,
  listSourceSwapOptions,
  getSourceSwapPreview,
  executeSourceSwap,
} from './meal-swap-source.service';
import { hasDeclaredSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { ricePortionLabel } from '@/domain/rice-portion.policy';
import { resolveRecipeRiceRole } from '@/domain/recipe-rice-role.policy';
import { effectiveRecipeMealTypes } from '@/domain/meal-applicability.policy';
import { rankLibraryMeals } from '@/domain/library-ranking.policy';
import { MembershipService } from './membership.service';
import { recordMealSwapNotification } from './meal-swap-feedback.service';
import {
  filterUserActionableMealPlans,
  getApprovedMealPlanStatusWhere,
  getStartOfManilaBusinessDay,
  isApprovedMealLibraryStatus,
} from '@/domain/meal-actionability.policy';
import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import type { PublicMealCookingLink } from '@/domain/meal-cooking-link.policy';
import { toPublicMealImage, type PublicMealImage } from '@/domain/meal-image.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { resolvePlanTargetCalories } from '@/domain/plan-cycle-target.policy';
import { signSwapPreview, SWAP_PREVIEW_TTL_MS, verifySwapPreview } from '@/domain/swap-preview-token';
import { buildSwapShoppingDelta } from '@/domain/swap-shopping.policy';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import prisma from '@/lib/prisma';
import { HealthConditionType, MealType, Prisma, RecipeRiceRole, RicePreference } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { GroceryService } from './grocery.service';
import { resolveLibraryRecipeCookingLinks } from './library-recipe-cooking-link.service';
import { resolveLibraryRecipeImages } from './library-recipe-image.service';
import {
  certifiedLibraryMealInclude,
  isCertifiedLibraryMealCompatible,
  isProfileApprovedLibraryMealCompatible,
  queryEligibleLibraryMeals,
  queryEligibleLibraryPage,
  type CertifiedLibraryMeal,
} from './meal-library-candidate-query.service';
import { composePlanWithPairedRice, replacePlanBaseServing } from './meal-plan-serving.service';
import { recalculateDailyNutritionLog } from './meal-swap-nutrition.service';
import { resolveReplacementServing } from './meal-swap-serving.service';
import { lockUserProfile } from './profile-revision.service';

export function toPublicSwapOption(
  meal: CertifiedLibraryMeal & { alreadyPlannedInCycle?: boolean; pairedRiceG?: number | null },
  recipeImage?: PublicMealImage,
  cookingLink?: PublicMealCookingLink,
  reuseBasis: 'CERTIFIED_RECIPE' | 'PROFILE_MATCHED_APPROVAL' = 'CERTIFIED_RECIPE',
  profileScopeKey?: string
) {
  const assignedImage = toPublicMealImage(meal);
  const riceRole = resolveRecipeRiceRole(meal);
  const reviewer =
    reuseBasis === 'PROFILE_MATCHED_APPROVAL'
      ? meal.profileApprovals.find((entry) => entry.safetyScopeKey === profileScopeKey)?.reviewerNutritionist
      : meal.safetyReviewedByNutritionist;
  return {
    id: meal.id,
    mealName: meal.mealName,
    description: meal.description,
    mealType: meal.mealType,
    mealTypes: effectiveRecipeMealTypes(
      meal.mealName,
      null,
      meal.applicableMealTypes.map((entry) => entry.mealType)
    ),
    riceRole: riceRole.riceRole,
    riceRoleBasis: riceRole.basis,
    riceRoleReviewStatus: meal.riceRoleReviewStatus,
    includedRiceG: riceRole.riceRole === 'INCLUDES_RICE' ? riceRole.includedRiceG : null,
    servingDescription: meal.nutritionServingDescription || 'One recipe serving',
    pairedRiceG: meal.pairedRiceG ?? null,
    ricePortionLabel: meal.pairedRiceG ? ricePortionLabel(meal.pairedRiceG) : null,
    alreadyPlannedInCycle: 'alreadyPlannedInCycle' in meal ? Boolean(meal.alreadyPlannedInCycle) : false,
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
    image:
      assignedImage?.kind === 'EXACT' && (meal.imagePublicId || meal.adaptedImageUrl)
        ? assignedImage
        : recipeImage || assignedImage,
    cookingLink: cookingLink || null,
    reuseBasis,
    verifiedBy: reviewer?.user.name || 'System',
    prcLicenseNumber: reviewer?.prcLicenseNumber || 'N/A',
    verifier: reviewer
      ? {
          name: reviewer.user.name,
          image: reviewer.user.image || null,
          prcLicenseNumber: reviewer.prcLicenseNumber,
          prcLicenseExpiry: reviewer.prcLicenseExpiry,
          specialization: reviewer.specialization,
          yearsOfExperience: reviewer.yearsOfExperience,
          university: reviewer.university,
          bio: reviewer.bio,
        }
      : null,
  };
}

export class MealSwapService {
  /**
   * Returns a list of compatible verified replacement meals from MealLibrary.
   */
  static async getEligibleSwapOptions(userId: string, mealPlanId: string) {
    // 1. Fetch the target meal plan slot
    const mealPlan = await loadActionableUnloggedMealPlan(prisma, userId, mealPlanId);

    // 2. Fetch user profile, health conditions, and allergies
    const {
      user,
      profile: userProfile,
      planningTargets,
    } = await loadPlanningNutritionContext(prisma, userId, 'User profile not found.');
    const { healthConditions, allergies } = user;
    const userConditions = healthConditions.map((c) => c.condition);
    const userAllergens = allergies.map((a) => a.allergen);

    // 3. Query APPROVED library meals matching this mealType
    const usedLibraryMeals = await prisma.mealPlan.findMany({
      where: {
        userId,
        planGroupId: mealPlan.planGroupId,
        id: { not: mealPlan.id },
        libraryMealId: { not: null },
      },
      select: { libraryMealId: true },
    });
    const usedLibraryMealIds = new Set(
      usedLibraryMeals.map((item) => item.libraryMealId).filter((id): id is string => Boolean(id))
    );

    const [cycleSnapshot, riceFood] = await Promise.all([
      prisma.mealPlanCycleSnapshot.findUnique({ where: { planGroupId: mealPlan.planGroupId } }),
      userProfile.ricePreference !== RicePreference.NO_RICE &&
      !userConditions.some((condition) => condition !== HealthConditionType.NONE)
        ? prisma.foodItem.findFirst({
            where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
          })
        : Promise.resolve(null),
    ]);
    const dailyTarget = resolvePlanTargetCalories(
      cycleSnapshot?.dailyCalorieTarget,
      userProfile.dailyCalorieTarget,
      2000
    );
    const macros = await swapMacroContext(prisma, userId, mealPlan, planningTargets);
    const libraryMeals = await queryEligibleLibraryMeals({
      mealType: mealPlan.mealType,
      dailyCalorieTarget: dailyTarget,
      skipCalorieFilter: true,
      userConditions,
      userAllergens,
      profile: { ...userProfile, userId, safetyEntries: user.safetyProfileEntries },
      excludeIds: [mealPlan.libraryMealId].filter((id): id is string => Boolean(id)),
      limit: 120,
    });

    const ricePreferenceScore = (riceRole: RecipeRiceRole | null) => {
      if (userProfile.ricePreference === RicePreference.NO_RICE) return riceRole === RecipeRiceRole.STANDALONE ? 1 : 0;
      if (userProfile.ricePreference === RicePreference.WITH_RICE)
        return riceRole === RecipeRiceRole.PAIR_WITH_RICE || riceRole === RecipeRiceRole.INCLUDES_RICE ? 1 : 0;
      return 0;
    };

    // Safety eligibility has already been enforced. Ranking may use preference
    // and variety facts but never promote a meal across a hard filter.
    const eligibleMeals = libraryMeals
      .filter((meal) => meal.id !== mealPlan.libraryMealId)
      .flatMap((meal) => {
        const serving = resolveReplacementServing({
          meal,
          mealType: mealPlan.mealType,
          dailyTarget,
          ricePreference: userProfile.ricePreference,
          hasConditions: hasDeclaredSafetyRestrictions({
            healthConditions: userConditions,
            allergies: userAllergens,
            otherConditions: userProfile.otherConditions,
            otherAllergies: userProfile.otherAllergies,
            safetyEntries: user.safetyProfileEntries,
          }),
          riceFood,
          macroTarget: macros.budget,
          scoreNutrition: macros.scoreReplacement,
        });
        if (!serving) return [];
        return [
          {
            ...meal,
            ...serving,
            mealTypes: meal.applicableMealTypes.map((entry) => entry.mealType),
            alreadyPlannedInCycle: usedLibraryMealIds.has(meal.id),
            ricePreferenceScore: ricePreferenceScore(resolveRecipeRiceRole(meal).riceRole),
            pairedRiceG: serving.pairedRiceG,
            nutritionServingDescription: serving.pairedRiceG
              ? `${meal.nutritionServingDescription || 'One recipe serving'} with ${ricePortionLabel(serving.pairedRiceG)}`
              : meal.nutritionServingDescription,
          },
        ];
      });

    const [recipeImages, cookingLinks] = await Promise.all([
      resolveLibraryRecipeImages(eligibleMeals),
      resolveLibraryRecipeCookingLinks(eligibleMeals),
    ]);

    const sourceOptions = await listSourceSwapOptions(userId, mealPlan);
    const libraryOptions = rankLibraryMeals(eligibleMeals, dailyTarget, mealPlan.calories, mealPlan.mealType, {
      proteinG: mealPlan.proteinG,
      carbsG: mealPlan.carbsG,
      fatG: mealPlan.fatG,
    }).map((meal) => {
      const certified = isCertifiedLibraryMealCompatible(meal, userConditions, userAllergens, {
        ...userProfile,
        userId,
        safetyEntries: user.safetyProfileEntries,
      });
      return toPublicSwapOption(
        meal,
        recipeImages.get(meal.id),
        cookingLinks.get(meal.id),
        certified ? 'CERTIFIED_RECIPE' : 'PROFILE_MATCHED_APPROVAL',
        mealApprovalSafetyScope({
          conditions: userConditions,
          allergens: userAllergens,
          otherConditions: userProfile.otherConditions,
          otherAllergies: userProfile.otherAllergies,
          safetyEntries: user.safetyProfileEntries,
        }).key
      );
    });
    return {
      swapOptions: [...libraryOptions, ...sourceOptions]
        .map((option) => {
          const analysis = macros.analyze(option);
          return { ...option, nutritionFitScore: analysis.fitScore, nutritionMatch: analysis.nutritionMatch };
        })
        .sort((a, b) => a.nutritionFitScore - b.nutritionFitScore || a.id.localeCompare(b.id)),
    };
  }

  /**
   * Generates a preview of the calorie delta and projected day total before confirming a swap.
   */
  static async getSwapPreview(
    userId: string,
    mealPlanId: string,
    libraryMealId: string,
    client: Prisma.TransactionClient = prisma
  ) {
    if (libraryMealId.startsWith(SOURCE_SWAP_PREFIX))
      return getSourceSwapPreview(userId, mealPlanId, libraryMealId, client);
    // 1. Fetch the current meal plan slot
    const mealPlan = await loadActionableUnloggedMealPlan(client, userId, mealPlanId);

    if (mealPlan.libraryMealId === libraryMealId) {
      throw new Error('This recipe is already scheduled in the selected slot.');
    }

    // 2. Fetch the proposed replacement library meal
    const libraryMeal = await client.mealLibrary.findUnique({
      where: { id: libraryMealId },
      include: certifiedLibraryMealInclude,
    });
    if (!libraryMeal) throw new Error('Library meal not found.');
    if (!isApprovedMealLibraryStatus(libraryMeal.status)) {
      throw new Error('Selected replacement meal is not available or approved.');
    }

    const {
      user,
      profile: userProfile,
      planningTargets,
    } = await loadPlanningNutritionContext(client, userId, 'User profile not found.');
    if (
      !isCertifiedLibraryMealCompatible(
        libraryMeal,
        user.healthConditions.map((item) => item.condition),
        user.allergies.map((item) => item.allergen),
        { ...userProfile, userId, safetyEntries: user.safetyProfileEntries }
      ) &&
      !isProfileApprovedLibraryMealCompatible(
        libraryMeal,
        user.healthConditions.map((item) => item.condition),
        user.allergies.map((item) => item.allergen),
        { ...userProfile, userId, safetyEntries: user.safetyProfileEntries }
      )
    ) {
      throw new Error('Selected replacement meal is not certified for your current health profile.');
    }

    if (
      !effectiveRecipeMealTypes(
        libraryMeal.mealName,
        null,
        libraryMeal.applicableMealTypes.map((entry) => entry.mealType)
      ).includes(mealPlan.mealType)
    ) {
      throw new Error('Replacement must match the meal type.');
    }
    const [cycleSnapshot, riceFood] = await Promise.all([
      client.mealPlanCycleSnapshot.findUnique({ where: { planGroupId: mealPlan.planGroupId } }),
      userProfile.ricePreference !== RicePreference.NO_RICE
        ? client.foodItem.findFirst({
            where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
          })
        : Promise.resolve(null),
    ]);
    const dailyTarget = resolvePlanTargetCalories(
      cycleSnapshot?.dailyCalorieTarget,
      userProfile.dailyCalorieTarget,
      2000
    );
    const macros = await swapMacroContext(client, userId, mealPlan, planningTargets);
    const serving = resolveReplacementServing({
      meal: libraryMeal,
      mealType: mealPlan.mealType,
      dailyTarget,
      ricePreference: userProfile.ricePreference,
      hasConditions: hasDeclaredSafetyRestrictions({
        healthConditions: user.healthConditions.map((item) => item.condition),
        allergies: user.allergies.map((item) => item.allergen),
        otherConditions: userProfile.otherConditions,
        otherAllergies: userProfile.otherAllergies,
        safetyEntries: user.safetyProfileEntries,
      }),
      riceFood,
      macroTarget: macros.budget,
      scoreNutrition: macros.scoreReplacement,
    });
    if (!serving) throw new Error('This serving does not fit your current meal target or rice preference.');
    // 3. Fetch all meals on the same day in the same planGroup
    const startOfDay = getStartOfManilaBusinessDay(mealPlan.scheduledDate);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000 - 1);

    const dayMealRows = await client.mealPlan.findMany({
      where: {
        planGroupId: mealPlan.planGroupId,
        userId,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
        ...getApprovedMealPlanStatusWhere(),
      },
    });
    const dayMeals = filterUserActionableMealPlans(dayMealRows);

    // 4. Calculate projected day total (replace current meal's cals with new)
    let projectedDayTotal = 0;
    for (const meal of dayMeals) {
      if (meal.id === mealPlanId) {
        projectedDayTotal += serving.calories;
      } else {
        projectedDayTotal += meal.calories;
      }
    }

    // 5. Get daily target
    // 6. Determine if warning is needed (±15%)
    const lowerBound = dailyTarget * 0.85;
    const upperBound = dailyTarget * 1.15;
    const warningRequired = projectedDayTotal < lowerBound || projectedDayTotal > upperBound;

    const cycleMeals = await client.mealPlan.findMany({
      where: { userId, planGroupId: mealPlan.planGroupId, ...getApprovedMealPlanStatusWhere() },
      include: {
        ingredients: true,
        servingComponents: { where: { componentType: 'COOKED_RICE' }, include: { foodItem: true } },
      },
      orderBy: { id: 'asc' },
    });
    const list = await GroceryService.findCycleList(client, userId, mealPlan.planGroupId);
    const purchases = list?.groceryItems ?? [];
    const ingredientProjection = (meal: (typeof cycleMeals)[number]) => [
      ...meal.ingredients.map((ingredient) => ({
        ingredientName: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
      ...meal.servingComponents.flatMap((component) =>
        component.foodItem && component.quantityG
          ? [{ ingredientName: component.foodItem.name, quantity: component.quantityG, unit: 'g' }]
          : []
      ),
    ];
    const replacementIngredients = [
      ...libraryMeal.ingredients.map((ingredient) => ({
        ingredientName: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
      ...(serving.pairedRiceG && riceFood
        ? [{ ingredientName: riceFood.name, quantity: serving.pairedRiceG, unit: 'g' }]
        : []),
    ];
    const shoppingDelta = buildSwapShoppingDelta(
      cycleMeals.flatMap(ingredientProjection),
      cycleMeals.flatMap((meal) => (meal.id === mealPlanId ? replacementIngredients : ingredientProjection(meal))),
      purchases
    );
    const alreadyPlannedInCycle = cycleMeals.some(
      (candidate) => candidate.id !== mealPlanId && candidate.libraryMealId === libraryMeal.id
    );
    // The signed, expiring token binds confirmation to every input that could
    // change its safety, nutrition, or grocery meaning.
    const nutritionAnalysis = macros.analyze(serving);
    const snapshotHash = createHash('sha256')
      .update(
        JSON.stringify({
          userId,
          mealPlan,
          libraryMeal,
          revision: userProfile.revision,
          dailyTarget,
          dayMeals,
          cycleMeals,
          purchases,
          riceFood,
          macroTarget: macros.budget,
          serving,
          nutritionAnalysis,
        })
      )
      .digest('hex');
    const requestKey = randomUUID();
    const expiresAt = Date.now() + SWAP_PREVIEW_TTL_MS;
    const previewToken = signSwapPreview({ requestKey, snapshotHash, expiresAt });
    return {
      previewToken,
      requestKey,
      expiresAt: new Date(expiresAt).toISOString(),
      snapshotHash,
      nutritionAnalysis,
      shoppingNeeds: shoppingDelta.additions,
      shoppingRemovals: shoppingDelta.removals,
      shoppingStarted: Boolean(mealPlan.cycle.shoppingStartedAt),
      groceryDeltaAcknowledgmentRequired: Boolean(
        mealPlan.cycle.shoppingStartedAt && (shoppingDelta.additions.length || shoppingDelta.removals.length)
      ),
      alreadyPlannedInCycle,
      pairedRiceG: serving.pairedRiceG,
      riceFoodItemId: serving.pairedRiceG ? riceFood?.id : null,
      originalMealName: mealPlan.mealName,
      originalCalories: mealPlan.calories,
      newMealName: libraryMeal.mealName,
      newCalories: serving.calories,
      calorieDelta: serving.calories - mealPlan.calories,
      projectedDayTotal: Math.round(projectedDayTotal),
      dailyTarget,
      warningRequired,
      replacement: toPublicSwapOption({
        ...libraryMeal,
        ...serving,
        alreadyPlannedInCycle,
        nutritionServingDescription: serving.pairedRiceG
          ? `${libraryMeal.nutritionServingDescription || 'One recipe serving'} with ${ricePortionLabel(serving.pairedRiceG)}`
          : libraryMeal.nutritionServingDescription,
      }),
    };
  }

  /**
   * Swaps a user's meal plan slot with a verified library meal.
   */
  static async swapMeal(
    userId: string,
    mealPlanId: string,
    newLibraryMealId: string,
    warningShown?: boolean,
    warningAcknowledged?: boolean,
    previewToken?: string,
    requestKey?: string,
    groceryDeltaAcknowledged?: boolean
  ) {
    if (newLibraryMealId.startsWith(SOURCE_SWAP_PREFIX))
      return executeSourceSwap(
        userId,
        mealPlanId,
        newLibraryMealId,
        previewToken,
        requestKey,
        warningAcknowledged,
        groceryDeltaAcknowledged
      );
    const result = await prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        if (!requestKey || !previewToken) throw new Error('Preview this swap before confirming.');
        const key = userId + ':' + requestKey;
        const previous = await tx.swapLog.findUnique({ where: { requestKey: key } });
        if (previous) {
          if (previous.mealPlanId !== mealPlanId || previous.newLibraryMealId !== newLibraryMealId)
            throw new Error('Request key already used for a different swap.');
          return {
            success: true,
            swapsRemaining: null,
            updatedPlan: await tx.mealPlan.findUniqueOrThrow({ where: { id: mealPlanId } }),
          };
        }
        const previewProof = verifySwapPreview(previewToken);
        if (previewProof.requestKey !== requestKey) throw new Error('Swap request key does not match its preview.');
        const preview = await this.getSwapPreview(userId, mealPlanId, newLibraryMealId, tx);
        if (preview.snapshotHash !== previewProof.snapshotHash)
          throw new Error('Your plan, profile or shopping list changed. Review a fresh preview.');
        if (preview.warningRequired && !warningAcknowledged)
          throw new Error('Acknowledge the current calorie warning before swapping.');
        if (preview.groceryDeltaAcknowledgmentRequired && !groceryDeltaAcknowledged)
          throw new Error('Shopping has started. Acknowledge the grocery additions and removals before swapping.');
        // 1. Fetch target meal plan slot
        const mealPlan = await loadActionableUnloggedMealPlan(tx, userId, mealPlanId);

        const allowance = await MembershipService.assertSwap(userId, mealPlan.planGroupId, tx);

        // 2. Fetch user profile, health conditions, and allergies
        const { user, profile: userProfile } = await loadPlanningNutritionContext(
          tx,
          userId,
          'User profile not found.'
        );
        const { healthConditions, allergies } = user;
        const userConditions = healthConditions.map((c) => c.condition);
        const userAllergens = allergies.map((a) => a.allergen);

        // 3. Fetch and verify replacement meal
        const libraryMeal = await tx.mealLibrary.findUnique({
          where: { id: newLibraryMealId },
          include: certifiedLibraryMealInclude,
        });

        if (!libraryMeal || !isApprovedMealLibraryStatus(libraryMeal.status)) {
          throw new Error('Selected replacement meal is not available or approved.');
        }

        if (
          !effectiveRecipeMealTypes(
            libraryMeal.mealName,
            null,
            libraryMeal.applicableMealTypes.map((entry) => entry.mealType)
          ).includes(mealPlan.mealType)
        ) {
          throw new Error('Selected replacement meal type does not match slot meal type.');
        }

        const certified = isCertifiedLibraryMealCompatible(libraryMeal, userConditions, userAllergens, {
          ...userProfile,
          userId,
          safetyEntries: user.safetyProfileEntries,
        });
        const profileApproved =
          !certified &&
          isProfileApprovedLibraryMealCompatible(libraryMeal, userConditions, userAllergens, {
            ...userProfile,
            userId,
            safetyEntries: user.safetyProfileEntries,
          });
        if (!certified && !profileApproved) {
          throw new Error('Selected meal is not certified for your current health profile.');
        }
        const profileScope = profileApproved
          ? mealApprovalSafetyScope({
              conditions: userConditions,
              allergens: userAllergens,
              otherConditions: userProfile.otherConditions,
              otherAllergies: userProfile.otherAllergies,
              safetyEntries: user.safetyProfileEntries,
            })
          : null;
        const approval = profileApproved
          ? libraryMeal.profileApprovals.find(
              (item) =>
                item.safetyScopeKey === profileScope?.key &&
                !item.flaggedAt &&
                item.reviewDueAt > new Date() &&
                item.recipeSignature === libraryMeal.recipeSignature &&
                item.evidenceRevision === libraryMeal.safetyEvidenceRevision
            )
          : null;
        if (profileApproved && !approval) throw new Error('Approval changed during swap. Please retry.');

        // A user-selected upcoming slot wins over ordinary pending candidates.
        // Cancel them in the same transaction so a later review or deadline
        // fallback cannot publish a competing meal for this date and type.
        await tx.mealPlan.updateMany({
          where: {
            userId,
            planGroupId: mealPlan.planGroupId,
            scheduledDate: mealPlan.scheduledDate,
            mealType: mealPlan.mealType,
            id: { not: mealPlan.id },
            status: { in: ['APPROVED', 'PENDING_REVIEW'] },
          },
          data: { status: 'CANCELLED' },
        });

        // 4. Update MealPlan row details
        const updatedPlan = await tx.mealPlan.update({
          where: { id: mealPlanId },
          data: {
            mealName: libraryMeal.mealName,
            description: libraryMeal.description,
            calories: libraryMeal.calories,
            proteinG: libraryMeal.proteinG,
            carbsG: libraryMeal.carbsG,
            fatG: libraryMeal.fatG,
            libraryMealId: libraryMeal.id,
            profileApprovalId: approval?.id ?? null,
            sourceRawRecipeCandidateId: null,
            candidateProvenance: 'CERTIFIED_LIBRARY',
            status: 'APPROVED',
            requiresSafetyRevalidation: false,
            safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
            highRiskReviewRequired: false,
            reviewApprovalCount: 1,
            nutritionistId: approval?.reviewerNutritionistId ?? libraryMeal.safetyReviewedByNutritionistId,
            reviewedAt: approval?.approvedAt ?? new Date(),
            userSelectionPinnedAt: new Date(),
            selectionEvidence: {
              source: 'USER_SWAP',
              pinned: true,
              libraryMealId: libraryMeal.id,
              evidenceRevision: libraryMeal.safetyEvidenceRevision,
              policyVersion: libraryMeal.safetyPolicyVersion,
            },
          },
        });

        // 5. Copy the certified first-class library ingredients, including quantities.
        await tx.mealIngredient.deleteMany({
          where: { mealPlanId },
        });

        const ingredientsData = libraryMeal.ingredients.map((ing) => ({
          ingredientName: ing.ingredientName,
          category: ing.category,
          foodItemId: ing.foodItemId,
          dataSource: ing.dataSource,
          quantity: ing.quantity,
          unit: ing.unit,
        }));

        if (ingredientsData.length > 0) {
          await tx.mealIngredient.createMany({
            data: ingredientsData.map((ing) => ({
              mealPlanId,
              ingredientName: ing.ingredientName,
              category: ing.category,
              foodItemId: ing.foodItemId,
              dataSource: ing.dataSource,
              quantity: ing.quantity,
              unit: ing.unit,
            })),
          });
        }
        const serving = await replacePlanBaseServing(tx, mealPlanId, {
          ...libraryMeal,
          mealType: mealPlan.mealType,
          recipeSignature: libraryMeal.recipeSignature,
          ingredients: ingredientsData,
          evidenceSource: 'CERTIFIED_LIBRARY_SWAP',
        });
        await tx.mealPlanClearanceUsage.deleteMany({ where: { mealPlanId } });
        const requiredConditions = userConditions.filter(
          (condition): condition is HealthConditionType => condition !== HealthConditionType.NONE
        );
        if (requiredConditions.length) {
          const usages = requiredConditions.map((condition) => {
            const clearance = libraryMeal.conditionClearances.find(
              (candidate) =>
                candidate.condition === condition &&
                candidate.state === 'ACTIVE' &&
                candidate.recipeSignature === libraryMeal.recipeSignature &&
                candidate.evidenceRevision === libraryMeal.safetyEvidenceRevision &&
                (!candidate.userScopeId || candidate.userScopeId === userId)
            );
            if (!clearance) throw new Error('Condition clearance changed during swap. Please retry.');
            return {
              mealPlanId,
              clearanceId: clearance.id,
              condition,
              composedServingSignature: serving.composedServingSignature,
            };
          });
          await tx.mealPlanClearanceUsage.createMany({ data: usages });
        }
        if (preview.pairedRiceG && preview.riceFoodItemId) {
          await composePlanWithPairedRice(tx, {
            mealPlanId,
            cookedRiceG: preview.pairedRiceG,
            fnriRiceFoodItemId: preview.riceFoodItemId,
          });
        }

        // 6. Increment usageCount on newly selected library entry
        await tx.mealLibrary.update({
          where: { id: libraryMeal.id },
          data: {
            usageCount: { increment: 1 },
          },
        });

        // 7. Create the idempotent SwapLog audit entry.
        await tx.swapLog.create({
          data: {
            mealPlanId,
            originalMealName: mealPlan.mealName,
            originalCalories: mealPlan.calories,
            newMealName: libraryMeal.mealName,
            newCalories: preview.newCalories,
            calorieDelta: preview.calorieDelta,
            requestKey: key,
            newLibraryMealId,
            warningShown: preview.warningRequired,
            warningAcknowledged: warningAcknowledged || false,
            groceryDeltaAcknowledged: groceryDeltaAcknowledged || false,
          },
        });

        // 8. Create MealLog with USER_SWAPPED source
        await tx.mealLog.upsert({
          where: { mealPlanId },
          update: {
            source: 'USER_SWAPPED',
            mealName: libraryMeal.mealName,
            calories: preview.replacement.calories,
            proteinG: preview.replacement.proteinG,
            carbsG: preview.replacement.carbsG,
            fatG: preview.replacement.fatG,
            dataSource: 'FNRI',
            status: 'PENDING',
          },
          create: {
            userId,
            mealPlanId,
            source: 'USER_SWAPPED',
            mealName: libraryMeal.mealName,
            calories: preview.replacement.calories,
            proteinG: preview.replacement.proteinG,
            carbsG: preview.replacement.carbsG,
            fatG: preview.replacement.fatG,
            dataSource: 'FNRI',
            status: 'PENDING',
          },
        });

        await GroceryService.generateGroceryList(userId, tx, mealPlan.planGroupId, 'EXPLICIT');
        await MealSwapService.recalculateDailyNutritionLog(userId, updatedPlan.scheduledDate, tx);
        const swapsRemaining = await recordMealSwapNotification(tx, userId, allowance);
        return {
          success: true,
          swapsRemaining,
          updatedPlan,
        };
      },
      { timeout: 30_000 }
    );

    return {
      success: true,
      swapsRemaining: result.swapsRemaining,
    };
  }

  /**
   * Recalculates DailyNutritionLog values if an upcoming meal on that day is swapped
   */
  static recalculateDailyNutritionLog = recalculateDailyNutritionLog;

  /**
   * Returns all approved verified meals from MealLibrary that are clinically compatible with a user profile.
   */
  static async getCompatibleLibraryMeals(
    userId: string,
    input: {
      mealType?: MealType;
      search?: string;
      date?: string;
      riceRole?: 'PAIR_WITH_RICE' | 'STANDALONE' | 'INCLUDES_RICE';
      cursor?: string;
      limit?: number;
    }
  ) {
    // 1. Fetch user profile, health conditions, and allergies
    const { user, profile: userProfile } = await loadPlanningNutritionContext(
      prisma,
      userId,
      'User profile not found.'
    );
    const { healthConditions, allergies } = user;
    const userConditions = healthConditions.map((c) => c.condition);
    const userAllergens = allergies.map((a) => a.allergen);

    // 2. Query APPROVED library meals matching the optional mealType and search
    const page = await queryEligibleLibraryPage({
      userId,
      mealType: input.mealType,
      userConditions,
      userAllergens,
      profile: { ...userProfile, userId, safetyEntries: user.safetyProfileEntries },
      search: input.search,
      riceRole: input.riceRole,
      cursor: input.cursor,
      limit: input.limit,
      safetyOnly: true,
      includeProfileApproved: true,
    });

    const [recipeImages, cookingLinks] = await Promise.all([
      resolveLibraryRecipeImages(page.items),
      resolveLibraryRecipeCookingLinks(page.items),
    ]);
    return {
      items: page.items.map((meal) => ({
        ...toPublicSwapOption(
          meal,
          recipeImages.get(meal.id),
          cookingLinks.get(meal.id),
          isCertifiedLibraryMealCompatible(
            meal,
            userConditions,
            userAllergens,
            {
              ...userProfile,
              userId,
              safetyEntries: user.safetyProfileEntries,
            },
            { safetyOnly: true }
          )
            ? 'CERTIFIED_RECIPE'
            : 'PROFILE_MATCHED_APPROVAL',
          mealApprovalSafetyScope({
            conditions: userConditions,
            allergens: userAllergens,
            otherConditions: userProfile.otherConditions,
            otherAllergies: userProfile.otherAllergies,
            safetyEntries: user.safetyProfileEntries,
          }).key
        ),
        matchesDietaryPreference:
          !userProfile.dietaryPreference ||
          (Array.isArray(meal.dietaryTags) && meal.dietaryTags.includes(userProfile.dietaryPreference)),
      })),
      nextCursor: page.nextCursor,
      total: page.total,
    };
  }
}
