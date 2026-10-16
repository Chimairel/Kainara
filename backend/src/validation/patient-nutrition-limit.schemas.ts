import { z } from 'zod';
import { conditionRuleUnit, validConditionRuleUnits } from '@/domain/condition-rule-units.policy';
import { HealthConditionType, ConditionRuleNutrient, ConditionRuleOperator, ConditionRuleBasis, ConditionRuleSeverity } from '@prisma/client';

export const patientNutritionLimitSchema = z.object({
  condition: z.nativeEnum(HealthConditionType).refine(value => value !== 'NONE', 'Select a recorded condition.'),
  nutrient: z.nativeEnum(ConditionRuleNutrient), operator: z.nativeEnum(ConditionRuleOperator),
  threshold: z.number().finite().nonnegative(), basis: z.nativeEnum(ConditionRuleBasis),
  unit: z.enum(['g', 'mg', '%', 'g/kg', 'mg/1000kcal', 'g/1000kcal']),
  severity: z.nativeEnum(ConditionRuleSeverity), replacesRuleId: z.string().min(1).max(100).nullable().default(null),
  rationale: z.string().trim().min(10).max(4000), sourceTitle: z.string().trim().min(3).max(240),
  sourceCitation: z.url().max(1000).refine(url => url.startsWith('https://'), 'Use an HTTPS source.'),
  validFrom: z.iso.datetime(), validUntil: z.iso.datetime().nullable(),
  expectedProfileRevision: z.number().int().nonnegative(),
}).strict().superRefine((value, ctx) => {
  if (value.validUntil && new Date(value.validUntil) <= new Date(value.validFrom))
    ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'End must follow the effective date.' });
  const unit = conditionRuleUnit(value.nutrient, value.basis);
  if (value.unit !== unit) ctx.addIssue({ code: 'custom', path: ['unit'], message: `This calculation requires ${unit}.` });
  if (!validConditionRuleUnits(value))
    ctx.addIssue({ code: 'custom', path: ['threshold'], message: 'Percent energy needs an energy-yielding nutrient and a value from 0 to 100.' });
});
export type PatientNutritionLimitInput = z.infer<typeof patientNutritionLimitSchema>;
