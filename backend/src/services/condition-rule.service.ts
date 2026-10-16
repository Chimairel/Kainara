import {
  ClinicalEvidenceSourceState,
  ConditionRulePolicyState,
  ConditionRuleReviewStatus,
  HealthConditionType,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { evaluateConditionNutrientRule, type RuleNutrientEvidence } from '@/domain/condition-rule-evaluation.policy';
import { loadPlanningRules } from './planning-rule-screening.service';
import { screenPlanningRules } from '@/domain/planning-rule-screening.policy';

export async function evaluateApprovedConditionRules(input: {
  userId?: string;
  conditions: readonly string[];
  ingredientNames: readonly string[];
  nutrients: RuleNutrientEvidence;
  dailyTotals?: RuleNutrientEvidence;
  bodyWeightKg?: number | null;
}) {
  const conditions = [...new Set(input.conditions.filter((condition) => condition !== 'NONE'))].filter((condition) =>
    Object.values(HealthConditionType).includes(condition as HealthConditionType)
  ) as HealthConditionType[];
  if (conditions.length === 0) return { nutrientEvaluations: [], ingredientMatches: [], uncoveredConditions: [] };
  if (input.userId) {
    const rules = await loadPlanningRules(input.userId, conditions);
    const result = screenPlanningRules({ ...rules, ...input, userId: input.userId, now: new Date() });
    return { nutrientEvaluations: result.evaluations.map(({rule,evaluation}) => ({ condition: rule.condition, evaluation,
      rule: { ...rule, sourceTitle: rule.sourceTitle ?? 'Recorded patient limit', sourceCitation: rule.sourceCitation ?? '',
        evidenceSource: rules.rules.find(item => item.id === rule.id)?.evidenceSource ?? null,
        patientSpecific: rules.overrides.some(item => item.id === rule.id) } })),
      ingredientMatches: result.ingredientMatches.map(rule => ({ condition: rule.condition, rule: { ...rule,
        ingredientCategory: rules.ingredientRules.find(item => item.id === rule.id)?.ingredientCategory ?? 'Recorded ingredients' }, matches: input.ingredientNames })),
      uncoveredConditions: result.uncoveredConditions };
  }

  const activePolicies = await prisma.conditionRulePolicyVersion.findMany({
    where: { condition: { in: conditions }, state: ConditionRulePolicyState.ACTIVE },
    select: { condition: true, policyVersion: true },
    take: 100,
  });
  const activePolicyScopes = activePolicies.map((policy) => ({
    condition: policy.condition,
    policyVersion: policy.policyVersion,
  }));

  if (activePolicyScopes.length === 0)
    return { nutrientEvaluations: [], ingredientMatches: [], uncoveredConditions: conditions };

  const [nutrientRules, ingredientRules] = await Promise.all([
    prisma.conditionNutrientRule.findMany({
      where: {
        OR: activePolicyScopes,
        reviewStatus: ConditionRuleReviewStatus.APPROVED,
        active: true,
        approvedByNutritionistId: { not: null },
        evidenceSource: { is: { state: ClinicalEvidenceSourceState.CURRENT } },
      },
      include: { evidenceSource: true },
      orderBy: [{ condition: 'asc' }, { nutrient: 'asc' }, { id: 'asc' }],
      take: 100,
    }),
    prisma.conditionIngredientRule.findMany({
      where: {
        OR: activePolicyScopes,
        reviewStatus: ConditionRuleReviewStatus.APPROVED,
        active: true,
        approvedByNutritionistId: { not: null },
        evidenceSource: { is: { state: ClinicalEvidenceSourceState.CURRENT } },
      },
      include: { evidenceSource: true },
      orderBy: [{ condition: 'asc' }, { ingredientCategory: 'asc' }, { id: 'asc' }],
      take: 100,
    }),
  ]);

  const nutrientEvaluations = nutrientRules.map((rule) => ({
    condition: rule.condition,
    rule,
    evaluation: evaluateConditionNutrientRule(rule, input.nutrients, {
      dailyTotals: input.dailyTotals,
      bodyWeightKg: input.bodyWeightKg,
    }),
  }));
  const normalizedIngredients = input.ingredientNames.map((value) => value.normalize('NFKC').toLowerCase());
  const ingredientMatches = ingredientRules.flatMap((rule) => {
    const terms = Array.isArray(rule.matchingTerms)
      ? rule.matchingTerms.filter((term): term is string => typeof term === 'string')
      : [];
    const matches = normalizedIngredients.filter((ingredient) =>
      terms.some((term) => ingredient.includes(term.normalize('NFKC').toLowerCase()))
    );
    return matches.length ? [{ condition: rule.condition, rule, matches }] : [];
  });
  const covered = new Set([
    ...nutrientRules.map((rule) => rule.condition),
    ...ingredientRules.map((rule) => rule.condition),
  ]);

  return {
    nutrientEvaluations,
    ingredientMatches,
    uncoveredConditions: conditions.filter((condition) => !covered.has(condition)),
  };
}
