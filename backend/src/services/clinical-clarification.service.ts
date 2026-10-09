import { isDeepStrictEqual } from 'node:util';
import { Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { env } from '@/config/env';
import { AppError } from '@/errors/AppError';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import {
  publishClarificationSchema,
  answerClarificationSchema,
  resolveClarificationSchema,
  clarificationQuestionsSchema,
  validateClarificationAnswers,
  clarificationDisplayState,
  type ClarificationContext,
} from '@/domain/clinical-clarification.policy';
import { context, userInclude, scopedPolicy, CLAIM_TTL_MS } from './clinical-profile-review.context';
import { lockUserProfile } from './profile-revision.service';
import { ReviewRoutingService } from './review-routing.service';

const actorSelect = { name: true } as const;
const formInclude = {
  author: { select: actorSelect },
  responses: { orderBy: { version: 'asc' as const } },
  resolution: { include: { reviewer: { select: actorSelect } } },
} satisfies Prisma.ClinicalClarificationFormInclude;
const stale = () => new AppError('The profile or answers changed. Open the current case.', 409, 'CLARIFICATION_STALE');

export async function currentClarificationContext(tx: Pick<Prisma.TransactionClient, 'user'>, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!user || user.role !== Role.USER) throw new AppError('Profile not found.', 404, 'PROFILE_NOT_FOUND');
  return context(user);
}

export async function hasUnresolvedClarifications(
  userId: string,
  current: ClarificationContext,
  tx: Pick<Prisma.TransactionClient, 'clinicalClarificationForm'> = prisma
) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return false;
  return (
    (await tx.clinicalClarificationForm.count({
      where: { userId, profileRevision: current.profileRevision, scopeKey: current.scopeKey, resolution: { is: null } },
    })) > 0
  );
}

async function currentClaim(
  tx: Prisma.TransactionClient,
  reviewerId: string,
  userId: string,
  expected: ClarificationContext
) {
  await ReviewRoutingService.assertProfile(reviewerId, userId, tx);
  const reviewer = await tx.nutritionistProfile.findUnique({ where: { id: reviewerId }, include: { user: true } });
  if (!reviewer || !isNutritionistEligibleForReview(reviewer))
    throw new AppError('A currently eligible RND is required.', 403, 'NUTRITIONIST_INELIGIBLE');
  const current = await currentClarificationContext(tx, userId);
  if (
    !current.restricted ||
    current.profile.revision !== expected.profileRevision ||
    current.scopeKey !== expected.scopeKey
  )
    throw stale();
  const review = await tx.clinicalProfileReview.findUnique({
    where: {
      userId_profileRevision_policyVersion: {
        userId,
        profileRevision: expected.profileRevision,
        policyVersion: scopedPolicy(expected.scopeKey),
      },
    },
  });
  if (
    !review ||
    review.status === 'APPROVED' ||
    review.claimedByNutritionistId !== reviewerId ||
    !review.claimedAt ||
    Date.now() - review.claimedAt.getTime() >= CLAIM_TTL_MS
  )
    throw new AppError('Claim this profile before changing clarification work.', 409, 'PROFILE_REVIEW_CLAIM_REQUIRED');
  return reviewer;
}

export class ClinicalClarificationService {
  static get enabled() {
    return env.CLINICAL_CLARIFICATIONS_ENABLED;
  }
  static assertEnabled() {
    if (!this.enabled) throw new AppError('Clarification forms are not enabled yet.', 503, 'CLARIFICATIONS_DISABLED');
  }

  static async list(userId: string, reviewerId?: string) {
    if (!this.enabled) return { enabled: false, forms: [] };
    if (reviewerId) {
      await ReviewRoutingService.assertProfile(reviewerId, userId);
      const reviewer = await prisma.nutritionistProfile.findUnique({
        where: { id: reviewerId },
        include: { user: true },
      });
      if (!reviewer || !isNutritionistEligibleForReview(reviewer))
        throw new AppError('A currently eligible RND is required.', 403, 'NUTRITIONIST_INELIGIBLE');
    }
    const current = await currentClarificationContext(prisma, userId);
    const forms = await prisma.clinicalClarificationForm.findMany({
      where: { userId },
      include: formInclude,
      orderBy: { createdAt: 'asc' },
    });
    const currentScope = { profileRevision: current.profile.revision, scopeKey: current.scopeKey };
    return {
      enabled: true,
      forms: forms.map((form) => ({
        id: form.id,
        title: form.title,
        profileRevision: form.profileRevision,
        scopeKey: form.scopeKey,
        questions: clarificationQuestionsSchema.parse(form.questions),
        createdAt: form.createdAt,
        authorName: form.author.name,
        responses: form.responses.map((response) => ({
          id: response.id,
          version: response.version,
          answers: response.answers,
          submittedAt: response.submittedAt,
        })),
        resolution: form.resolution
          ? {
              responseId: form.resolution.responseId,
              rationale: form.resolution.rationale,
              reviewerName: form.resolution.reviewer.name,
              resolvedAt: form.resolution.resolvedAt,
            }
          : null,
        status: clarificationDisplayState(form, currentScope, form.responses.length > 0, !!form.resolution),
      })),
    };
  }

  static async publish(reviewerId: string, userId: string, supplied: z.infer<typeof publishClarificationSchema>) {
    this.assertEnabled();
    const input = publishClarificationSchema.parse(supplied);
    return prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      const reviewer = await currentClaim(tx, reviewerId, userId, input);
      const prior = await tx.clinicalClarificationForm.findUnique({
        where: { userId_requestKey: { userId, requestKey: input.requestKey } },
      });
      if (prior) {
        if (
          prior.authorUserId !== reviewer.userId ||
          prior.profileRevision !== input.profileRevision ||
          prior.scopeKey !== input.scopeKey ||
          prior.title !== input.title ||
          !isDeepStrictEqual(prior.questions, input.questions)
        )
          throw new AppError(
            'This request key was already used for different questions.',
            409,
            'CLARIFICATION_RETRY_CONFLICT'
          );
        return { id: prior.id };
      }
      const form = await tx.clinicalClarificationForm.create({
        data: {
          userId,
          authorUserId: reviewer.userId,
          profileRevision: input.profileRevision,
          scopeKey: input.scopeKey,
          profileSnapshot: (await currentClarificationContext(tx, userId)).snapshot,
          title: input.title,
          questions: input.questions,
          requestKey: input.requestKey,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'CLINICAL_CLARIFICATION_PUBLISHED',
          entityType: 'ClinicalClarificationForm',
          entityId: form.id,
          metadata: { profileRevision: form.profileRevision, questionCount: input.questions.length },
        },
      });
      // Notifications intentionally contain no clinical questions or answers.
      await tx.notification.create({
        data: {
          userId,
          title: 'An RND requested clarification',
          type: 'REVIEW_REQUEST',
          message: 'Open Health details to answer the questions for your profile review.',
          targetPath: '/profile/clinical-evidence',
        },
      });
      return { id: form.id };
    });
  }

  static async answer(userId: string, formId: string, supplied: z.infer<typeof answerClarificationSchema>) {
    this.assertEnabled();
    const input = answerClarificationSchema.parse(supplied);
    return prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      const form = await tx.clinicalClarificationForm.findFirst({
        where: { id: formId, userId },
        include: formInclude,
      });
      if (!form) throw new AppError('Clarification form not found.', 404, 'CLARIFICATION_NOT_FOUND');
      const current = await currentClarificationContext(tx, userId);
      if (
        form.profileRevision !== current.profile.revision ||
        form.scopeKey !== current.scopeKey ||
        input.profileRevision !== form.profileRevision ||
        input.scopeKey !== form.scopeKey
      )
        throw stale();
      const prior = form.responses.find((response) => response.requestKey === input.requestKey);
      if (prior) {
        if (!isDeepStrictEqual(prior.answers, input.answers))
          throw new AppError(
            'This request key was already used for different answers.',
            409,
            'CLARIFICATION_RETRY_CONFLICT'
          );
        return { id: prior.id, version: prior.version };
      }
      if (form.resolution)
        throw new AppError(
          'This form is resolved. Request a profile correction for changed information.',
          409,
          'CLARIFICATION_RESOLVED'
        );
      const latest = form.responses.at(-1);
      if ((latest?.id ?? null) !== input.expectedResponseId) throw stale();
      if (!validateClarificationAnswers(clarificationQuestionsSchema.parse(form.questions), input.answers))
        throw new AppError(
          'Answer each required question using its available choices.',
          422,
          'CLARIFICATION_ANSWERS_INVALID'
        );
      const response = await tx.clinicalClarificationResponse.create({
        data: {
          formId,
          version: (latest?.version ?? 0) + 1,
          answers: input.answers,
          requestKey: input.requestKey,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: userId,
          action: 'CLINICAL_CLARIFICATION_ANSWERED',
          entityType: 'ClinicalClarificationForm',
          entityId: formId,
          metadata: {
            responseId: response.id,
            responseVersion: response.version,
            profileRevision: form.profileRevision,
          },
        },
      });
      return { id: response.id, version: response.version };
    });
  }

  static async resolve(
    reviewerId: string,
    userId: string,
    formId: string,
    supplied: z.infer<typeof resolveClarificationSchema>
  ) {
    this.assertEnabled();
    const input = resolveClarificationSchema.parse(supplied);
    return prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      const reviewer = await currentClaim(tx, reviewerId, userId, input);
      const form = await tx.clinicalClarificationForm.findFirst({
        where: { id: formId, userId },
        include: formInclude,
      });
      if (!form) throw new AppError('Clarification form not found.', 404, 'CLARIFICATION_NOT_FOUND');
      if (
        form.profileRevision !== input.profileRevision ||
        form.scopeKey !== input.scopeKey ||
        form.responses.at(-1)?.id !== input.responseId
      )
        throw stale();
      if (form.resolution) {
        if (
          form.resolution.responseId === input.responseId &&
          form.resolution.reviewerUserId === reviewer.userId &&
          form.resolution.rationale === input.rationale
        )
          return { id: form.resolution.id };
        throw new AppError('This clarification was already resolved.', 409, 'CLARIFICATION_RESOLVED');
      }
      const resolved = await tx.clinicalClarificationResolution.create({
        data: {
          formId,
          responseId: input.responseId,
          reviewerUserId: reviewer.userId,
          rationale: input.rationale,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'CLINICAL_CLARIFICATION_RESOLVED',
          entityType: 'ClinicalClarificationForm',
          entityId: formId,
          metadata: { responseId: input.responseId, profileRevision: input.profileRevision },
        },
      });
      return { id: resolved.id };
    });
  }
}
