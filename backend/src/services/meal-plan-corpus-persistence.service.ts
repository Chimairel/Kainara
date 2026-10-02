import {
  MealPlanStatus,
  MealCandidateProvenance,
  AIConfidenceFlag,
  type PlanType,
  type Prisma,
  type RawRecipeCandidate,
} from '@prisma/client';
import { isUnrestrictedPanlasangBaseEligible } from '@/domain/unrestricted-panlasang-base.policy';
import { buildReviewWorkKey } from '@/domain/upcoming-preparation.policy';
import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import type { StructuredSafetyRestrictionEntry } from '@/domain/structured-restriction.adapter';
import { buildComposedServing } from '@/domain/composed-serving.policy';
import { buildBaseServingPersistence, composePlanWithPairedRice } from './meal-plan-serving.service';
import type { PreparedGeneratedMeal } from './meal-generation-ingredient-preparation.service';
import type { SwapRiceFood } from './meal-swap-serving.service';

/** Persist a source candidate and its optional rice side as one plan slot, never a new library entry. */
export async function savePreparedCorpusMeal(
  tx: Prisma.TransactionClient,
  input: {
    meal: PreparedGeneratedMeal;
    autoGeneralBase: boolean;
    sourceEvidence?: RawRecipeCandidate;
    userId: string;
    planGroupId: string;
    planType: PlanType;
    highRiskReviewRequired: boolean;
    userConditions: string[];
    userAllergens: string[];
    planConditions: string[];
    otherConditions: string | null;
    otherAllergies: string | null;
    safetyEntries: readonly StructuredSafetyRestrictionEntry[];
    selectionEvidence: Prisma.InputJsonValue;
    riceFood: SwapRiceFood | null;
  }
) {
  const {
    meal,
    autoGeneralBase,
    sourceEvidence,
    userId,
    planGroupId,
    planType,
    highRiskReviewRequired,
    userConditions,
    userAllergens,
    planConditions,
    otherConditions,
    otherAllergies,
    safetyEntries,
    selectionEvidence,
    riceFood,
  } = input;

  if (meal.rawCandidateId) {
    const currentSource = await tx.rawRecipeCandidate.findUniqueOrThrow({
      where: { id: meal.rawCandidateId },
      include: { libraryVariants: { where: { status: 'FLAGGED' }, select: { id: true }, take: 1 } },
    });
    if (
      currentSource.status !== 'AVAILABLE' ||
      currentSource.contentSignature !== sourceEvidence?.contentSignature ||
      currentSource.libraryVariants.length
    )
      throw new Error('Source recipe was flagged during preparation. Please retry.');
    if (autoGeneralBase) {
      if (
        currentSource.contentSignature !== sourceEvidence?.contentSignature ||
        !isUnrestrictedPanlasangBaseEligible({
          source: currentSource,
          candidateId: meal.rawCandidateId,
          conditions: userConditions,
          allergens: userAllergens,
          otherConditions,
          otherAllergies,
          safetyEntries,
          preparedIngredients: meal.ingredientsData,
          servingScale: meal.servingScale,
          preparedNutrition: meal,
        })
      )
        throw new Error('Source recipe changed during preparation. Please retry.');
    }
  }
  const serving = buildBaseServingPersistence({
    ...meal,
    ingredients: meal.ingredientsData,
    evidenceSource: autoGeneralBase
      ? 'PANLASANG_PINOY_GENERAL_BASE'
      : meal.candidateProvenance === MealCandidateProvenance.RAW_RECIPE_CORPUS
        ? 'RAW_RECIPE_CORPUS_PENDING_REVIEW'
        : 'AI_GENERATED_PENDING_REVIEW',
  });
  const composedSignature =
    meal.pairedRiceG && riceFood
      ? buildComposedServing({
          baseRecipeSignature: serving.baseRecipeSignature,
          baseNutrition: meal,
          riceFood,
          cookedRiceG: meal.pairedRiceG,
        }).composedServingSignature
      : serving.baseRecipeSignature;
  const createdPlan = await tx.mealPlan.create({
    data: {
      planGroupId,
      userId,
      status: autoGeneralBase ? MealPlanStatus.APPROVED : MealPlanStatus.PENDING_REVIEW,
      candidateProvenance: meal.candidateProvenance,
      sourceRawRecipeCandidateId: meal.rawCandidateId,
      planType,
      mealType: meal.mealType,
      mealName: meal.mealName,
      description: meal.description,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      aiConfidenceFlag: autoGeneralBase ? AIConfidenceFlag.CAUTION : meal.aiConfidenceFlag,
      scheduledDate: meal.scheduledDate,
      requiresSafetyRevalidation: !autoGeneralBase,
      safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
      highRiskReviewRequired,
      reviewWorkKey: buildReviewWorkKey({
        recipeSignature: composedSignature,
        evidenceRevision: 1,
        conditions: planConditions,
        allergens: userAllergens,
        safetyScopeKey: mealApprovalSafetyScope({
          conditions: userConditions,
          allergens: userAllergens,
          otherConditions,
          otherAllergies,
          safetyEntries,
        }).key,
        policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
        requiredReviewerCount: highRiskReviewRequired ? 2 : 1,
      }),
      candidateRank: meal.candidateRank ?? 1,
      rankingScore: meal.rankingScore ?? null,
      rankingReasonCodes: meal.rankingReasonCodes ?? [],
      fallbackAvailable: false,
      selectionEvidence,
      ingredients: {
        create: meal.ingredientsData,
      },
      ...serving,
    },
  });

  if (meal.pairedRiceG && riceFood) {
    await composePlanWithPairedRice(tx, {
      mealPlanId: createdPlan.id,
      cookedRiceG: meal.pairedRiceG,
      fnriRiceFoodItemId: riceFood.id,
    });
    return tx.mealPlan.findUniqueOrThrow({ where: { id: createdPlan.id } });
  }
  return createdPlan;
}
