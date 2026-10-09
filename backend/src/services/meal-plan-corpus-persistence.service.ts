import {
  MealPlanStatus,
  MealCandidateProvenance,
  AIConfidenceFlag,
  type PlanType,
  type Prisma,
  type RawRecipeCandidate,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { isUnrestrictedPanlasangBaseEligible } from '@/domain/unrestricted-panlasang-base.policy';
import { buildReviewWorkKey } from '@/domain/upcoming-preparation.policy';
import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import type { StructuredSafetyRestrictionEntry } from '@/domain/structured-restriction.adapter';
import { buildComposedServing } from '@/domain/composed-serving.policy';
import { buildBaseServingPersistence } from './meal-plan-serving.service';
import { resolveRecipeRiceRole } from '@/domain/recipe-rice-role.policy';
import { COOKED_RICE_HALF_CUP_GRAMS } from '@/domain/rice-portion.policy';
import type { PreparedGeneratedMeal } from './meal-generation-ingredient-preparation.service';
import type { SwapRiceFood } from './meal-swap-serving.service';
import { demoPlateNutrition } from '@/domain/demo-plate-nutrition.policy';

/** Persist a source candidate and its optional rice side as one plan slot, never a new library entry. */
export type PreparedCorpusMealInput = {
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
};

type CurrentSource = RawRecipeCandidate & { libraryVariants: { id: string }[] };

function buildPreparedCorpusRows(input: PreparedCorpusMealInput, currentSource?: CurrentSource) {
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
    if (
      !currentSource ||
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
  if (autoGeneralBase && !currentSource) throw new Error('Source recipe changed during preparation. Please retry.');
  const serving = buildBaseServingPersistence({
    ...meal,
    ingredients: meal.ingredientsData,
    evidenceSource: autoGeneralBase
      ? 'PANLASANG_PINOY_GENERAL_BASE'
      : meal.candidateProvenance === MealCandidateProvenance.RAW_RECIPE_CORPUS
        ? 'RAW_RECIPE_CORPUS_PENDING_REVIEW'
        : 'AI_GENERATED_PENDING_REVIEW',
  });
  let composed: ReturnType<typeof buildComposedServing> | null = null;
  if (meal.pairedRiceG) {
    if (
      meal.candidateProvenance !== MealCandidateProvenance.RAW_RECIPE_CORPUS ||
      !currentSource ||
      !['PANLASANG_PINOY', 'DEMO_STANDARD_PORTION'].includes(currentSource.sourceName)
    )
      throw new Error('Rice requires an available source recipe.');
    if (!riceFood || riceFood.source !== 'FNRI' || riceFood.name.toLowerCase() !== 'rice, well-milled, boiled')
      throw new Error('Select the governed cooked-rice food record.');
    const role = resolveRecipeRiceRole({
      mealName: meal.mealName,
      riceRole: currentSource.riceRole,
      riceRoleReviewStatus: currentSource.riceRoleReviewStatus,
      includedRiceG: currentSource.includedRiceG,
      riceMinHalfCups: 1,
      riceMaxHalfCups: 3,
      ingredients: meal.ingredientsData.map((ingredient) => ({
        ...ingredient,
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit ?? null,
      })),
    });
    if (role.riceRole !== 'PAIR_WITH_RICE') throw new Error('Only a rice-compatible dish can receive a rice side.');
    const halfCups = meal.pairedRiceG / COOKED_RICE_HALF_CUP_GRAMS;
    if (!Number.isInteger(halfCups) || halfCups < role.minHalfCups || halfCups > role.maxHalfCups)
      throw new Error('Rice must use half-cup steps within the allowed portion range.');
    composed = buildComposedServing({
      baseRecipeSignature: serving.baseRecipeSignature,
      baseNutrition: meal,
      riceFood,
      cookedRiceG: meal.pairedRiceG,
    });
  }
  const composedSignature = composed?.composedServingSignature ?? serving.baseRecipeSignature;
  const sourceNutrition = currentSource?.publishedNutrition as
    { demoPreparation?: { nutrition?: Record<string, number | null>; signature?: string } } | null | undefined;
  const demoEvidence = sourceNutrition?.demoPreparation?.nutrition
    ? {
        estimated: true,
        clinicalCertification: false,
        sourceSignature: sourceNutrition.demoPreparation.signature ?? null,
        servingScale: meal.servingScale ?? 1,
        pairedRiceG: meal.pairedRiceG ?? 0,
        nutrients: demoPlateNutrition(
          sourceNutrition.demoPreparation.nutrition,
          meal.servingScale ?? 1,
          riceFood as unknown as Record<string, unknown> | null,
          meal.pairedRiceG ?? 0
        ),
        note: 'Per-serving ingredient composition and rice totals.',
      }
    : null;
  const id = randomUUID();
  const plan: Prisma.MealPlanCreateManyInput = {
    id,
    planGroupId,
    userId,
    status: autoGeneralBase ? MealPlanStatus.APPROVED : MealPlanStatus.PENDING_REVIEW,
    candidateProvenance: meal.candidateProvenance,
    sourceRawRecipeCandidateId: meal.rawCandidateId,
    planType,
    mealType: meal.mealType,
    mealName: meal.mealName,
    description: meal.description,
    ...(composed?.total ?? { calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG }),
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
      requiredReviewerCount: 1,
    }),
    candidateRank: meal.candidateRank ?? 1,
    rankingScore: meal.rankingScore ?? null,
    rankingReasonCodes: meal.rankingReasonCodes ?? [],
    fallbackAvailable: false,
    selectionEvidence: demoEvidence
      ? (JSON.parse(
          JSON.stringify({
            ...(typeof selectionEvidence === 'object' && !Array.isArray(selectionEvidence) ? selectionEvidence : {}),
            demoNutrition: demoEvidence,
          })
        ) as Prisma.InputJsonValue)
      : selectionEvidence,
    baseRecipeSignature: serving.baseRecipeSignature,
    composedServingSignature: composedSignature,
  };
  const components: Prisma.MealPlanServingComponentCreateManyInput[] = [
    { mealPlanId: id, ...serving.servingComponents.create },
  ];
  if (composed && riceFood)
    components.push({
      mealPlanId: id,
      componentType: 'COOKED_RICE',
      position: 1,
      foodItemId: riceFood.id,
      quantityG: meal.pairedRiceG,
      ...composed.riceNutrition,
      evidenceSource: `FNRI:${riceFood.compositionRevision}`,
    });
  return {
    plan,
    components,
    ingredients: meal.ingredientsData.map((ingredient) => ({ mealPlanId: id, ...ingredient })),
  };
}

/** Batch reads and writes keep a full cycle within the atomic transaction budget. */
export async function savePreparedCorpusMeals(
  tx: Prisma.TransactionClient,
  inputs: readonly PreparedCorpusMealInput[]
) {
  if (!inputs.length) return [];
  const sourceIds = [...new Set(inputs.flatMap(({ meal }) => (meal.rawCandidateId ? [meal.rawCandidateId] : [])))];
  const sources = sourceIds.length
    ? await tx.rawRecipeCandidate.findMany({
        where: { id: { in: sourceIds } },
        include: { libraryVariants: { where: { status: 'FLAGGED' }, select: { id: true }, take: 1 } },
      })
    : [];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const riceIds = [
    ...new Set(inputs.flatMap(({ meal, riceFood }) => (meal.pairedRiceG && riceFood ? [riceFood.id] : []))),
  ];
  const riceFoods = riceIds.length ? await tx.foodItem.findMany({ where: { id: { in: riceIds } } }) : [];
  const riceById = new Map(riceFoods.map((rice) => [rice.id, rice]));
  // Validate every live source and side before any insert. The caller keeps the
  // profile lock, evidence revision check, cycle and reservations in this transaction.
  const rows = inputs.map((input) => {
    const rice = input.riceFood ? riceById.get(input.riceFood.id) : undefined;
    if (
      input.meal.pairedRiceG &&
      input.riceFood?.compositionRevision !== undefined &&
      rice?.compositionRevision !== input.riceFood.compositionRevision
    )
      throw new Error('Food composition changed during generation. Please retry.');
    return buildPreparedCorpusRows(
      { ...input, riceFood: rice ?? null },
      input.meal.rawCandidateId ? sourceById.get(input.meal.rawCandidateId) : undefined
    );
  });
  await tx.mealPlan.createMany({ data: rows.map((row) => row.plan) });
  const ingredients = rows.flatMap((row) => row.ingredients);
  if (ingredients.length) await tx.mealIngredient.createMany({ data: ingredients });
  await tx.mealPlanServingComponent.createMany({ data: rows.flatMap((row) => row.components) });
  const plans = await tx.mealPlan.findMany({ where: { id: { in: rows.map((row) => row.plan.id!) } } });
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  return rows.map((row) => {
    const plan = planById.get(row.plan.id!);
    if (!plan) throw new Error('Saved meal candidate missing.');
    return plan;
  });
}

/** Retain the single-slot path for repairs and acceptance callers. */
export async function savePreparedCorpusMeal(tx: Prisma.TransactionClient, input: PreparedCorpusMealInput) {
  const [plan] = await savePreparedCorpusMeals(tx, [input]);
  return plan;
}
