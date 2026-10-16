import { z } from 'zod';
import { HealthConditionType, ConditionRuleNutrient, ConditionRuleOperator, ConditionRuleBasis, ConditionRuleSeverity, ConditionRuleEvaluationScope } from '@prisma/client';
const evidence = z.object({ evidenceSourceId: z.string().min(1).max(100), evidenceLocator: z.string().trim().min(3).max(500),
  applicablePopulation: z.string().trim().min(3).max(4000), exclusionsAndCaveats: z.string().trim().min(3).max(4000),
  rationale: z.string().trim().min(10).max(4000), requiredInputs: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).refine(v => Object.keys(v).length > 0),
  evaluationScope: z.nativeEnum(ConditionRuleEvaluationScope), severity: z.nativeEnum(ConditionRuleSeverity) });
const nutrient = evidence.extend({ nutrient: z.nativeEnum(ConditionRuleNutrient), operator: z.nativeEnum(ConditionRuleOperator), threshold: z.number().finite().nonnegative(),
  unit: z.string().max(32), basis: z.nativeEnum(ConditionRuleBasis) }).strict().refine(rule =>
    rule.basis === 'PER_SERVING' ? ['SERVING', 'MEAL'].includes(rule.evaluationScope) : rule.evaluationScope === 'DAY',
    'Calculation basis must match the serving or day evaluation scope.');
const ingredient = evidence.extend({ ingredientCategory: z.string().trim().min(3).max(80), matchingTerms: z.array(z.string().trim().min(2).max(100)).min(1).max(50) }).strict();
export const conditionRuleDraftSchema = z.object({ condition: z.nativeEnum(HealthConditionType).refine(c => c !== 'NONE'),
  nutrientRules: z.array(nutrient).max(30), ingredientRules: z.array(ingredient).max(30) }).strict()
  .refine(value => value.nutrientRules.length + value.ingredientRules.length > 0, 'Add at least one rule.');


export type ConditionRuleDraftInput = z.infer<typeof conditionRuleDraftSchema>;
