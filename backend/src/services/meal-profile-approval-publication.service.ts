import { MealCandidateProvenance, MealLibraryStatus, MealPlanStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { classifyMealIngredients } from '@/domain/meal-ingredient-classification.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { createOrReuseLibraryDraftFromApprovedPlan } from './meal-library-publication.service';

/**
 * Publish a narrow scope hash after the final patient-specific
 * RND approval. An unchanged recipe and an identical recorded safety profile
 * are required at read time; this does not confer general certification.
 */
export async function publishProfileMatchedMealApproval(input: {
  mealPlanId: string;
  nutritionistProfileId: string;
  approvedProfileRevision: number;
}): Promise<boolean> {
  const plan = await prisma.mealPlan.findUnique({
    where: { id: input.mealPlanId },
    include: {
      ingredients: true,
      clinicalEvidence: { select: { id: true } },
      cycle: { select: { profileAdaptationState: true, snapshot: { select: { profileRevision: true, safetyRevision: true } } } },
      sourceRawRecipeCandidate: { select: { sourceName: true } },
      user: {
        include: { userProfile: true, healthConditions: true, allergies: true, safetyProfileEntries: true },
      },
    },
  });
  if (
    !plan || plan.status !== MealPlanStatus.APPROVED || plan.requiresSafetyRevalidation ||
    plan.nutritionistId !== input.nutritionistProfileId ||
    plan.safetyPolicyVersion !== MEAL_PLAN_SAFETY_POLICY_VERSION ||
    plan.user.userProfile?.revision !== input.approvedProfileRevision ||
    plan.cycle.profileAdaptationState !== 'CURRENT' ||
    plan.cycle.snapshot?.profileRevision !== plan.user.userProfile?.revision ||
    plan.cycle.snapshot?.safetyRevision !== plan.user.userProfile?.safetyRevision ||
    plan.highRiskReviewRequired || plan.clinicalEvidence.length > 0 ||
    !plan.baseRecipeSignature || plan.composedServingSignature !== plan.baseRecipeSignature ||
    plan.sourceRawRecipeCandidate?.sourceName === 'USER_OBSERVED'
  ) return false;

  const scope = mealApprovalSafetyScope({
    conditions: plan.user.healthConditions.map((item) => item.condition),
    allergens: plan.user.allergies.map((item) => item.allergen),
    otherConditions: plan.user.userProfile.otherConditions,
    otherAllergies: plan.user.userProfile.otherAllergies,
    safetyEntries: plan.user.safetyProfileEntries,
  });
  if (!scope.supported || !plan.ingredients.length || !plan.ingredients.every((ingredient) =>
    typeof ingredient.quantity === 'number' && Number.isFinite(ingredient.quantity) && ingredient.quantity > 0 &&
    typeof ingredient.unit === 'string' && ingredient.unit.trim().length > 0
  )) return false;
  const restrictions = adaptUserSafetyRestrictions({
    safetyEntries: plan.user.safetyProfileEntries,
    healthConditions: plan.user.healthConditions.map((item) => item.condition),
    allergies: plan.user.allergies.map((item) => item.allergen),
    otherConditions: plan.user.userProfile.otherConditions,
    otherAllergies: plan.user.userProfile.otherAllergies,
  });
  // Condition labels cannot carry an individual's laboratory, medication, or
  // nutrient-limit context to another user.
  if (restrictions.conditions.some((condition) => condition !== 'NONE')) return false;

  const allergyFacts = classifyMealIngredients(plan.ingredients.map((ingredient) => ({
    name: ingredient.ingredientName,
    category: ingredient.category,
  })));
  const requestedAllergies = new Set(restrictions.allergies);
  if (requestedAllergies.size && allergyFacts.status !== 'COMPLETE') return false;
  if (allergyFacts.detectedAllergens.some((allergen) => requestedAllergies.has(allergen))) return false;

  // A case decision for a changed recipe cannot certify a new general meal.
  // Reuse the already verified base only when the reviewed serving is exact.
  if (plan.candidateProvenance === MealCandidateProvenance.CERTIFIED_LIBRARY) {
    const original = plan.libraryMealId
      ? await prisma.mealLibrary.findUnique({ where: { id: plan.libraryMealId } })
      : null;
    if (!original || original.status !== MealLibraryStatus.APPROVED ||
        original.recipeSignature !== plan.baseRecipeSignature) return false;
  }

  const { meal } = await createOrReuseLibraryDraftFromApprovedPlan(
    input.nutritionistProfileId,
    input.mealPlanId,
    { attachPlan: false }
  );
  if (!meal.recipeSignature || meal.recipeSignature !== plan.baseRecipeSignature ||
      meal.status !== MealLibraryStatus.APPROVED) return false;
  const approval = await prisma.mealLibraryProfileApproval.upsert({
    where: {
      mealLibraryId_safetyScopeKey_evidenceRevision: {
        mealLibraryId: meal.id,
        safetyScopeKey: scope.key,
        evidenceRevision: meal.safetyEvidenceRevision,
      },
    },
    create: {
      mealLibraryId: meal.id,
      safetyScopeKey: scope.key,
      recipeSignature: meal.recipeSignature,
      evidenceRevision: meal.safetyEvidenceRevision,
      reviewerNutritionistId: input.nutritionistProfileId,
      reviewPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
      sourceProvenance: plan.candidateProvenance,
      reviewDueAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      scopeSnapshot: {
        conditions: restrictions.conditions,
        allergens: restrictions.allergies,
        customConditions: restrictions.customConditions,
        customFoodRestrictions: restrictions.customFoodRestrictions,
      },
    },
    update: {},
  });
  if (approval.flaggedAt || approval.reviewDueAt <= new Date() ||
      approval.recipeSignature !== meal.recipeSignature ||
      approval.evidenceRevision !== meal.safetyEvidenceRevision) return false;
  const linked = await prisma.mealPlan.updateMany({
    where: {
      id: input.mealPlanId,
      status: MealPlanStatus.APPROVED,
      nutritionistId: input.nutritionistProfileId,
      requiresSafetyRevalidation: false,
      user: { userProfile: { revision: input.approvedProfileRevision } },
    },
    data: { libraryMealId: meal.id, profileApprovalId: approval.id },
  });
  return linked.count === 1;
}
