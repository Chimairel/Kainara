import {
  ClinicalEvidenceSourceState,
  ClearanceDecisionStage,
  ClearanceDecisionValue,
  ConditionClearanceProvenance,
  ConditionClearanceState,
  ConditionRulePolicyState,
  ConditionRuleAuthority,
  HealthConditionType,
  Prisma,
  RuleApprovalDecision,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { getActiveMealReviewPeriodWhere } from '@/domain/meal-actionability.policy';
import { evaluateMealLibrarySafetyEvidence } from '@/domain/meal-library-safety-evidence.policy';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import {
  conditionAllowsRulesetAutomation,
  conditionRequiresUserScopedClearance,
  getConditionAssuranceTier,
} from '@/domain/assurance-tier.policy';
import { evaluateConditionNutrientRule } from '@/domain/condition-rule-evaluation.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { assertConditionPolicyEvidenceComplete } from '@/domain/condition-policy-evidence.policy';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { lockUserProfile } from './profile-revision.service';
import { ClinicalEvidenceService } from './clinical-evidence.service';

async function requireEligibleReviewer(nutritionistProfileId: string) {
  const reviewer = await prisma.nutritionistProfile.findUnique({
    where: { id: nutritionistProfileId },
    include: { user: { select: { id: true, role: true, isSuspended: true } } },
  });
  if (!reviewer || !isNutritionistEligibleForReview(reviewer)) {
    throw new Error('Only a currently verified nutritionist with a current license may perform this action.');
  }
  return reviewer;
}

function evidenceSnapshot(meal: {
  id: string;
  recipeSignature: string | null;
  safetyEvidenceRevision: number;
  safetyPolicyVersion: string | null;
  mealName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}) {
  return {
    mealLibraryId: meal.id,
    recipeSignature: meal.recipeSignature,
    evidenceRevision: meal.safetyEvidenceRevision,
    safetyPolicyVersion: meal.safetyPolicyVersion,
    mealName: meal.mealName,
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
  };
}

export class ConditionClearanceService {
  static async submitManualDecision(input: {
    nutritionistProfileId: string;
    mealLibraryId: string;
    condition: HealthConditionType;
    decision: ClearanceDecisionValue;
    rationale?: string;
    userScopeId?: string | null;
  }) {
    if (input.condition === HealthConditionType.NONE) throw new Error('NONE does not require a condition clearance.');
    const tier = getConditionAssuranceTier(input.condition);
    const reviewer = await requireEligibleReviewer(input.nutritionistProfileId);
    if (conditionRequiresUserScopedClearance(input.condition) && !input.userScopeId) {
      throw new Error(
        `${input.condition} clearance requires an explicit user scope until structured clinical detail exists.`
      );
    }
    const clinicalDocuments = input.userScopeId
      ? await ClinicalEvidenceService.getReadyDocumentsForCondition(input.userScopeId, input.condition)
      : [];
    if (conditionRequiresUserScopedClearance(input.condition)) {
      await ClinicalEvidenceService.assertReadyForMealPlanning(input.userScopeId!);
      await ClinicalProfileReviewService.assertReadyForMealPlanning(input.userScopeId!);
    }
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: input.mealLibraryId },
      include: {
        ingredients: true,
        safetyDeclarations: true,
        safetyReviewedByNutritionist: { include: { user: { select: { role: true, isSuspended: true } } } },
      },
    });
    if (!meal) throw new Error('Library meal not found.');
    if (meal.status !== 'APPROVED') throw new Error('A flagged meal cannot receive a condition approval.');
    if (!meal.recipeSignature || meal.safetyEvidenceRevision <= 0) {
      throw new Error('The meal requires a stable recipe signature and evidence revision before condition review.');
    }
    const safety = evaluateMealLibrarySafetyEvidence({
      ...meal,
      reviewerEligible: meal.safetyReviewedByNutritionist
        ? isNutritionistEligibleForReview(meal.safetyReviewedByNutritionist)
        : false,
    });
    if (!safety.complete) throw new Error('Base recipe evidence must be complete before condition clearance.');

    const existing = await prisma.mealConditionClearance.findFirst({
      where: {
        mealLibraryId: meal.id,
        condition: input.condition,
        recipeSignature: meal.recipeSignature,
        evidenceRevision: meal.safetyEvidenceRevision,
        userScopeId: input.userScopeId ?? null,
        state: { in: ['REVIEW_DUE', 'ACTIVE', 'DISPUTED'] },
      },
      include: { decisions: { orderBy: { submittedAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.state === ConditionClearanceState.ACTIVE)
      throw new Error('An active clearance already exists for this scope.');
    if (existing?.state === ConditionClearanceState.DISPUTED)
      throw new Error('Resolve the recorded dispute before issuing a new clearance.');
    const now = new Date();
    return prisma.$transaction(
      async (tx) => {
        if (input.userScopeId && conditionRequiresUserScopedClearance(input.condition)) {
          await lockUserProfile(tx, input.userScopeId);
          if (!(await ClinicalProfileReviewService.hasCurrentApproval(input.userScopeId, tx)))
            throw new Error('This profile changed and needs a new nutritionist confirmation.');
        }
        const healthDetails = input.userScopeId
          ? await tx.clinicalContextResponse.findMany({ where: { userId: input.userScopeId } })
          : [];
        const currentMeal = await tx.mealLibrary.findUnique({ where: { id: meal.id }, select: { status: true } });
        if (currentMeal?.status !== 'APPROVED') throw new Error('This meal was flagged during review.');
        const scopedUser = input.userScopeId
          ? await tx.user.findUnique({
              where: { id: input.userScopeId },
              include: { userProfile: true, healthConditions: true, allergies: true, safetyProfileEntries: true },
            })
          : null;
        if (input.userScopeId && !scopedUser) throw new Error('User-scoped case not found.');
        const caseRestrictions = scopedUser
          ? adaptUserSafetyRestrictions({
              safetyEntries: scopedUser.safetyProfileEntries,
              healthConditions: scopedUser.healthConditions.map((item) => item.condition),
              allergies: scopedUser.allergies.map((item) => item.allergen),
              otherConditions: scopedUser.userProfile?.otherConditions,
              otherAllergies: scopedUser.userProfile?.otherAllergies,
            })
          : null;
        // This is display context at review time, not an extra clinical clearance.
        const recordedCaseScope = caseRestrictions
          ? {
              conditions: caseRestrictions.conditions,
              allergens: caseRestrictions.allergies,
              customConditions: caseRestrictions.customConditions,
              customFoodRestrictions: caseRestrictions.customFoodRestrictions,
            }
          : null;
        const clearance =
          existing ??
          (await tx.mealConditionClearance.create({
            data: {
              mealLibraryId: meal.id,
              userScopeId: input.userScopeId ?? null,
              condition: input.condition,
              recipeSignature: meal.recipeSignature!,
              evidenceRevision: meal.safetyEvidenceRevision,
              policyVersion: meal.safetyPolicyVersion,
              assuranceTier: tier,
              provenance: ConditionClearanceProvenance.MANUAL_REVIEW,
              state: ConditionClearanceState.REVIEW_DUE,
              evidenceSnapshot: {
                ...evidenceSnapshot(meal),
                clinicalDocuments,
                healthDetails: healthDetails.map((item) => ({
                  area: item.area,
                  responses: item.responses,
                  revision: item.revision,
                  provenance: 'USER_REPORTED',
                })),
                recordedCaseScope,
              },
            },
            include: { decisions: true },
          }));
        if (!existing && clinicalDocuments.length) {
          await tx.clearanceClinicalEvidence.createMany({
            data: clinicalDocuments.map((document) => ({
              clearanceId: clearance.id,
              clinicalDocumentId: document.id,
              documentRevision: document.revision,
              documentSha256: document.sha256,
            })),
            skipDuplicates: true,
          });
        }
        // Old partial clearances retain their first decision as history. This
        // explicit completion does not require a different or lead reviewer.
        const stage = clearance.decisions.length ? ClearanceDecisionStage.RECHECK : ClearanceDecisionStage.PRIMARY;
        await tx.mealConditionClearanceDecision.create({
          data: {
            clearanceId: clearance.id,
            nutritionistProfileId: input.nutritionistProfileId,
            stage,
            decision: input.decision,
            rationale: input.rationale?.trim() || null,
            evidenceSnapshot: {
              ...evidenceSnapshot(meal),
              clinicalDocuments,
              healthDetails: healthDetails.map((item) => ({
                area: item.area,
                responses: item.responses,
                revision: item.revision,
                provenance: 'USER_REPORTED',
              })),
              recordedCaseScope,
            },
          },
        });

        const state =
          input.decision === ClearanceDecisionValue.APPROVE
            ? ConditionClearanceState.ACTIVE
            : ConditionClearanceState.REVOKED;
        const updated = await tx.mealConditionClearance.update({
          where: { id: clearance.id },
          data: {
            state,
            activatedAt: state === ConditionClearanceState.ACTIVE ? now : null,
            auditDueAt: null,
            suspendedAt: null,
            suspensionReason: null,
          },
          include: { decisions: { select: { id: true, stage: true, decision: true, submittedAt: true } } },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: reviewer.userId,
            action: `CONDITION_CLEARANCE_${state}`,
            entityType: 'MealConditionClearance',
            entityId: clearance.id,
            metadata: { condition: input.condition, tier, userScoped: Boolean(input.userScopeId) },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  static async resolveDispute(input: {
    nutritionistProfileId: string;
    clearanceId: string;
    decision: ClearanceDecisionValue;
    rationale: string;
  }) {
    const reviewer = await requireEligibleReviewer(input.nutritionistProfileId);
    const clearance = await prisma.mealConditionClearance.findUnique({
      where: { id: input.clearanceId },
      include: { decisions: true },
    });
    if (!clearance || clearance.state !== ConditionClearanceState.DISPUTED) {
      throw new Error('A disputed clearance was not found.');
    }
    if (clearance.decisions.some((decision) => decision.nutritionistProfileId === input.nutritionistProfileId)) {
      throw new Error('Dispute adjudication requires a nutritionist who did not submit either disputed decision.');
    }
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.mealConditionClearanceDecision.create({
        data: {
          clearanceId: clearance.id,
          nutritionistProfileId: input.nutritionistProfileId,
          stage: ClearanceDecisionStage.DISPUTE_RESOLUTION,
          decision: input.decision,
          rationale: input.rationale.trim(),
          evidenceSnapshot: clearance.evidenceSnapshot as Prisma.InputJsonValue,
        },
      });
      const state =
        input.decision === ClearanceDecisionValue.APPROVE
          ? ConditionClearanceState.ACTIVE
          : ConditionClearanceState.REVOKED;
      const updated = await tx.mealConditionClearance.update({
        where: { id: clearance.id },
        data: {
          state,
          resolvedByNutritionistId: input.nutritionistProfileId,
          activatedAt: state === ConditionClearanceState.ACTIVE ? now : null,
          auditDueAt: null,
          suspendedAt: null,
          suspensionReason: null,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'CONDITION_CLEARANCE_DISPUTE_RESOLVED',
          entityType: 'MealConditionClearance',
          entityId: clearance.id,
          metadata: { decision: input.decision },
        },
      });
      return updated;
    });
  }

  static async suspendClearance(nutritionistProfileId: string, clearanceId: string, reason: string) {
    const reviewer = await requireEligibleReviewer(nutritionistProfileId);
    return prisma.$transaction(async (tx) => {
      const clearance = await tx.mealConditionClearance.update({
        where: { id: clearanceId },
        data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason.trim().slice(0, 240) },
      });
      await tx.mealPlan.updateMany({
        where: { clearanceUsages: { some: { clearanceId } }, status: 'APPROVED' },
        data: { requiresSafetyRevalidation: true },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'CONDITION_CLEARANCE_SUSPENDED',
          entityType: 'MealConditionClearance',
          entityId: clearanceId,
          metadata: { reason: clearance.suspensionReason },
        },
      });
      return clearance;
    });
  }

  static async getGovernanceQueue(nutritionistProfileId: string, view: 'audit' | 'disputed') {
    await requireEligibleReviewer(nutritionistProfileId);
    if (view === 'disputed') {
      const [clearances, plans] = await Promise.all([
        prisma.mealConditionClearance.findMany({
          where: { state: 'DISPUTED' },
          include: {
            mealLibrary: { select: { mealName: true } },
            _count: { select: { planUsages: true } },
          },
          orderBy: { updatedAt: 'asc' },
          take: 100,
        }),
        prisma.mealPlan.findMany({
          where: { status: 'DISPUTED', ...getActiveMealReviewPeriodWhere() },
          select: { id: true, mealName: true, mealType: true, scheduledDate: true, user: { select: { name: true } } },
          orderBy: { reviewedAt: 'asc' },
          take: 100,
        }),
      ]);
      return { clearances, plans };
    }

    const clearances = await prisma.mealConditionClearance.findMany({
      where: { state: { in: ['REVIEW_DUE', 'SUSPENDED'] } },
      include: {
        mealLibrary: { select: { mealName: true } },
        _count: { select: { planUsages: true } },
      },
      take: 250,
    });
    const usageRows = clearances.length
      ? await prisma.mealPlanClearanceUsage.findMany({
          where: { clearanceId: { in: clearances.map((clearance) => clearance.id) } },
          select: { clearanceId: true, mealPlan: { select: { userId: true } } },
        })
      : [];
    const usersByClearance = new Map<string, Set<string>>();
    for (const usage of usageRows) {
      const users = usersByClearance.get(usage.clearanceId) ?? new Set<string>();
      users.add(usage.mealPlan.userId);
      usersByClearance.set(usage.clearanceId, users);
    }
    const ranked = clearances
      .map((clearance) => {
        const uniqueUserExposure = usersByClearance.get(clearance.id)?.size ?? 0;
        return {
          ...clearance,
          uniqueUserExposure,
          auditPriority: clearance.state === 'SUSPENDED' ? 0 : 1,
          auditReason:
            clearance.state === 'SUSPENDED'
              ? `Suspended: ${clearance.suspensionReason || 'safety circuit breaker'}`
              : 'Approval requires a review decision',
        };
      })
      .sort(
        (a, b) =>
          a.auditPriority - b.auditPriority || b.uniqueUserExposure - a.uniqueUserExposure || a.id.localeCompare(b.id)
      );
    return { clearances: ranked.slice(0, 100) };
  }

  static async generateRulesetImpact(nutritionistProfileId: string, policyVersionId: string) {
    await requireEligibleReviewer(nutritionistProfileId);
    const policy = await prisma.conditionRulePolicyVersion.findUnique({ where: { id: policyVersionId } });
    if (!policy || policy.state !== ConditionRulePolicyState.DRAFT) throw new Error('Draft ruleset version not found.');
    const [nutrientRules, ingredientRules, meals] = await Promise.all([
      prisma.conditionNutrientRule.findMany({
        where: { condition: policy.condition, policyVersion: policy.policyVersion },
        include: { evidenceSource: true },
      }),
      prisma.conditionIngredientRule.findMany({
        where: { condition: policy.condition, policyVersion: policy.policyVersion },
        include: { evidenceSource: true },
      }),
      prisma.mealLibrary.findMany({
        where: { status: 'APPROVED', safetyEvidenceStatus: 'COMPLETE' },
        select: {
          id: true,
          calories: true,
          proteinG: true,
          carbsG: true,
          sodiumMg: true,
          sugarG: true,
          fiberG: true,
          potassiumMg: true,
          phosphorusMg: true,
          saturatedFatG: true,
          ingredients: { select: { ingredientName: true } },
        },
        take: 5000,
      }),
    ]);
    assertConditionPolicyEvidenceComplete([...nutrientRules, ...ingredientRules]);
    let cleared = 0;
    let blocked = 0;
    let unevaluable = 0;
    for (const meal of meals) {
      const evaluations = nutrientRules.map((rule) =>
        evaluateConditionNutrientRule(
          { ...rule, reviewStatus: 'APPROVED', active: true, approvedByNutritionistId: 'DRY_RUN' },
          meal
        )
      );
      const ingredientText = meal.ingredients.map((item) => item.ingredientName.toLowerCase()).join(' | ');
      const ingredientBlocked = ingredientRules.some((rule) => {
        const terms = Array.isArray(rule.matchingTerms)
          ? rule.matchingTerms.filter((term): term is string => typeof term === 'string')
          : [];
        return terms.some((term) => ingredientText.includes(term.toLowerCase()));
      });
      if (ingredientBlocked || evaluations.some((result) => result.decision === 'FAIL')) blocked += 1;
      else if (evaluations.some((result) => result.decision === 'NOT_EVALUABLE')) unevaluable += 1;
      else cleared += 1;
    }
    const impactReport = {
      evaluatedAt: new Date().toISOString(),
      mealCount: meals.length,
      rules: nutrientRules.length + ingredientRules.length,
      newlyClearable: cleared,
      blocked,
      unevaluable,
    };
    return prisma.conditionRulePolicyVersion.update({
      where: { id: policy.id },
      data: { impactReport },
    });
  }

  static async approveRulesetVersion(input: {
    nutritionistProfileId: string;
    policyVersionId: string;
    decision: RuleApprovalDecision;
    rationale?: string;
  }) {
    await requireEligibleReviewer(input.nutritionistProfileId);
    const policy = await prisma.conditionRulePolicyVersion.findUnique({
      where: { id: input.policyVersionId },
      include: { approvals: true },
    });
    if (!policy || policy.state !== 'DRAFT') throw new Error('Draft ruleset version not found.');
    if (!policy.impactReport) throw new Error('A dry-run impact report is required before ruleset approval.');
    if (policy.approvals.some((approval) => approval.nutritionistProfileId === input.nutritionistProfileId)) {
      throw new Error('The same nutritionist cannot approve a ruleset version twice.');
    }
    const governedRules = await Promise.all([
      prisma.conditionNutrientRule.findMany({
        where: { condition: policy.condition, policyVersion: policy.policyVersion },
        include: { evidenceSource: true },
      }),
      prisma.conditionIngredientRule.findMany({
        where: { condition: policy.condition, policyVersion: policy.policyVersion },
        include: { evidenceSource: true },
      }),
    ]);
    assertConditionPolicyEvidenceComplete([...governedRules[0], ...governedRules[1]]);

    return prisma.$transaction(async (tx) => {
      await tx.conditionRulePolicyApproval.create({
        data: {
          policyVersionId: policy.id,
          nutritionistProfileId: input.nutritionistProfileId,
          decision: input.decision,
          rationale: input.rationale?.trim() || null,
        },
      });
      const approvals = [
        ...policy.approvals.map((approval) => ({
          decision: approval.decision,
          nutritionistProfileId: approval.nutritionistProfileId,
        })),
        {
          decision: input.decision,
          nutritionistProfileId: input.nutritionistProfileId,
        },
      ];
      const rejected = approvals.some((approval) => approval.decision === 'REJECT');
      const mayActivate = approvals.filter((approval) => approval.decision === 'APPROVE').length >= 2;
      if (rejected) {
        return tx.conditionRulePolicyVersion.update({
          where: { id: policy.id },
          data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: 'RND_APPROVAL_REJECTED' },
        });
      }
      if (!mayActivate) return tx.conditionRulePolicyVersion.findUniqueOrThrow({ where: { id: policy.id } });
      const activatingReviewerId = input.nutritionistProfileId;
      await Promise.all([
        tx.conditionNutrientRule.updateMany({
          where: { condition: policy.condition, policyVersion: policy.policyVersion },
          data: {
            reviewStatus: 'APPROVED',
            active: true,
            approvedByNutritionistId: activatingReviewerId,
          },
        }),
        tx.conditionIngredientRule.updateMany({
          where: { condition: policy.condition, policyVersion: policy.policyVersion },
          data: {
            reviewStatus: 'APPROVED',
            active: true,
            approvedByNutritionistId: activatingReviewerId,
          },
        }),
      ]);
      const activatedPolicy = await tx.conditionRulePolicyVersion.update({
        where: { id: policy.id },
        data: { state: 'ACTIVE', activatedAt: new Date() },
      });
      if (policy.automationAllowed && conditionAllowsRulesetAutomation(policy.condition)) {
        const [rules, meals] = await Promise.all([
          tx.conditionNutrientRule.findMany({
            where: {
              condition: policy.condition,
              policyVersion: policy.policyVersion,
              active: true,
              authorityOutcome: ConditionRuleAuthority.CLEARANCE_ELIGIBLE,
              evidenceSource: { is: { state: ClinicalEvidenceSourceState.CURRENT } },
            },
            include: { evidenceSource: true },
          }),
          tx.mealLibrary.findMany({
            where: {
              status: 'APPROVED',
              safetyEvidenceStatus: 'COMPLETE',
              recipeSignature: { not: null },
            },
            select: {
              id: true,
              mealName: true,
              recipeSignature: true,
              safetyEvidenceRevision: true,
              safetyPolicyVersion: true,
              calories: true,
              proteinG: true,
              carbsG: true,
              fatG: true,
              sodiumMg: true,
              sugarG: true,
              fiberG: true,
              potassiumMg: true,
              phosphorusMg: true,
              saturatedFatG: true,
            },
            take: 5000,
          }),
        ]);
        const automaticClearances: Prisma.MealConditionClearanceCreateManyInput[] = [];
        for (const meal of meals) {
          const evaluations = rules.map((rule) => evaluateConditionNutrientRule(rule, meal));
          if (!evaluations.length || evaluations.some((evaluation) => evaluation.decision !== 'PASS')) continue;
          const activatedAt = new Date();
          automaticClearances.push({
            mealLibraryId: meal.id,
            condition: policy.condition,
            recipeSignature: meal.recipeSignature!,
            evidenceRevision: meal.safetyEvidenceRevision,
            policyVersion: policy.policyVersion,
            rulePolicyVersionId: policy.id,
            assuranceTier: policy.assuranceTier,
            provenance: 'APPROVED_RULESET',
            state: 'ACTIVE',
            evidenceSnapshot: {
              ...evidenceSnapshot(meal),
              ruleEvaluations: evaluations,
              rulePolicyVersionId: policy.id,
            } as unknown as Prisma.InputJsonValue,
            activatedAt,
            auditDueAt: null,
          });
        }
        for (let offset = 0; offset < automaticClearances.length; offset += 250) {
          await tx.mealConditionClearance.createMany({
            data: automaticClearances.slice(offset, offset + 250),
            skipDuplicates: true,
          });
        }
      }
      return activatedPolicy;
    });
  }

  static async suspendRuleset(nutritionistProfileId: string, policyVersionId: string, reason: string) {
    const reviewer = await requireEligibleReviewer(nutritionistProfileId);
    return prisma.$transaction(async (tx) => {
      const policy = await tx.conditionRulePolicyVersion.update({
        where: { id: policyVersionId },
        data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason.trim().slice(0, 240) },
      });
      await Promise.all([
        tx.conditionNutrientRule.updateMany({
          where: { condition: policy.condition, policyVersion: policy.policyVersion },
          data: { active: false },
        }),
        tx.conditionIngredientRule.updateMany({
          where: { condition: policy.condition, policyVersion: policy.policyVersion },
          data: { active: false },
        }),
      ]);
      const affected = await tx.mealConditionClearance.findMany({
        where: { rulePolicyVersionId: policy.id, state: 'ACTIVE' },
        select: { id: true },
      });
      const clearanceIds = affected.map((clearance) => clearance.id);
      if (clearanceIds.length) {
        await tx.mealConditionClearance.updateMany({
          where: { id: { in: clearanceIds } },
          data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: 'SOURCE_RULESET_SUSPENDED' },
        });
        await tx.mealPlan.updateMany({
          where: { clearanceUsages: { some: { clearanceId: { in: clearanceIds } } }, status: 'APPROVED' },
          data: { requiresSafetyRevalidation: true },
        });
      }
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'CONDITION_RULESET_SUSPENDED',
          entityType: 'ConditionRulePolicyVersion',
          entityId: policy.id,
          metadata: { affectedClearances: clearanceIds.length, reason: policy.suspensionReason },
        },
      });
      return { policy, affectedClearances: clearanceIds.length };
    });
  }
}

export async function suspendMealClearancesForEvidenceChange(
  tx: Prisma.TransactionClient,
  mealLibraryId: string,
  reason: string
) {
  const active = await tx.mealConditionClearance.findMany({
    where: { mealLibraryId, state: { in: ['ACTIVE', 'REVIEW_DUE'] } },
    select: { id: true },
  });
  const ids = active.map((clearance) => clearance.id);
  if (!ids.length) return 0;
  await tx.mealConditionClearance.updateMany({
    where: { id: { in: ids } },
    data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason.slice(0, 240) },
  });
  await tx.mealPlan.updateMany({
    where: { clearanceUsages: { some: { clearanceId: { in: ids } } }, status: 'APPROVED' },
    data: { requiresSafetyRevalidation: true },
  });
  return ids.length;
}

export async function enforceClearanceCircuitBreakers(now: Date = new Date()) {
  const [manualClearances, activePolicies] = await Promise.all([
    prisma.mealConditionClearance.findMany({
      where: { state: 'ACTIVE', provenance: 'MANUAL_REVIEW' },
      include: {
        decisions: {
          where: { decision: 'APPROVE' },
          include: {
            nutritionistProfile: {
              select: {
                isVerified: true,
                prcLicenseExpiry: true,
                user: { select: { isSuspended: true } },
              },
            },
          },
        },
      },
    }),
    prisma.conditionRulePolicyVersion.findMany({
      where: { state: 'ACTIVE' },
      include: {
        approvals: {
          where: { decision: 'APPROVE' },
          include: {
            nutritionistProfile: {
              select: {
                isVerified: true,
                prcLicenseExpiry: true,
                user: { select: { isSuspended: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const ineligibleManualIds = manualClearances
    .filter((clearance) => {
      const eligible = clearance.decisions.filter((decision) =>
        isNutritionistEligibleForReview(decision.nutritionistProfile, now)
      );
      return eligible.length < 1;
    })
    .map((clearance) => clearance.id);
  const invalidPolicyIds = activePolicies
    .filter((policy) => {
      const eligible = policy.approvals.filter((approval) =>
        isNutritionistEligibleForReview(approval.nutritionistProfile, now)
      );
      return eligible.length < 2;
    })
    .map((policy) => policy.id);

  if (!ineligibleManualIds.length && !invalidPolicyIds.length) {
    return { suspendedClearances: 0, suspendedPolicies: 0 };
  }

  return prisma.$transaction(async (tx) => {
    const policyDerived = invalidPolicyIds.length
      ? await tx.mealConditionClearance.findMany({
          where: { state: 'ACTIVE', rulePolicyVersionId: { in: invalidPolicyIds } },
          select: { id: true },
        })
      : [];
    const policyClearanceIds = policyDerived.map((clearance) => clearance.id);
    if (ineligibleManualIds.length) {
      await tx.mealConditionClearance.updateMany({
        where: { id: { in: ineligibleManualIds }, state: 'ACTIVE' },
        data: { state: 'SUSPENDED', suspendedAt: now, suspensionReason: 'REVIEWER_ELIGIBILITY_LAPSED' },
      });
    }
    if (invalidPolicyIds.length) {
      await tx.conditionRulePolicyVersion.updateMany({
        where: { id: { in: invalidPolicyIds }, state: 'ACTIVE' },
        data: { state: 'SUSPENDED', suspendedAt: now, suspensionReason: 'APPROVER_ELIGIBILITY_LAPSED' },
      });
      for (const policy of activePolicies.filter((candidate) => invalidPolicyIds.includes(candidate.id))) {
        await Promise.all([
          tx.conditionNutrientRule.updateMany({
            where: { condition: policy.condition, policyVersion: policy.policyVersion },
            data: { active: false },
          }),
          tx.conditionIngredientRule.updateMany({
            where: { condition: policy.condition, policyVersion: policy.policyVersion },
            data: { active: false },
          }),
        ]);
      }
      if (policyClearanceIds.length) {
        await tx.mealConditionClearance.updateMany({
          where: { id: { in: policyClearanceIds }, state: 'ACTIVE' },
          data: { state: 'SUSPENDED', suspendedAt: now, suspensionReason: 'SOURCE_RULESET_SUSPENDED' },
        });
      }
    }
    const allClearanceIds = [...new Set([...ineligibleManualIds, ...policyClearanceIds])];
    if (allClearanceIds.length) {
      await tx.mealPlan.updateMany({
        where: { status: 'APPROVED', clearanceUsages: { some: { clearanceId: { in: allClearanceIds } } } },
        data: { requiresSafetyRevalidation: true },
      });
      await tx.auditEvent.createMany({
        data: allClearanceIds.map((id) => ({
          action: 'CONDITION_CLEARANCE_CIRCUIT_BREAKER',
          entityType: 'MealConditionClearance',
          entityId: id,
          metadata: { evaluatedAt: now.toISOString() },
        })),
      });
    }
    return { suspendedClearances: allClearanceIds.length, suspendedPolicies: invalidPolicyIds.length };
  });
}

export function mayAutomateCondition(condition: HealthConditionType): boolean {
  return conditionAllowsRulesetAutomation(condition);
}
