import { Prisma, Role } from '@prisma/client';
import prisma from '@/lib/prisma';

const reviewActions = [
  'BASE_MEAL_VERIFIED',
  'BASE_MEAL_REJECTED',
  'MEAL_BASE_FLAGGED',
  'MEAL_BASE_FLAG_RELEASED',
  'MEAL_PLAN_FIRST_HIGH_RISK_APPROVAL',
  'MEAL_PLAN_SECOND_HIGH_RISK_APPROVAL',
  'MEAL_PLAN_APPROVED',
  'MEAL_PLAN_REJECTED',
  'MEAL_PLAN_REVIEW_DISPUTED',
  'MEAL_PLAN_DISPUTE_RESOLVED',
  'MEAL_PLAN_REVIEW_CLAIM_RELEASED',
  'MEAL_APPROVAL_FLAGGED',
  'MEAL_APPROVAL_RECHECKED',
  'CLINICAL_PROFILE_REVIEWED',
  'CLINICAL_DOCUMENT_ACCESSED',
  'CLINICAL_DOCUMENT_SUFFICIENT_FOR_NUTRITION_REVIEW',
  'CLINICAL_DOCUMENT_NEEDS_CLARIFICATION',
  'CLINICAL_DOCUMENT_UNUSABLE',
  'CONDITION_CLEARANCE_ACTIVE',
  'CONDITION_CLEARANCE_REVIEW_DUE',
  'CONDITION_CLEARANCE_REVOKED',
  'CONDITION_CLEARANCE_EXPIRED',
  'CONDITION_CLEARANCE_DISPUTED',
  'CONDITION_CLEARANCE_DISPUTE_RESOLVED',
  'CONDITION_CLEARANCE_SUSPENDED',
  'CONDITION_RULESET_SUSPENDED',
  'NUTRITION_EVIDENCE_PREPARED',
  'COALESCED_MEAL_REVIEW_PUBLISHED',
  'OUTSIDE_MEAL_VERIFY',
  'OUTSIDE_MEAL_CORRECT',
  'OUTSIDE_MEAL_NEEDS_MORE_INFO',
  'OUTSIDE_MEAL_UNVERIFIABLE',
] as const;

const baseActions = ['BASE_MEAL_VERIFIED', 'BASE_MEAL_REJECTED'];
const eventWhere: Prisma.AuditEventWhereInput = {
  action: { in: [...reviewActions] },
  OR: [{ actorUser: { is: { role: Role.NUTRITIONIST } } }, { action: { in: baseActions }, actorUserId: null }],
};

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    BASE_MEAL_VERIFIED: 'Verified a meal',
    BASE_MEAL_REJECTED: 'Rejected meal verification',
    MEAL_BASE_FLAGGED: 'Flagged an entire meal',
    MEAL_BASE_FLAG_RELEASED: 'Released a meal flag',
    MEAL_PLAN_FIRST_HIGH_RISK_APPROVAL: 'Recorded first case decision',
    MEAL_PLAN_SECOND_HIGH_RISK_APPROVAL: 'Recorded independent second decision',
    MEAL_PLAN_APPROVED: 'Approved a case',
    MEAL_PLAN_REJECTED: 'Rejected a case',
    MEAL_PLAN_REVIEW_DISPUTED: 'Disputed a case',
    MEAL_PLAN_DISPUTE_RESOLVED: 'Resolved a dispute',
    MEAL_APPROVAL_FLAGGED: 'Flagged an approval',
    MEAL_APPROVAL_RECHECKED: 'Rechecked an approval',
    CLINICAL_PROFILE_REVIEWED: 'Reviewed a health profile',
    CLINICAL_DOCUMENT_ACCESSED: 'Opened a claimed clinical document',
    CLINICAL_DOCUMENT_SUFFICIENT_FOR_NUTRITION_REVIEW: 'Accepted a clinical document',
    CLINICAL_DOCUMENT_NEEDS_CLARIFICATION: 'Requested document clarification',
    CLINICAL_DOCUMENT_UNUSABLE: 'Marked a clinical document unusable',
    CONDITION_CLEARANCE_ACTIVE: 'Activated a condition clearance',
    CONDITION_CLEARANCE_REVIEW_DUE: 'Set a clearance for recheck',
    CONDITION_CLEARANCE_DISPUTED: 'Disputed a condition clearance',
    CONDITION_CLEARANCE_DISPUTE_RESOLVED: 'Resolved a clearance dispute',
    CONDITION_CLEARANCE_SUSPENDED: 'Suspended a clearance',
    CONDITION_RULESET_SUSPENDED: 'Suspended a condition ruleset',
    NUTRITION_EVIDENCE_PREPARED: 'Prepared nutrition evidence',
    COALESCED_MEAL_REVIEW_PUBLISHED: 'Published a shared meal review',
  };
  return labels[action] ?? action.replace(/_/g, ' ').toLowerCase();
}

function outcomeLabel(action: string) {
  if (/REJECTED|UNUSABLE|SUSPENDED|FLAGGED|DISPUTED|UNVERIFIABLE|REVOKED|REVIEW_DUE|EXPIRED/.test(action))
    return 'Needs attention';
  if (/ACCESSED|CLAIM_RELEASED/.test(action)) return 'Recorded';
  if (/NEEDS_CLARIFICATION|NEEDS_MORE_INFO/.test(action)) return 'Waiting for information';
  return 'Completed';
}

export class NutritionistAuditService {
  static async history(requestedPage: number, requestedLimit: number, db = prisma) {
    const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
    const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, Math.floor(requestedLimit))) : 20;
    const take = page * limit;
    // Flags predate AuditEvent coverage. The flag record is the canonical history row;
    // the newer MEAL_LIBRARY_FLAGGED event is deliberately omitted to avoid duplicates.
    const [events, flags, eventCount, flagCount] = await Promise.all([
      db.auditEvent.findMany({
        where: eventWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        include: { actorUser: { select: { name: true } } },
      }),
      db.mealLibraryFlag.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        include: {
          mealLibrary: { select: { mealName: true } },
          flaggedByNutritionist: { include: { user: { select: { name: true } } } },
          flaggedByAdminUser: { select: { name: true } },
        },
      }),
      db.auditEvent.count({ where: eventWhere }),
      db.mealLibraryFlag.count(),
    ]);
    const reviewerIds = events.flatMap((event) => {
      if (event.actorUser?.name || !baseActions.includes(event.action)) return [];
      const metadata = event.metadata;
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
      const reviewerId = (metadata as Record<string, unknown>).reviewerProfileId;
      return typeof reviewerId === 'string' ? [reviewerId] : [];
    });
    const reviewers = reviewerIds.length
      ? await db.nutritionistProfile.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, user: { select: { name: true } } },
        })
      : [];
    const reviewerNames = new Map(reviewers.map((item) => [item.id, item.user.name]));
    const libraryIds = events.flatMap((event) =>
      event.entityId && ['MealLibrary', 'LIBRARY_MEAL'].includes(event.entityType) ? [event.entityId] : []
    );
    const planIds = events.flatMap((event) =>
      event.entityId && event.entityType === 'MealPlan' ? [event.entityId] : []
    );
    const rawIds = events.flatMap((event) =>
      event.entityId && event.entityType === 'RAW_RECIPE' ? [event.entityId] : []
    );
    const [libraryMeals, plans, rawRecipes] = await Promise.all([
      db.mealLibrary.findMany({ where: { id: { in: libraryIds } }, select: { id: true, mealName: true } }),
      db.mealPlan.findMany({ where: { id: { in: planIds } }, select: { id: true, mealName: true } }),
      db.rawRecipeCandidate.findMany({ where: { id: { in: rawIds } }, select: { id: true, recipeName: true } }),
    ]);
    const subjects = new Map<string, string>([
      ...libraryMeals.map((item) => [item.id, item.mealName] as const),
      ...plans.map((item) => [item.id, item.mealName] as const),
      ...rawRecipes.map((item) => [item.id, item.recipeName] as const),
    ]);
    const rows = [
      ...events.map((event) => {
        const metadata =
          event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
            ? (event.metadata as Record<string, unknown>)
            : {};
        return {
          id: event.id,
          occurredAt: event.createdAt,
          nutritionist:
            event.actorUser?.name ??
            (typeof metadata.reviewerProfileId === 'string' ? reviewerNames.get(metadata.reviewerProfileId) : null) ??
            'Former nutritionist',
          action: actionLabel(event.action),
          subject: event.entityId
            ? (subjects.get(event.entityId) ??
              (event.entityType === 'ClinicalProfileReview'
                ? 'Health profile'
                : event.entityType === 'ClinicalDocument'
                  ? 'Clinical document'
                  : event.entityType === 'OutsideMealLogItem'
                    ? 'Outside food log'
                    : 'Review record'))
            : 'Review record',
          outcome: outcomeLabel(event.action),
        };
      }),
      ...flags.map((flag) => ({
        id: `flag:${flag.id}`,
        occurredAt: flag.createdAt,
        nutritionist: flag.flaggedByNutritionist?.user.name ?? flag.flaggedByAdminUser?.name ?? 'Former reviewer',
        action: 'Flagged a meal',
        subject: flag.mealLibrary.mealName,
        outcome: 'Needs attention',
      })),
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id));
    return {
      rows: rows.slice((page - 1) * limit, take),
      page,
      limit,
      total: eventCount + flagCount,
      totalPages: Math.ceil((eventCount + flagCount) / limit),
    };
  }
}
