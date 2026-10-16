import { Prisma, HealthConditionType } from '@prisma/client';
import prisma from '@/lib/prisma';
import { screenPlanningRules, type PatientLimitLike } from '@/domain/planning-rule-screening.policy';
import { primaryMealExclusion } from '@/domain/recipe-category.policy';
import { getManilaDateKey } from '@/domain/meal-plan-cycle.policy';
import type { RuleNutrientEvidence } from '@/domain/condition-rule-evaluation.policy';
import type { RecipeCandidateProjection } from './recipe-candidate-provider';
import { rawRecipeServing } from './raw-recipe-serving.service';
import type { SwapRiceFood } from './meal-swap-serving.service';
import type { RicePreference, MealType } from '@prisma/client';
import { clinicalRuleKey, clinicalRuleSnapshot } from '@/domain/clinical-rule-stamp.policy';

/** Candidate-stage ceiling checks prevent repeatedly selecting a known conflict.
 * Day rules still need a complete projected day at the final publication gate. */
export async function planningCandidateFilter(input: { userId: string; conditions: readonly string[]; dailyCalorieTarget: number;
  weightKg?: number | null; ricePreference: RicePreference; riceFood: SwapRiceFood | null }) {
  const rules = await loadPlanningRules(input.userId, input.conditions);
  return (candidate: RecipeCandidateProjection, mealType: MealType) => {
    if (!['BREAKFAST', 'LUNCH', 'DINNER'].includes(mealType)) return false;
    const plate = rawRecipeServing({ candidate, mealType, dailyCalorieTarget: input.dailyCalorieTarget,
      ricePreference: input.ricePreference, riceFood: input.riceFood });
    if (!plate?.nutrition) return false;
    const rice = input.riceFood, grams = plate.pairedRiceG ?? 0;
    const nutrients = { ...plate.nutrition,
      calories: plate.nutrition.calories + (rice ? rice.calories * grams / 100 : 0),
      proteinG: plate.nutrition.proteinG + (rice ? rice.proteinG * grams / 100 : 0),
      carbsG: plate.nutrition.carbsG + (rice ? rice.carbsG * grams / 100 : 0) };
    return !screenPlanningRules({ ...rules, conditions: input.conditions, userId: input.userId, now: new Date(),
      ingredientNames: plate.ingredients.map(row => row.name), nutrients, bodyWeightKg: input.weightKg }).blocked;
  };
}

export async function loadPlanningRules(userId: string, conditions: readonly string[], client: Prisma.TransactionClient = prisma) {
  const supported = conditions.filter((c): c is HealthConditionType => c !== 'NONE' && Object.values(HealthConditionType).includes(c as HealthConditionType));
  if (!supported.length) return { rules: [], ingredientRules: [], overrides: [] as PatientLimitLike[], policies: [] };
  const policies = await client.conditionRulePolicyVersion.findMany({
    where: { condition: { in: supported }, OR: [{ state: 'ACTIVE' }, { state: 'SUSPENDED', activatedAt: { not: null } }] },
    select: { id: true, condition: true, policyVersion: true, updatedAt: true, state: true },
  });
  const activePolicies = policies.filter(p => p.state === 'ACTIVE');
  const where = { OR: activePolicies.map(p => ({ condition: p.condition, policyVersion: p.policyVersion })),
    active: true, reviewStatus: 'APPROVED' as const, approvedByNutritionistId: { not: null },
    approvedByNutritionist: { is: { isVerified: true, prcLicenseExpiry: { gte: new Date() }, user: { role: 'NUTRITIONIST' as const, isSuspended: false } } },
    evidenceSource: { is: { state: 'CURRENT' as const } } };
  const [rules, ingredientRules, patientRows] = await Promise.all([
    activePolicies.length ? client.conditionNutrientRule.findMany({ relationLoadStrategy: 'join', where, include: { evidenceSource: true }, orderBy: { id: 'asc' } }) : [],
    activePolicies.length ? client.conditionIngredientRule.findMany({ where, orderBy: { id: 'asc' } }) : [],
    client.patientNutritionLimit.findMany({ relationLoadStrategy: 'join', where: { userId, condition: { in: supported } },
      include: { nutritionistProfile: { select: { isVerified: true, prcLicenseExpiry: true, user: { select: { role: true, isSuspended: true } } } } }, orderBy: { version: 'desc' } }),
  ]);
  // A revoked/expired reviewer makes their constraint unresolved, not silently absent.
  const overrides: PatientLimitLike[] = patientRows.map(row => ({ ...row,
    approvedByNutritionistId: row.nutritionistProfileId,
    active: row.nutritionistProfile.isVerified && !!row.nutritionistProfile.prcLicenseExpiry &&
      row.nutritionistProfile.prcLicenseExpiry >= new Date() && !row.nutritionistProfile.user.isSuspended &&
      row.nutritionistProfile.user.role === 'NUTRITIONIST', reviewStatus: 'APPROVED' }));
  return { rules, ingredientRules, overrides, policies };
}

/** Unknown micronutrients stay null. A library base is not a complete composed plate. */
export function planningPlateNutrients(meal: { calories: number; proteinG: number; carbsG: number; fatG?: number;
  libraryMeal?: { calories: number; proteinG: number; carbsG: number; [key: string]: unknown } | null }): RuleNutrientEvidence {
  const result: RuleNutrientEvidence = { calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG };
  const base = meal.libraryMeal;
  if (base && ['calories', 'proteinG', 'carbsG'].every(key =>
    Math.abs(Number(base[key]) - Number(meal[key as 'calories'])) < 0.01))
    for (const key of ['sodiumMg', 'sugarG', 'fiberG', 'potassiumMg', 'phosphorusMg', 'saturatedFatG'] as const)
      result[key] = typeof base[key] === 'number' ? base[key] as number : null;
  return result;
}

/** Complete primary-slot totals only; absent evidence is never replaced with zero. */
export function planningDayTotals(rows: readonly { mealType: string; nutrients: RuleNutrientEvidence }[]): RuleNutrientEvidence | undefined {
  if (!['BREAKFAST', 'LUNCH', 'DINNER'].every(type => rows.filter(row => row.mealType === type).length === 1)) return undefined;
  const result: RuleNutrientEvidence = {};
  for (const key of ['calories', 'proteinG', 'carbsG', 'sodiumMg', 'sugarG', 'fiberG', 'potassiumMg', 'phosphorusMg', 'saturatedFatG'] as const)
    result[key] = rows.every(row => typeof row.nutrients[key] === 'number' && Number.isFinite(row.nutrients[key]))
      ? rows.reduce((sum, row) => sum + row.nutrients[key]!, 0) : null;
  return result;
}

/** A shared last gate for new plans, queue fills and member swaps. No approval is created. */
export async function evaluateCycleForPlanning(client: Prisma.TransactionClient, userId: string, cycleId: string, now = new Date()) {
  const user = await client.user.findUniqueOrThrow({ where: { id: userId }, include: { userProfile: true, healthConditions: true } });
  const conditions = user.healthConditions.map(row => row.condition);
  const rules = await loadPlanningRules(userId, conditions, client);
  const meals = await client.mealPlan.findMany({ where: { userId, planGroupId: cycleId,
    status: { in: ['APPROVED', 'PENDING_REVIEW'] }, supersededByMealPlanId: null },
    include: { libraryMeal: true, ingredients: true, mealLogs: { where: { status: { in: ['DONE', 'SKIPPED'] } } } } });
  const evidence = meals.map(meal => ({ meal, nutrients: meal.mealLogs[0]?.status === 'SKIPPED'
    ? { calories: 0, proteinG: 0, carbsG: 0, sodiumMg: 0, sugarG: 0, fiberG: 0, potassiumMg: 0, phosphorusMg: 0, saturatedFatG: 0 }
    : meal.mealLogs[0]?.status === 'DONE' ? { calories: meal.mealLogs[0].calories, proteinG: meal.mealLogs[0].proteinG, carbsG: meal.mealLogs[0].carbsG }
      : planningPlateNutrients(meal) }));
  const dates = [...new Set(meals.map(meal => getManilaDateKey(meal.scheduledDate)))];
  const outside = dates.length && (rules.rules.length || rules.overrides.length) ? await client.mealLog.findMany({ where: {
    userId, mealPlanId: null, status: 'DONE', voidedAt: null,
    loggedAt: { gte: new Date(`${dates.sort()[0]}T00:00:00+08:00`), lt: new Date(new Date(`${dates[dates.length - 1]}T00:00:00+08:00`).getTime() + 86_400_000) },
  }, select: { calories: true, proteinG: true, carbsG: true, loggedAt: true } }) : [];
  return evidence.filter(({meal}) => !meal.mealLogs.length && getManilaDateKey(meal.scheduledDate) >= getManilaDateKey(now)).map(({meal, nutrients}) => {
    const categoryConflict = meal.mealType !== 'SNACK' ? primaryMealExclusion(meal.mealName) : null;
    const dayRows = evidence.filter(row => getManilaDateKey(row.meal.scheduledDate) === getManilaDateKey(meal.scheduledDate))
      .map(row => ({ mealType: row.meal.mealType as string, nutrients: row.nutrients }));
    dayRows.push(...outside.filter(row => getManilaDateKey(row.loggedAt) === getManilaDateKey(meal.scheduledDate))
      .map(row => ({ mealType: 'OUTSIDE', nutrients: { calories: row.calories, proteinG: row.proteinG, carbsG: row.carbsG } })));
    const effectiveAt = new Date(Math.max(now.getTime(), meal.scheduledDate.getTime()));
    const screening = screenPlanningRules({ ...rules, conditions, userId, now: effectiveAt, nutrients,
      ingredientNames: meal.ingredients.map(row => row.ingredientName), bodyWeightKg: user.userProfile?.weightKg,
      dailyTotals: planningDayTotals(dayRows) });
    const currentRuleKey = clinicalRuleKey(clinicalRuleSnapshot(userId, rules.overrides, rules.policies, effectiveAt));
    return { meal, categoryConflict, screening, currentRuleKey };
  });
}

export async function screenCycleForPlanning(client: Prisma.TransactionClient, userId: string, cycleId: string, now = new Date()) {
  const evaluations = await evaluateCycleForPlanning(client, userId, cycleId, now);
  const blockedIds = evaluations.filter(row => row.categoryConflict || row.screening.blocked).map(row => row.meal.id);
  for (const {meal, categoryConflict, screening, currentRuleKey} of evaluations) {
    if (!categoryConflict && !screening.blocked && !screening.requiresReview) continue;
    // An unchanged human decision may address uncertain evidence. Filling a
    // neighboring slot must not erase that decision or an active review claim.
    if (!categoryConflict && !screening.blocked &&
      (meal.status === 'PENDING_REVIEW' || meal.clinicalRuleKey === currentRuleKey)) continue;
    const status = (categoryConflict || screening.blocked) && meal.status === 'PENDING_REVIEW' ? 'CANCELLED' : 'PENDING_REVIEW';
    await client.mealPlan.update({ where: { id: meal.id }, data: { status,
      requiresSafetyRevalidation: true, reviewApprovalCount: 0, claimedAt: null, claimedByNutritionistId: null,
      nutritionistId: null, reviewedAt: null, firstApprovedAt: null, firstApprovedByNutritionistId: null } });
    await client.auditEvent.create({ data: { action: 'MEAL_PLANNING_SCREEN', entityType: 'MealPlan', entityId: meal.id,
      metadata: { categoryConflict, status, ruleResults: screening.evaluations.map(({rule,evaluation}) =>
        ({ ruleId: rule.id, decision: evaluation.decision, reason: evaluation.reason })), ingredientRuleIds: screening.ingredientMatches.map(row => row.id) } } });
  }
  return { blockedIds };
}
