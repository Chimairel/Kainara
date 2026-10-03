import { healthDetailsRequirements } from '@/domain/health-details.policy';
import prisma from '@/lib/prisma';
import { PLANNING_PROFILE_FIELDS, reportProfile, planningInputsMatch } from '@/domain/planning-report.policy';
import { AIConfidenceFlag, MealPlanStatus } from '@prisma/client';
import { approveMealPlan } from './nutritionist-approval.service';

import { getNutritionistReviewableMealPlanWhere } from '@/domain/meal-actionability.policy';
import { classifyMealIngredients } from '@/domain/meal-ingredient-classification.policy';
import {
  getReviewClaimCooldownUntil,
  getReviewClaimCutoff,
  getReviewPriority,
  isReviewClaimActive,
  REVIEW_CLAIM_COOLDOWN_MS,
  REVIEW_CLAIM_TTL_MS,
} from '@/domain/nutritionist-review.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { compareDeadlineReviewPriority } from '@/domain/upcoming-preparation.policy';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { evaluateApprovedConditionRules } from './condition-rule.service';
import { isGeneratedBaseVerified } from './meal-base-verification.service';
import { getNutritionistApprovedMeals } from './nutritionist-approved-meals.service';
import { NutritionistReplacementService } from './nutritionist-replacement.service';

import { CLINICAL_EVIDENCE_REQUIREMENT_POLICY_VERSION } from '@/domain/clinical-evidence-requirement.policy';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { resolveMealPlanDispute } from './nutritionist-dispute.service';
import { rejectMealPlan } from './nutritionist-rejection.service';

async function reviewReadinessByUser(userIds: string[]) {
  if (!userIds.length) return new Map<string, { ready: boolean; specific: boolean }>();
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    include: {
      userProfile: true,
      healthConditions: true,
      allergies: true,
      clinicalContextResponses: true,
    },
  });
  return new Map(
    users.map((user) => [
      user.id,
      {
        ready: healthDetailsRequirements(user).every((item) => item.state === 'READY'),
        specific: user.clinicalContextResponses.length > 0,
      },
    ])
  );
}

export class NutritionistReviewService {
  static async getReviewQueueCount(_nutritionistProfileId: string) {
    const plans = await prisma.mealPlan.findMany({
      where: getNutritionistReviewableMealPlanWhere(),
      select: {
        id: true,
        userId: true,
        reviewWorkKey: true,
        highRiskReviewRequired: true,
        reviewApprovalCount: true,
        firstApprovedByNutritionistId: true,
        candidateProvenance: true,
        baseRecipeSignature: true,
      },
    });
    const readiness = await reviewReadinessByUser([...new Set(plans.map((plan) => plan.userId))]);
    const generatedSignatures = [
      ...new Set(
        plans.flatMap((plan) =>
          plan.candidateProvenance === 'AI_FROM_SCRATCH' && plan.baseRecipeSignature ? [plan.baseRecipeSignature] : []
        )
      ),
    ];
    const verifiedGenerated = generatedSignatures.length
      ? await prisma.mealBaseVerification.findMany({
          where: { targetKind: 'GENERATED_RECIPE', status: 'VERIFIED', targetId: { in: generatedSignatures } },
          select: { targetId: true, revisionKey: true },
        })
      : [];
    const verifiedSignatures = new Set(
      verifiedGenerated.filter((item) => item.targetId === item.revisionKey).map((item) => item.targetId)
    );
    const work = new Set<string>();
    for (const plan of plans) {
      if (
        readiness.get(plan.userId)?.ready === false ||
        (plan.candidateProvenance === 'AI_FROM_SCRATCH' &&
          (!plan.baseRecipeSignature || !verifiedSignatures.has(plan.baseRecipeSignature)))
      )
        continue;
      work.add(
        `${readiness.get(plan.userId)?.specific ? plan.userId + ':' : ''}${plan.reviewWorkKey ?? `PLAN:${plan.id}`}`
      );
    }
    return work.size;
  }

  static async getReviewQueue(nutritionistProfileId?: string) {
    const now = new Date();
    const claimCutoff = getReviewClaimCutoff(now);
    // Show the whole shared queue, including items actively claimed by peers.
    const pendingMeals = await prisma.mealPlan.findMany({
      where: getNutritionistReviewableMealPlanWhere(),
      include: {
        user: { select: { id: true, name: true } },
        ingredients: true,
        cycle: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            shoppingDeadlineAt: true,
            assuranceTier: true,
            status: true,
          },
        },
        claimedByNutritionist: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const userIds = [...new Set(pendingMeals.map((meal) => meal.userId))];
    const readinessByUser = await reviewReadinessByUser(userIds);
    const generatedSignatures = [
      ...new Set(
        pendingMeals.flatMap((meal) =>
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
    const verifiedSignatures = new Set(
      verifiedGenerated.filter((item) => item.targetId === item.revisionKey).map((item) => item.targetId)
    );
    const clinicallyReadyMeals = pendingMeals.filter(
      (meal) =>
        readinessByUser.get(meal.userId)?.ready === true &&
        (meal.candidateProvenance !== 'AI_FROM_SCRATCH' ||
          (!!meal.baseRecipeSignature && verifiedSignatures.has(meal.baseRecipeSignature)))
    );

    const workCounts = new Map<string, number>();
    for (const meal of clinicallyReadyMeals) {
      const key = `${readinessByUser.get(meal.userId)?.specific ? meal.userId + ':' : ''}${meal.reviewWorkKey ?? `PLAN:${meal.id}`}`;
      workCounts.set(key, (workCounts.get(key) ?? 0) + 1);
    }
    const sorted = clinicallyReadyMeals.sort((a, b) => {
      if (nutritionistProfileId) {
        const aCooling = Boolean(getReviewClaimCooldownUntil(a, nutritionistProfileId, now));
        const bCooling = Boolean(getReviewClaimCooldownUntil(b, nutritionistProfileId, now));
        if (aCooling !== bCooling) return aCooling ? 1 : -1;
      }
      const deadlineOrder = compareDeadlineReviewPriority(
        {
          shoppingDeadlineAt: a.cycle.shoppingDeadlineAt,
          scheduledDate: a.scheduledDate,
          enhancedSecondReview: false,
          createdAt: a.createdAt,
        },
        {
          shoppingDeadlineAt: b.cycle.shoppingDeadlineAt,
          scheduledDate: b.scheduledDate,
          enhancedSecondReview: false,
          createdAt: b.createdAt,
        }
      );
      return deadlineOrder || getReviewPriority(a.aiConfidenceFlag) - getReviewPriority(b.aiConfidenceFlag);
    });

    const seenWork = new Set<string>();
    const coalesced = sorted.filter((meal) => {
      const key = `${readinessByUser.get(meal.userId)?.specific ? meal.userId + ':' : ''}${meal.reviewWorkKey ?? `PLAN:${meal.id}`}`;
      if (seenWork.has(key)) return false;
      seenWork.add(key);
      return true;
    });

    const result = coalesced.map((meal) => {
      const isClaimed = meal.claimedByNutritionistId && meal.claimedAt && meal.claimedAt >= claimCutoff;
      const claimedByMe = isClaimed && meal.claimedByNutritionistId === nutritionistProfileId;
      const claimedByOther = isClaimed && meal.claimedByNutritionistId !== nutritionistProfileId;
      const claimedByName = claimedByOther ? meal.claimedByNutritionist?.user?.name || 'Another nutritionist' : null;
      const cooldownUntil = nutritionistProfileId
        ? getReviewClaimCooldownUntil(meal, nutritionistProfileId, now)
        : null;

      return {
        id: meal.id,
        planGroupId: meal.planGroupId,
        userId: meal.userId,
        nutritionistId: meal.nutritionistId,
        libraryMealId: meal.libraryMealId,
        status: meal.status,
        mealType: meal.mealType,
        mealName: meal.mealName,
        description: meal.description,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        aiConfidenceFlag: meal.requiresSafetyRevalidation ? AIConfidenceFlag.NEEDS_REVIEW : meal.aiConfidenceFlag,
        requiresSafetyRevalidation: meal.requiresSafetyRevalidation,
        planType: meal.planType,
        nutritionistNote: meal.nutritionistNote,
        scheduledDate: meal.scheduledDate,
        reviewedAt: meal.reviewedAt,
        createdAt: meal.createdAt,
        user: meal.user,
        ingredients: meal.ingredients,
        highRiskReviewRequired: meal.highRiskReviewRequired,
        reviewApprovalCount: meal.reviewApprovalCount,
        requiresIndependentSecondReview: false,
        intendedCycle: {
          id: meal.cycle.id,
          startDate: meal.cycle.startDate,
          endDate: meal.cycle.endDate,
          status: meal.cycle.status,
        },
        shoppingDeadlineAt: meal.cycle.shoppingDeadlineAt,
        cookDeadlineAt: meal.scheduledDate,
        assuranceTier: meal.cycle.assuranceTier,
        reviewStage: 'PRIMARY',
        remainingReviewers: 1,
        deterministicFindings: {
          confidence: meal.aiConfidenceFlag,
          estimatedIngredientCount: meal.ingredients.filter(
            (ingredient) => ingredient.dataSource === 'GEMINI_ESTIMATED'
          ).length,
        },
        sourceProvenance: meal.candidateProvenance,
        fallbackAvailable: meal.fallbackAvailable,
        rankingReasonCodes: meal.rankingReasonCodes,
        deadlinePriorityReason: `Shopping deadline ${meal.cycle.shoppingDeadlineAt.toISOString()}; cook date ${meal.scheduledDate.toISOString()}`,
        coalescedDependentCount: workCounts.get(meal.reviewWorkKey ?? `PLAN:${meal.id}`) ?? 1,
        claimStatus: {
          claimedByMe: !!claimedByMe,
          claimedByOther: !!claimedByOther,
          claimedByName,
          coolingDownForMe: Boolean(cooldownUntil),
          cooldownUntil,
          claimExpiresAt:
            claimedByMe && meal.claimedAt ? new Date(meal.claimedAt.getTime() + REVIEW_CLAIM_TTL_MS) : null,
        },
      };
    });

    return result;
  }

  /**
   * Fetches detailed data for a review card. Claiming is an explicit action.
   */
  static async getReviewCardDetails(nutritionistProfileId: string, mealPlanId: string, acquireClaim = false) {
    const now = new Date();
    const claimCutoff = getReviewClaimCutoff(now);
    const [reviewer, reviewTarget] = await Promise.all([
      prisma.nutritionistProfile.findUnique({
        where: { id: nutritionistProfileId },
        select: { id: true },
      }),
      prisma.mealPlan.findUnique({
        where: { id: mealPlanId },
        select: {
          highRiskReviewRequired: true,
          reviewApprovalCount: true,
          firstApprovedByNutritionistId: true,
          candidateProvenance: true,
          baseRecipeSignature: true,
        },
      }),
    ]);
    if (!reviewer || !reviewTarget) throw new Error('Meal plan or nutritionist profile not found.');
    if (
      reviewTarget.candidateProvenance === 'AI_FROM_SCRATCH' &&
      !(await isGeneratedBaseVerified(reviewTarget.baseRecipeSignature))
    ) {
      throw new Error('The generated base recipe must pass meal verification before case approval.');
    }
    const targetOwner = await prisma.mealPlan.findUnique({ where: { id: mealPlanId }, select: { userId: true } });
    if (!targetOwner) throw new Error('Meal plan not found.');
    const clinicalRequirements = await ClinicalEvidenceService.assertReadyForMealPlanning(targetOwner.userId);
    await ClinicalProfileReviewService.assertReadyForMealPlanning(targetOwner.userId);
    // updateMany supplies a compare-and-set claim: only one reviewer can change
    // an unclaimed/expired row from the shared queue at a time.
    if (acquireClaim) {
      const claimResult = await prisma.mealPlan.updateMany({
        where: {
          id: mealPlanId,
          ...getNutritionistReviewableMealPlanWhere(),
          OR: [
            { claimedByNutritionistId: null },
            { claimedAt: null },
            {
              claimedAt: { lt: claimCutoff },
              NOT: {
                claimedByNutritionistId: nutritionistProfileId,
                claimedAt: { gte: new Date(claimCutoff.getTime() - REVIEW_CLAIM_COOLDOWN_MS) },
              },
            },
          ],
        },
        data: {
          claimedByNutritionistId: nutritionistProfileId,
          claimedAt: now,
        },
      });

      if (claimResult.count !== 1) {
        const current = await prisma.mealPlan.findUnique({
          where: { id: mealPlanId },
          select: {
            status: true,
            claimedByNutritionistId: true,
            claimedAt: true,
            claimedByNutritionist: {
              select: { user: { select: { name: true } } },
            },
          },
        });

        if (!current) throw new Error('Meal plan not found.');
        if (current.status !== MealPlanStatus.PENDING_REVIEW) {
          throw new Error('This meal was already reviewed. Please refresh the queue.');
        }
        const cooldownUntil = getReviewClaimCooldownUntil(current, nutritionistProfileId, now);
        if (cooldownUntil) {
          throw new Error(
            `Your claim expired. Other nutritionists can review this meal now; you can try again after ${cooldownUntil.toLocaleTimeString()}.`
          );
        }
        if (isReviewClaimActive(current, now) && current.claimedByNutritionistId !== nutritionistProfileId) {
          throw new Error(
            `This meal was already claimed by ${current.claimedByNutritionist?.user?.name || 'another nutritionist'}. Please choose another item.`
          );
        }
        if (!isReviewClaimActive(current, now) || current.claimedByNutritionistId !== nutritionistProfileId) {
          throw new Error('Unable to acquire an active claim for this meal. Please refresh the queue.');
        }
      }
    }

    const updatedMealPlan = await prisma.mealPlan.findFirst({
      where: { id: mealPlanId, ...getNutritionistReviewableMealPlanWhere() },
      include: {
        ingredients: {
          include: { foodItem: { select: { id: true, name: true, source: true, sourceReferenceUrl: true } } },
        },
        servingComponents: { where: { componentType: 'COOKED_RICE' }, include: { foodItem: true } },
        cycle: { include: { snapshot: true } },
        user: {
          include: {
            userProfile: true,
            healthConditions: true,
            allergies: true,
            safetyProfileEntries: true,
          },
        },
      },
    });

    if (!updatedMealPlan) throw new Error('This meal is no longer awaiting review. Please refresh the queue.');
    if (
      !acquireClaim &&
      isReviewClaimActive(updatedMealPlan, now) &&
      updatedMealPlan.claimedByNutritionistId !== nutritionistProfileId
    ) {
      throw new Error('This meal was already claimed by another nutritionist. Please refresh the queue.');
    }

    const warnings: { severity: 'CRITICAL' | 'IMPORTANT' | 'NOTICE'; message: string }[] = [];
    const user = updatedMealPlan.user;
    const declaredProfile = user.userProfile;
    const reportVersion =
      updatedMealPlan.cycle.snapshot?.nutritionReportVersion ?? declaredProfile?.planningReportVersion;
    const planningReport = reportVersion
      ? await prisma.nutritionReportVersion.findFirst({ where: { userId: user.id, version: reportVersion } })
      : null;
    const saved = reportProfile(planningReport);
    const userProfile =
      declaredProfile && saved
        ? ({
            ...declaredProfile,
            ...Object.fromEntries(PLANNING_PROFILE_FIELDS.map((field) => [field, saved[field] ?? null])),
          } as typeof declaredProfile)
        : declaredProfile;
    if (declaredProfile && planningReport && !planningInputsMatch(declaredProfile, planningReport))
      warnings.push({
        severity: 'IMPORTANT',
        message:
          'Saved profile updates differ from this planning report. Latest health declarations remain listed below; do not treat older guidance as current health clearance.',
      });
    const safetyRestrictions = adaptUserSafetyRestrictions({
      safetyEntries: user.safetyProfileEntries,
      healthConditions: user.healthConditions.map((item) => item.condition),
      allergies: user.allergies.map((item) => item.allergen),
      otherConditions: declaredProfile?.otherConditions,
      otherAllergies: declaredProfile?.otherAllergies,
    });
    const conditions = safetyRestrictions.conditions;
    const allergies = safetyRestrictions.allergies;

    if (safetyRestrictions.requiresReview) {
      warnings.push({
        severity: 'IMPORTANT',
        message:
          'The user has an unsupported, pending, or evidence-incomplete structured restriction. Review every retained entry before approval.',
      });
    }

    const ingredientClassification = classifyMealIngredients(
      updatedMealPlan.ingredients.map((ingredient) => ({
        name: ingredient.ingredientName,
        category: ingredient.category,
      }))
    );
    for (const allergen of allergies) {
      if (ingredientClassification.detectedAllergens.includes(allergen as any)) {
        warnings.push({
          severity: 'CRITICAL',
          message: `A deterministic ingredient match found ${allergen}, which conflicts with the user's declared restriction.`,
        });
      }
    }

    const conditionRuleResults = await evaluateApprovedConditionRules({
      conditions,
      ingredientNames: updatedMealPlan.ingredients.map((ingredient) => ingredient.ingredientName),
      nutrients: {
        calories: updatedMealPlan.calories,
        proteinG: updatedMealPlan.proteinG,
        carbsG: updatedMealPlan.carbsG,
      },
      bodyWeightKg: userProfile?.weightKg,
    });
    for (const result of conditionRuleResults.nutrientEvaluations) {
      if (result.evaluation.decision !== 'PASS') {
        warnings.push({
          severity:
            result.evaluation.decision === 'FAIL' && result.rule.severity === 'HARD_BLOCK' ? 'CRITICAL' : 'IMPORTANT',
          message:
            result.evaluation.decision === 'FAIL'
              ? `${result.condition}: approved rule ${result.rule.id} was violated (${result.evaluation.measuredValue} vs calculated threshold ${result.evaluation.threshold} ${result.evaluation.thresholdUnit}; source coefficient ${result.evaluation.sourceThreshold} ${result.rule.unit}).`
              : `${result.condition}: approved rule ${result.rule.id} could not be evaluated because required nutrient or daily context is missing.`,
        });
      }
    }
    for (const result of conditionRuleResults.ingredientMatches) {
      warnings.push({
        severity: result.rule.severity === 'HARD_BLOCK' ? 'CRITICAL' : 'IMPORTANT',
        message: `${result.condition}: approved ingredient rule ${result.rule.ingredientCategory} matched ${result.matches.join(', ')}.`,
      });
    }
    for (const condition of conditionRuleResults.uncoveredConditions) {
      warnings.push({
        severity: 'IMPORTANT',
        message: `${condition}: no active approved deterministic rules cover this condition; manual nutritionist clearance is required.`,
      });
    }

    if (userProfile) {
      if (userProfile.dailyCalorieTarget && updatedMealPlan.calories > userProfile.dailyCalorieTarget * 0.5) {
        const percentage = ((updatedMealPlan.calories / userProfile.dailyCalorieTarget) * 100).toFixed(0);
        warnings.push({
          severity: 'NOTICE',
          message: `⚠️ This meal alone is ${percentage}% of the user's daily calorie target (${updatedMealPlan.calories.toFixed(0)} kcal / ${userProfile.dailyCalorieTarget.toFixed(0)} kcal daily).`,
        });
      }
    }

    const estimatedIngredients = updatedMealPlan.ingredients.filter((ing) => ing.dataSource === 'GEMINI_ESTIMATED');
    if (estimatedIngredients.length > 0) {
      const names = estimatedIngredients.map((ing) => ing.ingredientName).join(', ');
      warnings.push({
        severity: 'IMPORTANT',
        message: `⚠️ ${estimatedIngredients.length} ingredient(s) have AI-estimated nutrition data, not FNRI verified: [${names}]`,
      });
    }

    const usdaIngredients = updatedMealPlan.ingredients.filter((ing) => ing.dataSource === 'USDA_FDC');
    if (usdaIngredients.length > 0) {
      warnings.push({
        severity: 'IMPORTANT',
        message: `${usdaIngredients.length} ingredient(s) use USDA FoodData Central composition. Confirm food identity, gram amount, local applicability, and restrictions before approval.`,
      });
    }

    if (updatedMealPlan.requiresSafetyRevalidation)
      warnings.push({
        severity: 'IMPORTANT',
        message:
          'Profile or supporting evidence changed. Recheck this meal against the current diet, restrictions and target before deciding. Previous automated triage is no longer current.',
      });
    const severityOrder = { CRITICAL: 0, IMPORTANT: 1, NOTICE: 2 };
    warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const userAge = userProfile?.age || 0;
    const readyClinicalDocumentIds = [...new Set(clinicalRequirements.flatMap((item) => item.readyDocumentIds))];
    const clinicalDocuments = readyClinicalDocumentIds.length
      ? await prisma.clinicalDocument.findMany({
          where: { id: { in: readyClinicalDocumentIds }, userId: updatedMealPlan.userId },
          select: {
            id: true,
            area: true,
            documentType: true,
            issuedAt: true,
            issuerName: true,
            validUntil: true,
            facts: {
              where: { reviewStatus: 'CONFIRMED' },
              select: { id: true, code: true, valueText: true, valueNumber: true, unit: true, observedAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return {
      mealPlan: {
        id: updatedMealPlan.id,
        planGroupId: updatedMealPlan.planGroupId,
        userId: updatedMealPlan.userId,
        status: updatedMealPlan.status,
        mealType: updatedMealPlan.mealType,
        mealName: updatedMealPlan.mealName,
        description: updatedMealPlan.description,
        calories: updatedMealPlan.calories,
        proteinG: updatedMealPlan.proteinG,
        carbsG: updatedMealPlan.carbsG,
        fatG: updatedMealPlan.fatG,
        aiConfidenceFlag: updatedMealPlan.requiresSafetyRevalidation
          ? AIConfidenceFlag.NEEDS_REVIEW
          : updatedMealPlan.aiConfidenceFlag,
        requiresSafetyRevalidation: updatedMealPlan.requiresSafetyRevalidation,
        planType: updatedMealPlan.planType,
        scheduledDate: updatedMealPlan.scheduledDate,
        createdAt: updatedMealPlan.createdAt,
      },
      user: {
        name: user.name,
        planningReportVersion: planningReport?.version ?? null,
        planningReportGeneratedAt: planningReport?.generatedAt ?? null,
        latestDeclaredProfile: declaredProfile
          ? {
              revision: declaredProfile.revision,
              weightKg: declaredProfile.weightKg,
              goal: declaredProfile.goal,
              activityLevel: declaredProfile.activityLevel,
              dailyCalorieTarget: declaredProfile.dailyCalorieTarget,
            }
          : null,
        age: userAge,
        sex: userProfile?.biologicalSex || 'MALE',
        goal: userProfile?.goal || 'MAINTAIN',
        dailyCalorieTarget: userProfile?.dailyCalorieTarget || 2000,
        dietaryPreference: userProfile?.dietaryPreference || 'OMNIVORE',
        ricePreference: userProfile?.ricePreference || 'FLEXIBLE',
        conditions: conditions,
        allergies: allergies,
        safetyEntries: safetyRestrictions.displayEntries,
      },
      ingredients: [
        ...updatedMealPlan.ingredients.map((ing) => ({
          name: ing.ingredientName,
          source: ing.dataSource,
          foodItemId: ing.foodItemId,
          compositionFoodName: ing.foodItem?.name ?? null,
          compositionSource: ing.foodItem?.source ?? null,
          compositionSourceUrl: ing.foodItem?.sourceReferenceUrl ?? null,
          quantity: ing.quantity,
          unit: ing.unit,
        })),
        ...updatedMealPlan.servingComponents.map((component) => ({
          name: component.foodItem?.name ?? 'Cooked rice',
          source: 'FNRI',
          foodItemId: component.foodItemId,
          compositionFoodName: component.foodItem?.name ?? null,
          compositionSource: component.foodItem?.source ?? null,
          compositionSourceUrl: component.foodItem?.sourceReferenceUrl ?? null,
          quantity: component.quantityG,
          unit: 'g',
        })),
      ],
      warnings: warnings,
      clinicalEvidence: {
        policyVersion: CLINICAL_EVIDENCE_REQUIREMENT_POLICY_VERSION,
        requirements: clinicalRequirements,
        documents: clinicalDocuments,
        healthDetails: await prisma.clinicalContextResponse.findMany({
          where: { userId: updatedMealPlan.userId },
          select: { area: true, responses: true, revision: true },
        }),
      },
      highRiskReviewRequired: updatedMealPlan.highRiskReviewRequired,
      reviewApprovalCount: updatedMealPlan.reviewApprovalCount,
      requiresIndependentSecondReview: false,
      claimStatus: {
        claimedByMe:
          isReviewClaimActive(updatedMealPlan, now) &&
          updatedMealPlan.claimedByNutritionistId === nutritionistProfileId,
        claimedByOther: false,
        claimedByName: null,
        claimExpiresAt:
          isReviewClaimActive(updatedMealPlan, now) &&
          updatedMealPlan.claimedByNutritionistId === nutritionistProfileId &&
          updatedMealPlan.claimedAt
            ? new Date(updatedMealPlan.claimedAt.getTime() + REVIEW_CLAIM_TTL_MS)
            : null,
      },
    };
  }

  static async releaseReviewClaim(nutritionistProfileId: string, mealPlanId: string) {
    const reviewer = await prisma.nutritionistProfile.findUnique({
      where: { id: nutritionistProfileId },
      select: { userId: true },
    });
    if (!reviewer) throw new Error('Nutritionist profile not found.');
    return prisma.$transaction(async (tx) => {
      const released = await tx.mealPlan.updateMany({
        where: {
          id: mealPlanId,
          ...getNutritionistReviewableMealPlanWhere(),
          claimedByNutritionistId: nutritionistProfileId,
          claimedAt: { gte: getReviewClaimCutoff() },
        },
        data: { claimedByNutritionistId: null, claimedAt: null },
      });
      if (released.count !== 1) {
        throw new Error('You no longer hold an active claim for this meal. Refresh the queue.');
      }
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'MEAL_PLAN_REVIEW_CLAIM_RELEASED',
          entityType: 'MealPlan',
          entityId: mealPlanId,
          metadata: { nutritionistProfileId },
        },
      });
      return { released: true };
    });
  }

  /**
   * Approves a meal plan.
   * Sets status=APPROVED, auto-saves to MealLibrary, increments totalVerified, notifies user.
   */
  static approveMealPlan = approveMealPlan;

  static resolveMealPlanDispute = resolveMealPlanDispute;

  /**
   * Rejects a meal plan and triggers AI regeneration of that specific meal.
   */
  static rejectMealPlan = rejectMealPlan;

  /**
   * Generates a real-time candidate replacement meal based on the nutritionist's
   * rejection reason as an explicit negative constraint, without committing to the DB.
   */
  static generateReplacementCandidate = NutritionistReplacementService.generateReplacementCandidate;
  static replaceAndApproveMealPlan = NutritionistReplacementService.replaceAndApproveMealPlan;

  static async getApprovedMeals(nutritionistProfileId: string) {
    return getNutritionistApprovedMeals(nutritionistProfileId);
  }
}
