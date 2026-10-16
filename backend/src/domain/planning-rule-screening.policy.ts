import { evaluateConditionNutrientRule, type ConditionRuleLike, type RuleNutrientEvidence } from './condition-rule-evaluation.policy';

export type PlanningNutrientRule = ConditionRuleLike & { condition: string; sourceTitle?: string; sourceCitation?: string };
export interface PatientLimitLike extends PlanningNutrientRule {
  scopeKey?: string;
  userId: string; replacesRuleId: string | null; version: number;
  validFrom: Date; validUntil: Date | null; revokedAt: Date | null;
}
export function patientLimitScope(limit: { condition: string; nutrient: string; basis: string; operator: string; replacesRuleId?: string | null }) {
  const direction = limit.operator.startsWith('LESS') ? 'MAX' : limit.operator.startsWith('GREATER') ? 'MIN' : 'EXACT';
  return `${limit.condition}:${limit.nutrient}:${limit.basis}:${limit.replacesRuleId ?? direction}`;
}
export function effectivePatientLimits(limits: readonly PatientLimitLike[], userId: string, now: Date) {
  const latest = new Map<string, PatientLimitLike>();
  // A newer version supersedes an older one even if the newer version was revoked.
  for (const limit of limits.filter(row => row.userId === userId && row.validFrom <= now)) {
    const key = limit.scopeKey ?? patientLimitScope(limit);
    if (!latest.has(key) || latest.get(key)!.version < limit.version) latest.set(key, limit);
  }
  return [...latest.values()].filter(row => !row.revokedAt && (!row.validUntil || row.validUntil > now));
}

/** Show the current constraint and actual scheduled changes, rather than
 * hiding today's limit when a newer version starts in the future. */
export function reportPatientLimits(limits: readonly PatientLimitLike[], userId: string, now: Date) {
  const visible = new Map(effectivePatientLimits(limits, userId, now).map(row => [row.id, row]));
  for (const row of limits.filter(limit => limit.userId === userId && limit.validFrom > now))
    for (const effective of effectivePatientLimits(limits, userId, row.validFrom)) visible.set(effective.id, effective);
  return [...visible.values()];
}

export function screenPlanningRules(input: {
  conditions: readonly string[]; rules: readonly PlanningNutrientRule[];
  overrides: readonly PatientLimitLike[]; userId: string; now: Date;
  ingredientRules: readonly { id: string; condition: string; matchingTerms: unknown; severity: string }[];
  ingredientNames: readonly string[]; nutrients: RuleNutrientEvidence;
  dailyTotals?: RuleNutrientEvidence; bodyWeightKg?: number | null;
}) {
  const overrides = effectivePatientLimits(input.overrides, input.userId, input.now)
    .filter(rule => input.conditions.includes(rule.condition));
  const replacedIds = new Set(overrides.flatMap(rule => rule.replacesRuleId ? [rule.replacesRuleId] : []));
  const rules = [...input.rules.filter(rule => !replacedIds.has(rule.id)), ...overrides]
    .filter(rule => input.conditions.includes(rule.condition));
  const evaluations = rules.map(rule => ({ rule, evaluation: evaluateConditionNutrientRule(rule, input.nutrients,
    { dailyTotals: input.dailyTotals, bodyWeightKg: input.bodyWeightKg }) }));
  const text = input.ingredientNames.join(' | ').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/gu, ' ');
  const ingredientMatches = input.ingredientRules.filter(rule => input.conditions.includes(rule.condition) &&
    Array.isArray(rule.matchingTerms) && rule.matchingTerms.some(term => typeof term === 'string' &&
      term.trim().length > 0 && ` ${text} `.includes(` ${term.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim()} `)));
  return {
    evaluations, ingredientMatches,
    blocked: evaluations.some(({rule, evaluation}) => rule.severity === 'HARD_BLOCK' && evaluation.decision === 'FAIL') ||
      ingredientMatches.some(rule => rule.severity === 'HARD_BLOCK'),
    requiresReview: evaluations.some(({evaluation}) => evaluation.decision !== 'PASS') || ingredientMatches.length > 0,
    // Passing this screen grants no clinical clearance.
    uncoveredConditions: input.conditions.filter(condition => condition !== 'NONE' &&
      !rules.some(rule => rule.condition === condition) && !input.ingredientRules.some(rule => rule.condition === condition)),
  };
}
