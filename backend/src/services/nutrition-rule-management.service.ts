import { getConditionAssuranceTier } from '@/domain/assurance-tier.policy';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { validConditionRuleUnits } from '@/domain/condition-rule-units.policy';
import type { ConditionRuleDraftInput } from '@/validation/condition-rule-draft.schemas';
export class NutritionRuleManagementService {
  static async list() {
    const [sources, policies] = await Promise.all([
      prisma.clinicalEvidenceSource.findMany({ where: { state: 'CURRENT' }, select: { id: true, code: true, title: true, canonicalUrl: true }, orderBy: { code: 'asc' }, take: 100 }),
      prisma.conditionRulePolicyVersion.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { approvals: { select: { nutritionistProfileId: true, decision: true, createdAt: true } } } }),
    ]);
    return { sources, policies };
  }
  static async detail(id: string) {
    const policy = await prisma.conditionRulePolicyVersion.findUniqueOrThrow({ where: { id } });
    const where = { condition: policy.condition, policyVersion: policy.policyVersion };
    return { policy, nutrientRules: await prisma.conditionNutrientRule.findMany({ where }), ingredientRules: await prisma.conditionIngredientRule.findMany({ where }) };
  }
  static async draft(actorUserId: string, input: ConditionRuleDraftInput) {
    return prisma.$transaction(async tx => {
      const policy = await tx.conditionRulePolicyVersion.create({ data: { condition: input.condition,
        policyVersion: `SCREENING_${crypto.randomUUID()}`, state: 'DRAFT', assuranceTier: getConditionAssuranceTier(input.condition), automationAllowed: false } });
      for (const rule of input.nutrientRules) {
        if (!validConditionRuleUnits(rule)) throw new AppError('Rule units or calculation basis are incompatible.', 422, 'INVALID_RULE_UNITS');
      }
      for (const rule of [...input.nutrientRules, ...input.ingredientRules]) {
        const source = await tx.clinicalEvidenceSource.findFirst({ where: { id: rule.evidenceSourceId, state: 'CURRENT' } });
        if (!source) throw new AppError('Choose a current registered clinical source.', 422, 'RULE_SOURCE_REQUIRED');
        const common = { ...rule, condition: input.condition, policyVersion: policy.policyVersion,
          sourceTitle: source.title, sourceCitation: source.canonicalUrl,
          authorityOutcome: rule.severity === 'HARD_BLOCK' ? 'HARD_BLOCK' as const : 'REVIEW_REQUIRED' as const,
          active: false, reviewStatus: 'DRAFT' as const };
        if ('nutrient' in rule) await tx.conditionNutrientRule.create({ data: { ...common, ...rule } as Parameters<typeof tx.conditionNutrientRule.create>[0]['data'] });
        else await tx.conditionIngredientRule.create({ data: { ...common, ...rule } as Parameters<typeof tx.conditionIngredientRule.create>[0]['data'] });
      }
      await tx.auditEvent.create({ data: { actorUserId: actorUserId, action: 'CONDITION_RULE_DRAFT_CREATED',
        entityType: 'ConditionRulePolicyVersion', entityId: policy.id, metadata: { condition: policy.condition, policyVersion: policy.policyVersion } } });
      return policy;
    });
  }
}
