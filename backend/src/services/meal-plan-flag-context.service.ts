import { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { approvalRecheckContext } from './approval-recheck-context.service';
import { caseApprovalConcern } from './case-approval-flag.service';
import { env } from '@/config/env';

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
export async function mealPlanFlagContext(tx: Prisma.TransactionClient, planId: string) {
  const plan = await tx.mealPlan.findFirst({
    relationLoadStrategy: 'join',
    where: { id: planId },
    select: {
      libraryMealId: true,
      sourceRawRecipeCandidateId: true,
      profileApprovalId: true,
      clearanceUsages: { select: { clearance: { select: { id: true, mealLibraryId: true } } } },
    },
  });
  if (
    !plan ||
    (!plan.libraryMealId &&
      !plan.sourceRawRecipeCandidateId &&
      !plan.profileApprovalId &&
      !plan.clearanceUsages?.length)
  )
    return env.CLINICAL_CLARIFICATIONS_ENABLED ? caseApprovalConcern(tx, planId) : [];
  const concerns: Array<{
    kind: 'RECIPE' | 'PROFILE' | 'CONDITION' | 'CASE';
    mealLibraryId: string | null;
    approvalId?: string;
    active: boolean;
    id: string;
    createdAt?: string;
    actorSnapshot?: { name?: string };
    notes: {
      category?: string;
      explanation: string;
      reference?: string;
      proposedCorrection?: string;
      affectedFields?: string[];
    };
    resolution?: string;
    expectedVersion?: string;
  }> = [];
  const lineage = await tx.mealReviewLineage.findFirst({
    relationLoadStrategy: 'join',
    where: {
      OR: [
        ...(plan.libraryMealId ? [{ meals: { some: { id: plan.libraryMealId } } }] : []),
        ...(plan.sourceRawRecipeCandidateId ? [{ key: `source:${plan.sourceRawRecipeCandidateId}` }] : []),
      ],
    },
    include: {
      incidents: {
        orderBy: { number: 'desc' },
        take: 1,
        include: { reports: { orderBy: { createdAt: 'asc' } }, confirmations: { orderBy: { createdAt: 'desc' } } },
      },
    },
  });
  const incident = lineage?.incidents[0];
  for (const report of incident?.reports ?? []) {
    const notes = object(report.notes);
    const actor = object(report.actorSnapshot);
    const resolution = incident?.confirmations
      .flatMap((confirmation) => (Array.isArray(confirmation.resolutions) ? confirmation.resolutions : []))
      .map(object)
      .find((value) => value.reportId === report.id);
    concerns.push({
      kind: 'RECIPE',
      mealLibraryId: plan.libraryMealId,
      active: !incident?.closedAt,
      id: report.id,
      createdAt: report.createdAt.toISOString(),
      actorSnapshot: { name: typeof actor.name === 'string' ? actor.name : undefined },
      notes: {
        category: typeof notes.category === 'string' ? notes.category : undefined,
        explanation: String(notes.explanation ?? 'Concern details not recorded.'),
        reference: typeof notes.reference === 'string' ? notes.reference : undefined,
        proposedCorrection: typeof notes.proposedCorrection === 'string' ? notes.proposedCorrection : undefined,
        affectedFields: Array.isArray(notes.affectedFields)
          ? notes.affectedFields.filter((v): v is string => typeof v === 'string')
          : [],
      },
      resolution: typeof resolution?.rationale === 'string' ? resolution.rationale : undefined,
    });
  }
  const targets = [
    ...(plan.profileApprovalId && plan.libraryMealId
      ? [{ mealLibraryId: plan.libraryMealId, approvalId: plan.profileApprovalId, kind: 'PROFILE' as const }]
      : []),
    ...(plan.clearanceUsages ?? []).map(({ clearance }) => ({
      mealLibraryId: clearance.mealLibraryId,
      approvalId: clearance.id,
      kind: 'CONDITION' as const,
    })),
  ];
  for (const target of targets) {
    const context = await approvalRecheckContext(tx, target);
    if (context.flagged || context.resolution)
      concerns.push({
        ...context.concern,
        kind: target.kind,
        mealLibraryId: target.mealLibraryId,
        approvalId: target.approvalId,
        active: context.flagged,
        resolution: context.resolution,
      });
  }
  if (env.CLINICAL_CLARIFICATIONS_ENABLED) concerns.push(...await caseApprovalConcern(tx, planId));
  return concerns;
}
export async function assertPlanFlagConcernsResolved(tx: Prisma.TransactionClient, planId: string) {
  if ((await mealPlanFlagContext(tx, planId)).some((concern) => concern.active))
    throw new AppError(
      'Resolve the linked recipe or case flag before approving this meal.',
      409,
      'MEAL_FLAG_CONCERNS_UNRESOLVED'
    );
}
