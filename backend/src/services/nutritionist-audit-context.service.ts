import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { auditObject } from '@/domain/audit-details.policy';
import { AuditDetailsService } from './audit-details.service';
import { reviewActor } from './meal-review-context.service';
import { DATABASE_TRANSACTION_OPTIONS } from '@/lib/transaction-options';
import { caseApprovalFlagContext } from './case-approval-flag.service';

/** Historical review access never grants access to a member's current profile or original files. */
export class NutritionistAuditContextService {
  static async detail(userId: string, reviewerId: string, auditId: string, db = prisma) {
    const summary = await AuditDetailsService.detail(auditId, 'nutritionist', db);
    return db.$transaction(async (tx) => {
      await reviewActor(tx, userId, reviewerId);
      const event = await tx.auditEvent.findUnique({ where: { id: auditId } });
      if (!event) throw new AppError('No saved review context is linked to this action.', 404, 'REVIEW_CONTEXT_UNAVAILABLE');
      const metadata = auditObject(event.metadata);
      let selectedDecisionId: string | null = null;
      let reviewedSnapshot: unknown = null;
      let decisions: unknown[] = [];
      let historicalInformation: string | null = null;
      let approvalFlag: unknown = null;
      let recordedConcern: unknown = null;
      if (event.entityType === 'MealPlan' || event.entityType === 'MealPlanReviewDecision') {
        const original = event.action === 'MEAL_APPROVAL_REUSED' && typeof metadata.referenceId === 'string'
          ? await tx.mealReviewReference.findUnique({ where: { id: metadata.referenceId }, include: { decision: true } }) : null;
        const eventDecision = event.entityType === 'MealPlanReviewDecision'
          ? await tx.mealPlanReviewDecision.findUnique({ where: { id: event.entityId! } }) : null;
        const planId = original?.decision.mealPlanId ?? eventDecision?.mealPlanId ?? event.entityId!;
        const decisionId = original?.decisionId ?? eventDecision?.id ?? metadata.reviewDecisionId;
        const saved = await tx.mealPlanReviewDecision.findMany({
          where: { mealPlanId: planId }, orderBy: { submittedAt: 'asc' },
        });
        const linked = saved.find((item) => item.id === decisionId);
        selectedDecisionId = linked?.id ?? null;
        // Owner-authorized eligible RND access to the immutable saved context. No live profile or original files.
        decisions = saved;
        reviewedSnapshot = linked?.evidenceSnapshot ?? null;
        historicalInformation = !linked
          ? 'This older action has no exact decision link. Separate saved decisions are shown without assuming which one belongs to this action.'
          : null;
        if (event.entityType === 'MealPlanReviewDecision' && ['MEAL_APPROVAL_FLAGGED', 'MEAL_CASE_FLAG_RESOLVED'].includes(event.action)) {
          const flag = event.action === 'MEAL_APPROVAL_FLAGGED' ? event : typeof metadata.flagEventId === 'string'
            ? await tx.auditEvent.findUnique({ where: { id: metadata.flagEventId } }) : null;
          if (flag?.entityType === event.entityType && flag.entityId === event.entityId) {
            recordedConcern = { id: flag.id, kind: 'CASE', mealLibraryId: null, active: event.action === 'MEAL_APPROVAL_FLAGGED',
              createdAt: flag.createdAt, notes: auditObject(flag.metadata).notes,
              ...(event.action === 'MEAL_CASE_FLAG_RESOLVED' ? { resolution: metadata.rationale } : {}),
            };
          }
        }
        if (linked?.decision === 'APPROVE') {
          const context = await caseApprovalFlagContext(tx, linked.id);
          approvalFlag = { url: `/nutritionist/case-approvals/${linked.id}/flag`, expectedVersion: context.expectedVersion, canFlag: context.canFlag, flagged: context.flagged };
        }
      } else if (event.entityType === 'ClinicalProfileReview') {
        const saved = await tx.clinicalProfileReview.findUnique({ where: { id: event.entityId! } });
        if (!saved) throw new AppError('Saved profile review is unavailable.', 404, 'REVIEW_CONTEXT_UNAVAILABLE');
        const own = saved.reviewerId === reviewerId;
        reviewedSnapshot = own ? saved.profileSnapshot : null;
        decisions = [own ? saved : { id: saved.id, status: saved.status, profileRevision: saved.profileRevision, reviewedAt: saved.reviewedAt }];
        selectedDecisionId = saved.id;
        historicalInformation = own ? null : 'Private profile evidence is available to its recorded reviewer and administrator oversight.';
      } else if (/^BASE_MEAL_(VERIFIED|REJECTED)$/.test(event.action) && metadata.food) {
        selectedDecisionId = event.id;
        decisions = [{ id: event.id, decision: event.action, submittedAt: event.createdAt,
          rationale: metadata.reason ?? metadata.rationale,
          evidenceSnapshot: { original: metadata.food, effective: metadata.effective, reviewedBy: { name: event.actorName ?? summary.record.actor }, policyVersion: metadata.policyVersion } }];
      } else throw new AppError('No saved review context is linked to this action.', 404, 'REVIEW_CONTEXT_UNAVAILABLE');
      await tx.auditEvent.create({ data: { actorUserId: userId, actorRole: 'NUTRITIONIST',
        action: 'RND_REVIEW_SAVED_CONTEXT_ACCESSED', entityType: event.entityType, entityId: event.entityId,
        metadata: { auditRecordId: auditId, access: 'READ_ONLY_RECORDED_REVIEW' } } });
      return { currentProfile: null, reviewedSnapshot, decisions, clinicalEvidence: [], selectedDecisionId, historicalInformation, approvalFlag, recordedConcern };
    }, DATABASE_TRANSACTION_OPTIONS);
  }
}
