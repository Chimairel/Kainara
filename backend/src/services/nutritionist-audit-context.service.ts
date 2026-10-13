import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { auditObject } from '@/domain/audit-details.policy';
import { AuditDetailsService } from './audit-details.service';
import { reviewActor } from './meal-review-context.service';
import { DATABASE_TRANSACTION_OPTIONS } from '@/lib/transaction-options';

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
      if (event.entityType === 'MealPlan') {
        const saved = await tx.mealPlanReviewDecision.findMany({
          where: { mealPlanId: event.entityId! }, orderBy: { submittedAt: 'asc' },
        });
        const linked = saved.find((item) => item.id === metadata.reviewDecisionId);
        selectedDecisionId = linked?.id ?? null;
        // Other RNDs see only immutable plate facts and recorded public attribution.
        // Private answers/notes/profile snapshots remain with the original reviewer.
        decisions = saved.map((item) => {
          if (item.nutritionistProfileId === reviewerId) return item;
          const evidence = auditObject(item.evidenceSnapshot);
          const plate = Object.fromEntries(['original', 'effective', 'mealName', 'calories', 'proteinG', 'carbsG', 'fatG', 'servingComponents', 'reviewedBy', 'policyVersion']
            .filter((key) => evidence[key] != null).map((key) => [key, evidence[key]]));
          return { id: item.id, decision: item.decision, stage: item.stage, submittedAt: item.submittedAt, evidenceSnapshot: plate };
        });
        reviewedSnapshot = linked?.nutritionistProfileId === reviewerId ? linked.evidenceSnapshot : null;
        historicalInformation = !linked
          ? 'This older action has no exact decision link. Separate saved decisions are shown without assuming which one belongs to this action.'
          : linked.nutritionistProfileId !== reviewerId
            ? 'Another RND recorded this case. Saved meal evidence is visible; private member context remains restricted. This decision does not approve another case.'
            : null;
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
      return { currentProfile: null, reviewedSnapshot, decisions, clinicalEvidence: [], selectedDecisionId, historicalInformation };
    }, DATABASE_TRANSACTION_OPTIONS);
  }
}
