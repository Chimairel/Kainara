import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { loadUserNutritionContext } from '@/domain/user-nutrition-context';
import { buildComposedServing, scaleFnriFoodToGrams } from '@/domain/composed-serving.policy';
import { isUnrestrictedPanlasangBaseEligible } from '@/domain/unrestricted-panlasang-base.policy';
import { scalePublishedAmount } from '@/domain/source-serving-adjustment.policy';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { sourceRecipeNutritionReviewHold } from '@/domain/source-recipe-review-holds.policy';
import { COOKED_RICE_HALF_CUP_GRAMS } from '@/domain/rice-portion.policy';
import { resolveRecipeRiceRole } from '@/domain/recipe-rice-role.policy';
import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { buildReviewWorkKey } from '@/domain/upcoming-preparation.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { buildBaseServingPersistence } from './meal-plan-serving.service';
import { lockUserProfile } from './profile-revision.service';

const include = {
  ingredients: true,
  servingComponents: { include: { foodItem: true }, orderBy: { position: 'asc' as const } },
  sourceRawRecipeCandidate: {
    include: { libraryVariants: { where: { status: 'FLAGGED' as const }, select: { id: true } } },
  },
  _count: { select: { mealLogs: true, reviewDecisions: true, clearanceUsages: true, clarificationForms: true } },
} satisfies Prisma.MealPlanInclude;
type RepairPlan = Prisma.MealPlanGetPayload<{ include: typeof include }>;
type Context = Awaited<ReturnType<typeof loadUserNutritionContext>>;
const macros = ['calories', 'proteinG', 'carbsG', 'fatG'] as const;
const same = (a: Record<(typeof macros)[number], number>, b: Record<(typeof macros)[number], number>) =>
  macros.every((key) => Number.isFinite(a[key]) && Number.isFinite(b[key]) && Math.abs(a[key] - b[key]) < 0.000001);

/** Explicit maintenance only. Never called from a read or worker and never grants clinical approval. */
export function unchangedRiceRepairCandidate(plan: RepairPlan, context: Context) {
  const declared = context.declaredSafetyRestrictions;
  if (
    declared.requiresReview ||
    declared.conditions.length ||
    declared.allergies.length ||
    declared.customConditions.length ||
    declared.customFoodRestrictions.length
  )
    return null;
  if (
    plan.status !== 'APPROVED' ||
    plan.requiresSafetyRevalidation ||
    plan.libraryMealId ||
    plan.profileApprovalId ||
    plan.candidateProvenance !== 'RAW_RECIPE_CORPUS' ||
    plan.reviewApprovalCount !== 0 ||
    plan.highRiskReviewRequired ||
    plan.nutritionistId ||
    plan.firstApprovedByNutritionistId ||
    plan.reviewedAt ||
    plan.claimedAt ||
    plan.supersededByMealPlanId ||
    Object.values(plan._count).some(Boolean) ||
    plan.safetyPolicyVersion !== MEAL_PLAN_SAFETY_POLICY_VERSION
  )
    return null;
  const source = plan.sourceRawRecipeCandidate;
  const base = plan.servingComponents.find((item) => item.componentType === 'BASE_RECIPE');
  const rice = plan.servingComponents.find((item) => item.componentType === 'COOKED_RICE');
  const food = rice?.foodItem;
  if (
    !source ||
    !base ||
    !rice ||
    !food ||
    plan.servingComponents.length !== 2 ||
    source.libraryVariants.length ||
    sourceRecipeNutritionReviewHold(source.sourceUrl) ||
    food.source !== 'FNRI' ||
    food.name.toLowerCase() !== 'rice, well-milled, boiled' ||
    !rice.quantityG ||
    base.evidenceSource !== 'PANLASANG_PINOY_GENERAL_BASE'
  )
    return null;
  const revision = rice.evidenceSource.match(/^FNRI:(\d+)$/)?.[1];
  if (revision === undefined || Number(revision) >= food.compositionRevision) return null;
  const evidence = plan.selectionEvidence;
  const scale =
    evidence && typeof evidence === 'object' && !Array.isArray(evidence) && typeof evidence.servingScale === 'number'
      ? evidence.servingScale
      : 1;
  if (
    !isUnrestrictedPanlasangBaseEligible({
      source,
      candidateId: source.id,
      conditions: context.conditions,
      allergens: context.allergens,
      otherConditions: context.otherConditions,
      otherAllergies: context.otherAllergies,
      safetyEntries: context.user.safetyProfileEntries,
      preparedIngredients: plan.ingredients,
      servingScale: scale,
      preparedNutrition: base,
    })
  )
    return null;
  if (
    macros.some(
      (key) => source[key] === null || Math.abs(base[key] - scalePublishedAmount(source[key]!, scale)) >= 0.000001
    )
  )
    return null;
  const role = resolveRecipeRiceRole({
    ...source,
    mealName: plan.mealName,
    ingredients: plan.ingredients,
    riceMinHalfCups: 1,
    riceMaxHalfCups: 3,
  });
  const halfCups = rice.quantityG / COOKED_RICE_HALF_CUP_GRAMS;
  if (
    role.riceRole !== 'PAIR_WITH_RICE' ||
    !Number.isInteger(halfCups) ||
    halfCups < role.minHalfCups ||
    halfCups > role.maxHalfCups
  )
    return null;
  const signature = buildBaseServingPersistence({
    ...plan,
    ...base,
    ingredients: plan.ingredients,
    evidenceSource: base.evidenceSource,
  }).baseRecipeSignature;
  if (signature !== plan.baseRecipeSignature || !same(rice, scaleFnriFoodToGrams(food, rice.quantityG))) return null;
  const previous = buildComposedServing({
    baseRecipeSignature: signature,
    baseNutrition: base,
    riceFood: { ...food, compositionRevision: Number(revision) },
    cookedRiceG: rice.quantityG,
  });
  const current = buildComposedServing({
    baseRecipeSignature: signature,
    baseNutrition: base,
    riceFood: food,
    cookedRiceG: rice.quantityG,
  });
  if (previous.composedServingSignature !== plan.composedServingSignature || !same(plan, current.total)) return null;
  return {
    id: plan.id,
    componentId: rice.id,
    foodId: food.id,
    from: rice.evidenceSource,
    to: `FNRI:${food.compositionRevision}`,
    beforeSignature: previous.composedServingSignature,
    afterSignature: current.composedServingSignature,
    recipeId: source.id,
    sourceSignature: source.contentSignature,
  };
}

export async function previewUnchangedRiceRepair(
  tx: Prisma.TransactionClient,
  userId: string,
  cycleId: string,
  now = new Date()
) {
  const cycle = await tx.mealPlanCycle.findFirstOrThrow({ where: { id: cycleId, userId } });
  if (
    cycle.supersededById ||
    ['COMPLETED', 'SUPERSEDED'].includes(cycle.status) ||
    cycle.profileAdaptationState !== 'CURRENT'
  )
    throw new Error('Only an unchanged current or upcoming cycle can be repaired.');
  const context = await loadUserNutritionContext(tx, userId, 'Repair profile missing.');
  const plans = await tx.mealPlan.findMany({
    where: { userId, planGroupId: cycleId, scheduledDate: { gte: getStartOfManilaBusinessDay(now) } },
    include,
    orderBy: { id: 'asc' },
  });
  const candidates = plans.flatMap((plan) => {
    const repair = unchangedRiceRepairCandidate(plan, context);
    return repair ? [repair] : [];
  });
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        userId,
        cycleId,
        profileRevision: context.profile.revision,
        safetyRevision: context.profile.safetyRevision,
        candidates,
      })
    )
    .digest('hex');
  return { context, candidates, fingerprint };
}

export async function applyUnchangedRiceRepair(
  tx: Prisma.TransactionClient,
  userId: string,
  cycleId: string,
  expectedFingerprint: string,
  now = new Date()
) {
  await lockUserProfile(tx, userId);
  await tx.$queryRaw`SELECT id FROM "MealPlanCycle" WHERE id = ${cycleId} AND "userId" = ${userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "MealPlan" WHERE "planGroupId" = ${cycleId} AND "userId" = ${userId} ORDER BY id FOR UPDATE`;
  const preview = await previewUnchangedRiceRepair(tx, userId, cycleId, now);
  if (preview.fingerprint !== expectedFingerprint || !preview.candidates.length)
    throw new Error('Repair context changed or no eligible servings remain. Run a new dry run.');
  const ids = Prisma.join(preview.candidates.map((item) => item.foodId));
  await tx.$queryRaw`SELECT id FROM "FoodItem" WHERE id IN (${ids}) ORDER BY id FOR SHARE`;
  const sources = Prisma.join(preview.candidates.map((item) => item.recipeId));
  await tx.$queryRaw`SELECT id FROM "RawRecipeCandidate" WHERE id IN (${sources}) ORDER BY id FOR SHARE`;
  const confirmed = await previewUnchangedRiceRepair(tx, userId, cycleId, now);
  if (confirmed.fingerprint !== expectedFingerprint) throw new Error('Source evidence changed during repair.');
  const context = confirmed.context;
  const scope = mealApprovalSafetyScope({
    conditions: context.conditions,
    allergens: context.allergens,
    otherConditions: context.otherConditions,
    otherAllergies: context.otherAllergies,
    safetyEntries: context.user.safetyProfileEntries,
  });
  for (const item of confirmed.candidates) {
    await tx.mealPlanServingComponent.update({ where: { id: item.componentId }, data: { evidenceSource: item.to } });
    await tx.mealPlan.update({
      where: { id: item.id },
      data: {
        composedServingSignature: item.afterSignature,
        reviewWorkKey: buildReviewWorkKey({
          recipeSignature: item.afterSignature,
          evidenceRevision: 1,
          conditions: context.conditions,
          allergens: context.allergens,
          safetyScopeKey: scope.key,
          policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
          requiredReviewerCount: 1,
        }),
      },
    });
    await tx.auditEvent.create({
      data: {
        action: 'UNCHANGED_GENERAL_RICE_EVIDENCE_REFRESHED',
        entityType: 'MealPlan',
        entityId: item.id,
        metadata: { ...item, nutritionUnchanged: true, clinicalApprovalGranted: false },
      },
    });
  }
  await tx.groceryList.updateMany({ where: { userId, planGroupId: cycleId }, data: { isStale: true } });
  return { repaired: confirmed.candidates.length, fingerprint: confirmed.fingerprint };
}
