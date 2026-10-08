import { ReviewRoutingService } from './review-routing.service';
import { createHash, randomUUID } from 'node:crypto';
import { ClinicalEvidenceArea, ClinicalProfileReviewStatus, NotificationType, Prisma, Role } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requiresIndividualPlanningReview } from '@/domain/planning-membership.policy';
import { AppError } from '@/errors/AppError';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '@/domain/deterministic-nutrition-report.policy';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { lockUserProfile } from './profile-revision.service';

const POLICY_VERSION = 'PROFILE_DETAILS_V1';
const CLAIM_TTL_MS = 30 * 60_000;
const scopedPolicy = (scopeKey: string) =>
  `${POLICY_VERSION}:${createHash('sha256').update(scopeKey).digest('hex').slice(0, 48)}`;

const userInclude = {
  userProfile: true,
  healthConditions: true,
  allergies: true,
  safetyProfileEntries: true,
  clinicalContextResponses: true,
} satisfies Prisma.UserInclude;

type ProfileUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function snapshotKey(value: Prisma.JsonValue): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, Prisma.JsonValue>;
  const fields = ['conditions', 'allergies', 'customConditions', 'customFoodRestrictions'] as const;
  if (
    typeof record.safetyRevision !== 'number' ||
    fields.some(
      (field) =>
        !Array.isArray(record[field]) || !(record[field] as Prisma.JsonArray).every((item) => typeof item === 'string')
    )
  )
    return null;
  return JSON.stringify([
    record.safetyRevision,
    ...fields.map((field) => [...(record[field] as string[])].sort()),
    record.contextRevisions ?? [],
  ]);
}

function context(user: ProfileUser) {
  const profile = user.userProfile;
  if (!profile) throw new AppError('Complete your health profile before meal planning.', 422, 'PROFILE_INCOMPLETE');
  const restrictions = adaptUserSafetyRestrictions({
    healthConditions: user.healthConditions.map((item) => item.condition),
    allergies: user.allergies.map((item) => item.allergen),
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
    safetyEntries: user.safetyProfileEntries,
  });
  const snapshot = {
    safetyRevision: profile.safetyRevision,
    healthDetails: (user.clinicalContextResponses ?? []).map((item) => ({
      area: item.area,
      revision: item.revision,
      responses: item.responses,
    })),
    contextRevisions: (user.clinicalContextResponses ?? [])
      .map((item) => [item.area, item.revision])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    conditions: [...restrictions.conditions].sort(),
    allergies: [...restrictions.allergies].sort(),
    customConditions: [...restrictions.customConditions].sort(),
    customFoodRestrictions: [...restrictions.customFoodRestrictions].sort(),
  };
  return {
    profile,
    snapshot,
    scopeKey: snapshotKey(snapshot)!,
    declarationRequired:
      !user.safetyProfileEntries.some((item) => item.domain === 'CONDITION') ||
      !user.safetyProfileEntries.some((item) => item.domain === 'ALLERGY'),
    restricted: requiresIndividualPlanningReview(restrictions),
    // A named restriction requiring manual meal review can still receive profile
    // confirmation. Unmapped/vague declarations must first be clarified.
    needsClarification: restrictions.displayEntries.some(
      (entry) => entry.supportState !== 'SUPPORTED' && entry.supportState !== 'RECOGNIZED_UNSUPPORTED'
    ),
  };
}

function isCurrentApproval(
  review: { status: ClinicalProfileReviewStatus; profileSnapshot: Prisma.JsonValue },
  scopeKey: string
) {
  return review.status === 'APPROVED' && snapshotKey(review.profileSnapshot) === scopeKey;
}

export class ClinicalProfileReviewService {
  static async status(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    const current = context(user);
    const [latest, approvals] = current.restricted
      ? await Promise.all([
          prisma.clinicalProfileReview.findFirst({
            where: { userId, policyVersion: scopedPolicy(current.scopeKey) },
            orderBy: { reviewedAt: { sort: 'desc', nulls: 'last' } },
            select: { status: true, profileSnapshot: true, reasonCodes: true, reviewNotes: true },
          }),
          prisma.clinicalProfileReview.findMany({
            where: { userId, policyVersion: { startsWith: POLICY_VERSION + ':' }, status: 'APPROVED' },
            select: { status: true, profileSnapshot: true },
          }),
        ])
      : [null, []];
    const request =
      latest &&
      snapshotKey(latest.profileSnapshot) === current.scopeKey &&
      latest.status === 'DECLINED' &&
      Array.isArray(latest.reasonCodes) &&
      ['DETAILS_REQUESTED', 'DOCUMENT_REQUESTED'].includes(String(latest.reasonCodes[0]))
        ? latest
        : null;
    const requestArea =
      request && Array.isArray(request.reasonCodes) && typeof request.reasonCodes[1] === 'string'
        ? request.reasonCodes[1]
        : null;
    return {
      required: current.restricted,
      approved:
        !current.declarationRequired &&
        (!current.restricted || approvals.some((review) => isCurrentApproval(review, current.scopeKey))),
      declarationRequired: current.declarationRequired,
      detailsRequest: request
        ? {
            area: requestArea,
            notes: request.reviewNotes,
          }
        : null,
    };
  }

  static async hasCurrentApproval(
    userId: string,
    client: Pick<Prisma.TransactionClient, 'user' | 'clinicalProfileReview'> = prisma
  ) {
    const user = await client.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    const current = context(user);
    if (current.declarationRequired) return false;
    if (!current.restricted) return true;
    const approvals = await client.clinicalProfileReview.findMany({
      where: { userId, policyVersion: { startsWith: POLICY_VERSION + ':' }, status: 'APPROVED' },
      orderBy: { reviewedAt: 'desc' },
      select: { status: true, profileSnapshot: true },
    });
    return approvals.some((review) => isCurrentApproval(review, current.scopeKey));
  }

  static async assertReadyForMealPlanning(userId: string) {
    if (await this.hasCurrentApproval(userId)) return;
    const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
    if (user && context(user).declarationRequired) {
      throw new AppError(
        'Confirm your conditions and allergies before meal planning.',
        422,
        'SAFETY_DECLARATION_REQUIRED'
      );
    }
    throw new AppError(
      'Your health profile is awaiting nutritionist review before meals can be prepared.',
      422,
      'PROFILE_REVIEW_REQUIRED'
    );
  }

  static async queue(reviewerId?: string) {
    const users = await prisma.user.findMany({
      where: {
        role: Role.USER,
        onboardingDone: true,
        OR: [
          { healthConditions: { some: { condition: { not: 'NONE' } } } },
          { allergies: { some: { allergen: { not: 'NONE' } } } },
          { safetyProfileEntries: { some: {} } },
          { userProfile: { is: { otherConditions: { not: null } } } },
          { userProfile: { is: { otherAllergies: { not: null } } } },
        ],
      },
      include: userInclude,
      orderBy: { createdAt: 'asc' },
    });
    const eligible = users
      .filter((user) => Boolean(user.userProfile))
      .map((user) => ({ user, current: context(user) }))
      .filter(({ current }) => current.restricted);
    const reviews = eligible.length
      ? await prisma.clinicalProfileReview.findMany({
          where: {
            userId: { in: eligible.map(({ user }) => user.id) },
            policyVersion: { startsWith: POLICY_VERSION + ':' },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const people = eligible
      .filter(
        ({ user, current }) =>
          !reviews.some((review) => review.userId === user.id && isCurrentApproval(review, current.scopeKey))
      )
      .map(({ user, current }) => ({
        userId: user.id,
        name: user.name,
        profileRevision: current.profile.revision,
        conditions: current.snapshot.conditions,
        allergies: current.snapshot.allergies,
        needsClarification: current.needsClarification,
        status: (() => {
          const review = reviews.find(
            (item) => item.userId === user.id && snapshotKey(item.profileSnapshot) === current.scopeKey
          );
          return review?.status === 'DECLINED' &&
            Array.isArray(review.reasonCodes) &&
            ['DETAILS_REQUESTED', 'DOCUMENT_REQUESTED'].includes(String(review.reasonCodes[0]))
            ? 'DETAILS_REQUESTED'
            : (review?.status ?? 'PENDING');
        })(),
      }));
    return reviewerId ? ReviewRoutingService.filterProfiles(people, reviewerId) : people;
  }

  static async claim(reviewerId: string, userId: string, release = false) {
    await ReviewRoutingService.assertProfile(reviewerId, userId);
    await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      await ReviewRoutingService.assertProfile(reviewerId, userId, tx);
      const reviewer = await tx.nutritionistProfile.findUnique({ where: { id: reviewerId }, include: { user: true } });
      if (!reviewer || !isNutritionistEligibleForReview(reviewer))
        throw new AppError('A currently verified nutritionist is required.', 403, 'NUTRITIONIST_INELIGIBLE');
      const user = await tx.user.findUnique({ where: { id: userId }, include: userInclude });
      if (!user || user.role !== Role.USER) throw new AppError('Profile not found.', 404, 'PROFILE_NOT_FOUND');
      const current = context(user);
      if (!current.restricted)
        throw new AppError('This profile does not need review.', 409, 'PROFILE_REVIEW_NOT_REQUIRED');
      const key = {
        userId_profileRevision_policyVersion: {
          userId,
          profileRevision: current.profile.revision,
          policyVersion: scopedPolicy(current.scopeKey),
        },
      };
      const row = await tx.clinicalProfileReview.findUnique({ where: key });
      if (release) {
        if (row?.claimedByNutritionistId === reviewerId)
          await tx.clinicalProfileReview.update({
            where: { id: row.id },
            data: { claimedByNutritionistId: null, claimedAt: null },
          });
        return;
      }
      if (row?.status === 'APPROVED')
        throw new AppError('This profile has already been confirmed.', 409, 'PROFILE_REVIEW_ALREADY_APPROVED');
      if (
        row?.claimedByNutritionistId &&
        row.claimedByNutritionistId !== reviewerId &&
        row.claimedAt &&
        Date.now() - row.claimedAt.getTime() < CLAIM_TTL_MS
      )
        throw new AppError('Another nutritionist has claimed this profile.', 409, 'PROFILE_REVIEW_CLAIMED');
      const data = { claimedByNutritionistId: reviewerId, claimedAt: new Date() };
      await tx.clinicalProfileReview.upsert({
        where: key,
        create: {
          id: randomUUID(),
          ...key.userId_profileRevision_policyVersion,
          profileSnapshot: current.snapshot,
          reasonCodes: [],
          ...data,
        },
        update: data,
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'CLINICAL_PROFILE_CLAIMED',
          entityType: 'User',
          entityId: userId,
        },
      });
    });
    return this.detail(userId, reviewerId);
  }

  static async detail(userId: string, reviewerId?: string) {
    if (reviewerId) await ReviewRoutingService.assertProfile(reviewerId, userId);
    const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user || user.role !== Role.USER) throw new AppError('Profile not found.', 404, 'PROFILE_NOT_FOUND');
    const current = context(user);
    if (!current.restricted)
      throw new AppError('This profile does not need a clinical review.', 409, 'PROFILE_REVIEW_NOT_REQUIRED');
    const [clinicalWorkspace, report, latestReview] = await Promise.all([
      ClinicalEvidenceService.workspace(userId),
      prisma.nutritionReport.findUnique({
        where: { userId },
        select: {
          version: true,
          profileRevision: true,
          isStale: true,
          generatedAt: true,
          acknowledgedAt: true,
          generalSummary: true,
        },
      }),
      prisma.clinicalProfileReview.findFirst({
        where: { userId, policyVersion: scopedPolicy(current.scopeKey) },
        orderBy: { reviewedAt: { sort: 'desc', nulls: 'last' } },
        select: {
          status: true,
          profileSnapshot: true,
          reasonCodes: true,
          reviewNotes: true,
        },
      }),
    ]);
    const reportVersion = report
      ? await prisma.nutritionReportVersion.findFirst({
          where: { userId, version: report.version },
          select: { content: true, policyVersion: true },
        })
      : null;
    const reportContent = reportVersion?.content;
    const references =
      reportContent && typeof reportContent === 'object' && !Array.isArray(reportContent)
        ? (reportContent as Record<string, Prisma.JsonValue>).referenceItems
        : null;
    const referenceItems = Array.isArray(references)
      ? references.flatMap((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
          const value = item as Record<string, Prisma.JsonValue>;
          if (
            typeof value.heading !== 'string' ||
            typeof value.value !== 'string' ||
            typeof value.explanation !== 'string' ||
            typeof value.sourceTitle !== 'string' ||
            typeof value.sourceUrl !== 'string'
          )
            return [];
          return [
            {
              heading: value.heading,
              value: value.value,
              explanation: value.explanation,
              sourceTitle: value.sourceTitle,
              sourceUrl: value.sourceUrl,
            },
          ];
        })
      : [];
    const claim = await prisma.clinicalProfileReview.findUnique({
      where: {
        userId_profileRevision_policyVersion: {
          userId,
          profileRevision: current.profile.revision,
          policyVersion: scopedPolicy(current.scopeKey),
        },
      },
    });
    const active =
      !!claim?.claimedByNutritionistId && !!claim.claimedAt && Date.now() - claim.claimedAt.getTime() < CLAIM_TTL_MS;
    return {
      scopeKey: current.scopeKey,
      claim: {
        active,
        mine: active && claim?.claimedByNutritionistId === reviewerId,
        expiresAt: active ? new Date(claim!.claimedAt!.getTime() + CLAIM_TTL_MS) : null,
      },
      healthDetails: clinicalWorkspace.contexts,
      userId,
      name: user.name,
      age: current.profile.age,
      goal: current.profile.goal,
      dietaryPreference: current.profile.dietaryPreference,
      dailyCalorieTarget: current.profile.dailyCalorieTarget,
      profileRevision: current.profile.revision,
      conditions: current.snapshot.conditions,
      allergies: current.snapshot.allergies,
      customConditions: current.snapshot.customConditions,
      customFoodRestrictions: current.snapshot.customFoodRestrictions,
      needsClarification: current.needsClarification,
      requirements: clinicalWorkspace.requirements,
      documents: clinicalWorkspace.documents.map(({ id, area, documentType, status, originalFileName, createdAt }) => ({
        id,
        area,
        documentType,
        status,
        originalFileName,
        createdAt,
      })),
      availableAreas: clinicalWorkspace.availableAreas,
      previousReview:
        latestReview && snapshotKey(latestReview.profileSnapshot) === current.scopeKey
          ? {
              status: latestReview.status,
              reasonCodes: latestReview.reasonCodes,
              notes: latestReview.reviewNotes,
            }
          : null,
      nutritionGuidance: report
        ? {
            version: report.version,
            generatedAt: report.generatedAt,
            acknowledgedAt: report.acknowledgedAt,
            isCurrent:
              !report.isStale &&
              report.profileRevision === current.profile.revision &&
              reportVersion?.policyVersion === NUTRITION_GUIDANCE_POLICY_VERSION,
            summary: report.generalSummary,
            referenceItems,
          }
        : null,
    };
  }

  static async decide(
    reviewerId: string,
    userId: string,
    decision: 'APPROVED' | 'DECLINED' | 'REQUEST_DETAILS',
    notes: string,
    area?: ClinicalEvidenceArea,
    expected?: { profileRevision: number; scopeKey: string }
  ) {
    await ReviewRoutingService.assertProfile(reviewerId, userId);
    const reviewer = await prisma.nutritionistProfile.findUnique({
      where: { id: reviewerId },
      include: { user: true },
    });
    if (!reviewer || !isNutritionistEligibleForReview(reviewer))
      throw new AppError('A currently verified nutritionist is required.', 403, 'NUTRITIONIST_INELIGIBLE');
    const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user || user.role !== Role.USER) throw new AppError('Profile not found.', 404, 'PROFILE_NOT_FOUND');
    const current = context(user);
    if (!current.restricted)
      throw new AppError('This profile does not need a clinical review.', 409, 'PROFILE_REVIEW_NOT_REQUIRED');
    if (decision === 'APPROVED') {
      if (current.declarationRequired)
        throw new AppError(
          'Ask the user to confirm their condition and allergy declarations in Health & goals.',
          422,
          'SAFETY_DECLARATION_REQUIRED'
        );
      if (current.needsClarification)
        throw new AppError(
          'Clarify unsupported or vague restrictions before approval.',
          422,
          'PROFILE_CLARIFICATION_REQUIRED'
        );
      await ClinicalEvidenceService.assertReadyForMealPlanning(userId);
    }
    if (decision === 'REQUEST_DETAILS') {
      const workspace = await ClinicalEvidenceService.workspace(userId);
      if (!area || !workspace.availableAreas.includes(area))
        throw new AppError('Select an area declared in this health profile.', 422, 'CLINICAL_AREA_NOT_DECLARED');
    }
    const row = await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      await ReviewRoutingService.assertProfile(reviewerId, userId, tx);
      const latestUser = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude });
      const latest = context(latestUser);
      if (latest.scopeKey !== current.scopeKey || latest.profile.revision !== current.profile.revision)
        throw new AppError('The profile changed during review. Open its latest version.', 409, 'PROFILE_REVIEW_STALE');
      if (!expected || expected.profileRevision !== current.profile.revision || expected.scopeKey !== current.scopeKey)
        throw new AppError('The profile changed. Reload and claim its current version.', 409, 'PROFILE_REVIEW_STALE');
      const liveReviewer = await tx.nutritionistProfile.findUnique({
        where: { id: reviewerId },
        include: { user: true },
      });
      if (!liveReviewer || !isNutritionistEligibleForReview(liveReviewer))
        throw new AppError('Your review access is no longer active.', 403, 'NUTRITIONIST_INELIGIBLE');
      const key = {
        userId_profileRevision_policyVersion: {
          userId,
          profileRevision: current.profile.revision,
          policyVersion: scopedPolicy(current.scopeKey),
        },
      };
      const existing = await tx.clinicalProfileReview.findUnique({ where: key });
      if (
        !existing ||
        existing.claimedByNutritionistId !== reviewerId ||
        !existing.claimedAt ||
        Date.now() - existing.claimedAt.getTime() >= CLAIM_TTL_MS
      )
        throw new AppError('Claim this profile before recording a decision.', 409, 'PROFILE_REVIEW_CLAIM_REQUIRED');
      if (existing?.status === 'APPROVED')
        throw new AppError('This profile revision has already been approved.', 409, 'PROFILE_REVIEW_ALREADY_APPROVED');
      const data = {
        status: decision === 'REQUEST_DETAILS' ? ClinicalProfileReviewStatus.DECLINED : decision,
        reasonCodes: decision === 'REQUEST_DETAILS' ? ['DETAILS_REQUESTED', area!] : [],
        profileSnapshot: current.snapshot,
        reviewerId,
        reviewNotes: notes,
        reviewedAt: new Date(),
        claimedByNutritionistId: null,
        claimedAt: null,
      };
      const changed = await tx.clinicalProfileReview.updateMany({
        where: { id: existing.id, status: { not: 'APPROVED' }, claimedByNutritionistId: reviewerId },
        data,
      });
      if (changed.count !== 1)
        throw new AppError('Another nutritionist completed this review.', 409, 'PROFILE_REVIEW_CONFLICT');
      const saved = await tx.clinicalProfileReview.findUniqueOrThrow({ where: { id: existing.id } });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'CLINICAL_PROFILE_REVIEWED',
          entityType: 'ClinicalProfileReview',
          entityId: saved.id,
          metadata: {
            decision,
            notes,
            area: area ?? null,
            profileRevision: current.profile.revision,
            safetyRevision: current.profile.safetyRevision,
            scopeKey: current.scopeKey,
          },
        },
      });
      return saved;
    });
    try {
      await prisma.notification.create({
        data: {
          userId,
          title:
            decision === 'APPROVED'
              ? 'Health profile reviewed'
              : decision === 'REQUEST_DETAILS'
                ? 'Health details requested'
                : 'Health profile needs an update',
          message:
            decision === 'APPROVED'
              ? 'A nutritionist reviewed your health profile. Meal candidates can now be prepared; each new meal still needs case approval before use.'
              : decision === 'REQUEST_DETAILS'
                ? `A nutritionist requested details for ${String(area).replace(/_/g, ' ').toLowerCase()}. Open Profile → Health details. Review note: ${notes.trim()}`
                : `A nutritionist could not approve your current health profile. Review note: ${notes.trim()}`,
          type: decision === 'APPROVED' ? NotificationType.ASSIGNMENT : NotificationType.REVIEW_REQUEST,
        },
      });
    } catch (error) {
      console.error('[ClinicalProfileReviewService] Notification failed:', error);
    }
    if (decision === 'APPROVED') {
      const report = await prisma.nutritionReport.findUnique({
        where: { userId },
        select: { acknowledgedAt: true, isStale: true },
      });
      if (report?.acknowledgedAt && !report.isStale) {
        const { UpcomingPlanPreparationService } = await import('./upcoming-plan-preparation.service');
        UpcomingPlanPreparationService.triggerNonBlocking(userId);
      }
    }
    return { id: row.id, status: row.status, reviewedAt: row.reviewedAt };
  }
}
