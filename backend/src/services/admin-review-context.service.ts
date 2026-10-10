import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { AuditDetailsService } from './audit-details.service';
import { MealReviewService } from './meal-review.service';
import { reviewActor } from './meal-review-context.service';
import { getMealApprovalCaseDetails } from './meal-approval-lifecycle.service';
import { decryptClinicalDocument } from '@/lib/clinical-document-crypto';

const unavailable = () =>
  new AppError('This record has no related clinical review case.', 404, 'REVIEW_CONTEXT_UNAVAILABLE');
const documentSelect = {
  id: true,
  area: true,
  documentType: true,
  status: true,
  revision: true,
  originalFileName: true,
  issuedAt: true,
  validUntil: true,
  facts: true,
  reviews: true,
} as const;

/** A case relationship is derived from its persisted audit target, never from a supplied member ID. */
export class AdminReviewContextService {
  static async file(actorUserId: string, auditId: string, documentId: string) {
    const context = await this.detail(actorUserId, auditId);
    if (!context.clinicalEvidence.some((item) => 'id' in item && item.id === documentId)) throw unavailable();
    return prisma.$transaction(async (tx) => {
      await reviewActor(tx, actorUserId);
      const document = await tx.clinicalDocument.findFirst({
        where: { id: documentId, withdrawnAt: null, status: { not: 'WITHDRAWN' } },
      });
      if (!document) throw unavailable();
      const buffer = decryptClinicalDocument(document);
      await tx.auditEvent.create({
        data: {
          actorUserId,
          action: 'ADMIN_REVIEW_SENSITIVE_FILE_ACCESSED',
          entityType: 'ClinicalDocument',
          entityId: documentId,
          metadata: { auditRecordId: auditId, access: 'READ_ONLY_CASE_OVERSIGHT' },
        },
      });
      return { buffer, mimeType: document.mimeType };
    });
  }
  static async detail(actorUserId: string, auditId: string, db: typeof prisma = prisma) {
    await AuditDetailsService.detail(auditId, 'admin', db);
    return db.$transaction(async (tx) => {
      await reviewActor(tx, actorUserId);
      const event = await tx.auditEvent.findUnique({
        where: { id: auditId },
        select: { entityType: true, entityId: true, action: true, metadata: true },
      });
      if (!event?.entityId) throw unavailable();
      let userId: string | null = null;
      let reviewedSnapshot: unknown = null;
      let decisions: unknown[] = [];
      let evidenceIds: string[] = [];
      let selectedDecisionId: string | null = null;
      let historicalInformation: string | null = null;
      if (event.entityType === 'MealPlan' && /REVIEW|APPROV|REJECT|CLEARANCE/.test(event.action)) {
        const plan = await tx.mealPlan.findUnique({
          where: { id: event.entityId },
          include: { reviewDecisions: { orderBy: { submittedAt: 'asc' } }, clinicalEvidence: true },
        });
        if (!plan) throw unavailable();
        userId = plan.userId;
        decisions = plan.reviewDecisions;
        const metadata =
          event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata) ? event.metadata : {};
        const selected = plan.reviewDecisions.find((item) => item.id === metadata.reviewDecisionId);
        selectedDecisionId = selected?.id ?? null;
        reviewedSnapshot = selected?.evidenceSnapshot ?? null;
        if (!selected)
          historicalInformation =
            'The decision link for this audit action was not recorded. Saved decisions are available as separate history; none is assumed to be this action.';
        evidenceIds = plan.clinicalEvidence.map((item) => item.clinicalDocumentId);
      } else if (event.entityType === 'ClinicalProfileReview' && event.action.startsWith('CLINICAL_PROFILE_')) {
        const review = await tx.clinicalProfileReview.findUnique({ where: { id: event.entityId } });
        if (!review) throw unavailable();
        userId = review.userId;
        reviewedSnapshot = review.profileSnapshot;
        decisions = [review];
      } else if (
        event.entityType === 'ClinicalClarificationForm' &&
        event.action.startsWith('CLINICAL_CLARIFICATION_')
      ) {
        const form = await tx.clinicalClarificationForm.findUnique({
          where: { id: event.entityId },
          include: { responses: { orderBy: { version: 'asc' } }, resolution: true },
        });
        if (!form) throw unavailable();
        userId = form.userId;
        reviewedSnapshot = {
          profile: form.profileSnapshot,
          title: form.title,
          profileRevision: form.profileRevision,
          questions: form.questions,
        };
        decisions = [...form.responses, ...(form.resolution ? [form.resolution] : [])];
      } else if (
        event.entityType === 'ClinicalProfileProposal' &&
        event.action.startsWith('CLINICAL_PROFILE_CORRECTION_')
      ) {
        const proposal = await tx.clinicalProfileProposal.findUnique({ where: { id: event.entityId } });
        if (!proposal) throw unavailable();
        userId = proposal.userId;
        reviewedSnapshot = proposal.beforeSnapshot;
        decisions = [proposal];
      } else if (event.entityType === 'ClinicalDocument' && event.action.startsWith('CLINICAL_DOCUMENT_')) {
        const document = await tx.clinicalDocument.findUnique({
          where: { id: event.entityId },
          select: { userId: true },
        });
        if (!document) throw unavailable();
        userId = document.userId;
        evidenceIds = [event.entityId];
      } else if (
        ['MealLibraryProfileApproval', 'MealConditionClearance'].includes(event.entityType) &&
        event.action.startsWith('MEAL_APPROVAL_')
      ) {
        const kind = event.entityType === 'MealLibraryProfileApproval' ? 'PROFILE' : 'CONDITION';
        const approval =
          kind === 'PROFILE'
            ? await tx.mealLibraryProfileApproval.findUnique({
                where: { id: event.entityId },
                select: { mealLibraryId: true },
              })
            : await tx.mealConditionClearance.findUnique({
                where: { id: event.entityId },
                select: { mealLibraryId: true },
              });
        if (!approval) throw unavailable();
        const related = await getMealApprovalCaseDetails({
          mealLibraryId: approval.mealLibraryId,
          kind,
          approvalId: event.entityId,
        });
        await tx.auditEvent.create({
          data: {
            actorUserId,
            action: 'ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED',
            entityType: event.entityType,
            entityId: event.entityId,
            metadata: { auditRecordId: auditId, caseType: event.entityType },
          },
        });
        return {
          currentProfile: related.linkedUserCurrentProfile,
          reviewedSnapshot: related.recordedCaseScope,
          decisions: [related],
          clinicalEvidence: related.reviewedClinicalDocuments,
          historicalInformation: related.recordedCaseScope
            ? null
            : 'Historical approval profile information was not recorded.',
        };
      } else if (event.entityType === 'MealLibrary' && event.action.startsWith('MEAL_REVIEW_')) {
        const recipe = await MealReviewService.detail(event.entityId);
        // Recipe-wide cases grant no access to arbitrary members who happen to use that recipe.
        return {
          recipe,
          currentProfile: null,
          reviewedSnapshot: null,
          clinicalEvidence: [],
          decisions: [],
          historicalInformation: 'Recipe review only; no member clinical case is attached.',
        };
      } else throw unavailable();
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          userProfile: true,
          healthConditions: true,
          allergies: true,
          safetyProfileEntries: true,
          clinicalContextResponses: true,
        },
      });
      if (!user) throw unavailable();
      const clinicalEvidence = evidenceIds.length
        ? await tx.clinicalDocument.findMany({ where: { id: { in: evidenceIds }, userId }, select: documentSelect })
        : [];
      await tx.auditEvent.create({
        data: {
          actorUserId,
          action: 'ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED',
          entityType: event.entityType,
          entityId: event.entityId,
          metadata: { auditRecordId: auditId, caseType: event.entityType, evidenceCount: clinicalEvidence.length },
        },
      });
      return {
        currentProfile: user,
        reviewedSnapshot,
        decisions,
        clinicalEvidence,
        selectedDecisionId,
        historicalInformation:
          historicalInformation ??
          (reviewedSnapshot
            ? null
            : 'A historical profile snapshot was not recorded. Current details are shown separately.'),
      };
    });
  }
}
