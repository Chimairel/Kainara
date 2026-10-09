import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { env } from '@/config/env';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { healthDetailsAreas } from '@/domain/health-details.policy';
import {
  profileChangesSchema,
  publishProfileProposalSchema,
  respondProfileProposalSchema,
  proposalDisplayStatus,
  type ProfileChanges,
} from '@/domain/clinical-profile-proposal.policy';
import {
  currentClaim,
  currentClarificationContext,
  hasUnresolvedClarifications,
} from './clinical-clarification.service';
import { lockUserProfile, advanceSafetyRevision } from './profile-revision.service';
import { SafetyIntakeService, mergeSafetyDomains, buildLegacySafetyProjection } from './safety-intake.service';
import { ReviewRoutingService } from './review-routing.service';

const activeStatuses = ['PENDING', 'CORRECTION_REQUESTED'];
const stale = () =>
  new AppError('This profile correction is outdated. Open the latest profile.', 409, 'PROFILE_PROPOSAL_STALE');
export async function hasPendingProfileProposal(
  userId: string,
  current: { profileRevision: number; scopeKey: string },
  tx: Pick<Prisma.TransactionClient, 'clinicalProfileProposal'> = prisma
) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return false;
  return (
    (await tx.clinicalProfileProposal.count({ where: { userId, ...current, status: { in: activeStatuses } } })) > 0
  );
}
async function preparedInputs(tx: Prisma.TransactionClient, userId: string, changes: ProfileChanges) {
  const inputs = await SafetyIntakeService.getCurrentInputs(userId, tx);
  const merged = mergeSafetyDomains(
    inputs,
    changes.domains.map((d) => d.domain),
    changes.domains.flatMap((d) => d.entries.map((e) => ({ ...e, domain: d.domain })))
  );
  const preview = SafetyIntakeService.preview(merged);
  if (!preview.canSave) throw new AppError(preview.errors.join(' '), 422, 'PROFILE_CORRECTION_INVALID');
  const legacy = buildLegacySafetyProjection(preview.entries);
  const allowed = healthDetailsAreas({
    userProfile: { safetyRevision: 0, otherConditions: legacy.otherConditions, otherAllergies: legacy.otherAllergies },
    healthConditions: legacy.conditions.map((condition) => ({ condition })),
    allergies: legacy.allergies.map((allergen) => ({ allergen })),
  });
  if (changes.healthDetails.some((item) => !allowed.includes(item.area)))
    throw new AppError(
      'Health details must belong to a proposed declared condition or restriction.',
      422,
      'CLINICAL_AREA_NOT_DECLARED'
    );
  return { inputs, merged };
}

export class ClinicalProfileProposalService {
  static assertEnabled() {
    if (!env.CLINICAL_CLARIFICATIONS_ENABLED)
      throw new AppError('Profile corrections are not enabled yet.', 503, 'CLARIFICATIONS_DISABLED');
  }
  static async list(userId: string, reviewerId?: string) {
    if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return { enabled: false, proposals: [], editableInputs: [] };
    if (reviewerId) await ReviewRoutingService.assertProfile(reviewerId, userId);
    const current = await currentClarificationContext(prisma, userId);
    const proposals = await prisma.clinicalProfileProposal.findMany({
      where: { userId },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      enabled: true,
      catalogue: SafetyIntakeService.getCatalogue(),
      editableInputs: await SafetyIntakeService.getCurrentInputs(userId),
      proposals: proposals.map((p) => ({
        id: p.id,
        profileRevision: p.profileRevision,
        scopeKey: p.scopeKey,
        status: proposalDisplayStatus(p, { profileRevision: current.profile.revision, scopeKey: current.scopeKey }),
        beforeSnapshot: p.beforeSnapshot,
        changes: profileChangesSchema.parse(p.changes),
        evidenceSnapshot: p.evidenceSnapshot,
        rationale: p.rationale,
        authorName: p.author.name,
        createdAt: p.createdAt,
        memberNote: p.memberNote,
        respondedAt: p.respondedAt,
        acceptedProfileRevision: p.acceptedProfileRevision,
      })),
    };
  }
  static async publish(reviewerId: string, userId: string, supplied: z.infer<typeof publishProfileProposalSchema>) {
    this.assertEnabled();
    const input = publishProfileProposalSchema.parse(supplied);
    return prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        const reviewer = await currentClaim(tx, reviewerId, userId, input);
        const prior = await tx.clinicalProfileProposal.findUnique({
          where: { userId_requestKey: { userId, requestKey: input.requestKey } },
        });
        if (prior) {
          const sources = (prior.evidenceSnapshot as Prisma.JsonArray).map((s) => {
            const v = s as Prisma.JsonObject;
            return { formId: v.formId, responseId: v.responseId };
          });
          if (
            prior.authorUserId !== reviewer.userId ||
            prior.profileRevision !== input.profileRevision ||
            prior.scopeKey !== input.scopeKey ||
            prior.rationale !== input.rationale ||
            prior.replacesProposalId !== (input.replacesProposalId ?? null) ||
            !isDeepStrictEqual(prior.changes, input.changes) ||
            !isDeepStrictEqual(sources, input.evidence)
          )
            throw new AppError(
              'This retry key belongs to a different correction.',
              409,
              'PROFILE_PROPOSAL_RETRY_CONFLICT'
            );
          return { id: prior.id };
        }
        if (await hasUnresolvedClarifications(userId, input, tx))
          throw new AppError(
            'Resolve current clarification forms before proposing corrections.',
            422,
            'PROFILE_CLARIFICATION_REQUIRED'
          );
        const current = await currentClarificationContext(tx, userId);
        await tx.clinicalProfileProposal.updateMany({
          where: {
            userId,
            status: { in: activeStatuses },
            OR: [{ profileRevision: { not: input.profileRevision } }, { scopeKey: { not: input.scopeKey } }],
          },
          data: { status: 'SUPERSEDED' },
        });
        const active = await tx.clinicalProfileProposal.findFirst({
          where: { userId, status: { in: activeStatuses } },
        });
        if (active && (active.status !== 'CORRECTION_REQUESTED' || active.id !== input.replacesProposalId))
          throw new AppError(
            'A correction is already awaiting the member. Review their response first.',
            409,
            'PROFILE_PROPOSAL_EXISTS'
          );
        if (!active && input.replacesProposalId) throw stale();
        const { inputs, merged } = await preparedInputs(tx, userId, input.changes);
        const contexts = await tx.clinicalContextResponse.findMany({ where: { userId } });
        const detailChanged = input.changes.healthDetails.some(({ area, ...answers }) => {
          const saved = contexts.find((c) => c.area === area)?.responses as Prisma.JsonObject | undefined;
          return Object.entries(answers).some(([key, value]) => saved?.[key] !== value);
        });
        if (
          isDeepStrictEqual(SafetyIntakeService.preview(inputs).entries, SafetyIntakeService.preview(merged).entries) &&
          !detailChanged
        )
          throw new AppError('The proposed values are unchanged.', 422, 'PROFILE_PROPOSAL_NO_CHANGE');
        const evidence: Prisma.InputJsonObject[] = [];
        for (const source of input.evidence) {
          const form = await tx.clinicalClarificationForm.findFirst({
            where: { id: source.formId, userId, profileRevision: input.profileRevision, scopeKey: input.scopeKey },
            include: { resolution: true, responses: { orderBy: { version: 'desc' }, take: 1 } },
          });
          if (
            !form?.resolution ||
            form.resolution.responseId !== source.responseId ||
            form.responses[0]?.id !== source.responseId
          )
            throw new AppError(
              'Use the latest resolved response from this profile case.',
              409,
              'PROFILE_PROPOSAL_EVIDENCE_STALE'
            );
          evidence.push({
            ...source,
            title: form.title,
            questions: form.questions,
            answers: form.responses[0].answers,
            resolution: form.resolution.rationale,
            authorUserId: form.authorUserId,
            resolvedByUserId: form.resolution.reviewerUserId,
          });
        }
        if (active)
          await tx.clinicalProfileProposal.update({ where: { id: active.id }, data: { status: 'SUPERSEDED' } });
        const proposal = await tx.clinicalProfileProposal.create({
          data: {
            userId,
            authorUserId: reviewer.userId,
            profileRevision: input.profileRevision,
            scopeKey: input.scopeKey,
            beforeSnapshot: {
              ...current.snapshot,
              safetyInputs: inputs.map((entry) => ({ ...entry })),
              healthDetails: contexts.map((c) => ({ area: c.area, responses: c.responses })),
            } as Prisma.InputJsonObject,
            changes: input.changes,
            evidenceSnapshot: evidence,
            rationale: input.rationale,
            requestKey: input.requestKey,
            replacesProposalId: input.replacesProposalId,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: reviewer.userId,
            action: 'CLINICAL_PROFILE_CORRECTION_PROPOSED',
            entityType: 'ClinicalProfileProposal',
            entityId: proposal.id,
            metadata: { profileRevision: input.profileRevision },
          },
        });
        await tx.notification.create({
          data: {
            userId,
            type: 'REVIEW_REQUEST',
            title: 'Review an RND profile correction',
            message: 'Open Health details to compare the proposed changes and acknowledge or request a correction.',
            targetPath: '/profile/clinical-evidence',
          },
        });
        return { id: proposal.id };
      },
      { timeout: 30000 }
    );
  }
  static async respond(userId: string, proposalId: string, supplied: z.infer<typeof respondProfileProposalSchema>) {
    this.assertEnabled();
    const input = respondProfileProposalSchema.parse(supplied);
    return prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        const proposal = await tx.clinicalProfileProposal.findFirst({ where: { id: proposalId, userId } });
        if (!proposal) throw new AppError('Correction not found.', 404, 'PROFILE_PROPOSAL_NOT_FOUND');
        if (proposal.memberRequestKey === input.requestKey) {
          if (
            proposal.memberNote !== input.note ||
            proposal.profileRevision !== input.profileRevision ||
            proposal.scopeKey !== input.scopeKey ||
            proposal.status !== (input.decision === 'ACCEPT' ? 'ACCEPTED' : 'CORRECTION_REQUESTED')
          )
            throw new AppError('This response retry key has different values.', 409, 'PROFILE_PROPOSAL_RETRY_CONFLICT');
          return { id: proposal.id, status: proposal.status, profileRevision: proposal.acceptedProfileRevision };
        }
        const current = await currentClarificationContext(tx, userId);
        if (
          proposal.status !== 'PENDING' ||
          proposal.profileRevision !== current.profile.revision ||
          proposal.scopeKey !== current.scopeKey ||
          input.profileRevision !== proposal.profileRevision ||
          input.scopeKey !== proposal.scopeKey
        )
          throw stale();
        let acceptedProfileRevision: number | null = null;
        if (input.decision === 'ACCEPT') {
          const reviewer = await tx.nutritionistProfile.findUnique({
            where: { userId: proposal.authorUserId },
            include: { user: true },
          });
          if (!reviewer || !isNutritionistEligibleForReview(reviewer))
            throw new AppError(
              'The proposing RND is no longer eligible. Request a revised correction from the review team.',
              409,
              'PROFILE_PROPOSAL_REVIEWER_INELIGIBLE'
            );
          if (await hasUnresolvedClarifications(userId, input, tx))
            throw new AppError('Current clarification must be resolved first.', 422, 'PROFILE_CLARIFICATION_REQUIRED');
          const changes = profileChangesSchema.parse(proposal.changes);
          const { merged } = await preparedInputs(tx, userId, changes);
          const saved = await SafetyIntakeService.save(userId, merged, tx);
          const updated = saved.changed
            ? await tx.userProfile.findUniqueOrThrow({ where: { userId } })
            : await advanceSafetyRevision(tx, userId);
          for (const { area, ...answers } of changes.healthDetails) {
            const responses = { ...answers, formVersion: 'HEALTH_DETAILS_V1', safetyRevision: updated.safetyRevision };
            await tx.clinicalContextResponse.upsert({
              where: { userId_area: { userId, area } },
              create: { userId, area, responses },
              update: { responses, revision: { increment: 1 } },
            });
          }
          await tx.mealConditionClearance.updateMany({
            where: { userScopeId: userId, state: { in: ['ACTIVE', 'REVIEW_DUE'] } },
            data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: 'RND_PROFILE_CORRECTION_ACCEPTED' },
          });
          await tx.clinicalProfileReview.updateMany({
            where: { userId, claimedByNutritionistId: { not: null } },
            data: { claimedByNutritionistId: null, claimedAt: null },
          });
          acceptedProfileRevision = updated.revision;
        }
        const status = input.decision === 'ACCEPT' ? 'ACCEPTED' : 'CORRECTION_REQUESTED';
        await tx.clinicalProfileProposal.update({
          where: { id: proposal.id },
          data: {
            status,
            memberNote: input.note,
            memberRequestKey: input.requestKey,
            respondedAt: new Date(),
            acceptedProfileRevision,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: userId,
            action:
              input.decision === 'ACCEPT'
                ? 'CLINICAL_PROFILE_CORRECTION_ACCEPTED'
                : 'CLINICAL_PROFILE_CORRECTION_REQUESTED',
            entityType: 'ClinicalProfileProposal',
            entityId: proposal.id,
            metadata: { previousProfileRevision: proposal.profileRevision, acceptedProfileRevision },
          },
        });
        return { id: proposal.id, status, profileRevision: acceptedProfileRevision };
      },
      { timeout: 30000 }
    );
  }
}
