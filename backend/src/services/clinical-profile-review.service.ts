import { randomUUID } from 'node:crypto';
import { ClinicalProfileReviewStatus, NotificationType, Prisma, Role } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '@/domain/deterministic-nutrition-report.policy';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { lockUserProfile } from './profile-revision.service';

const POLICY_VERSION = 'NUTRIMIND_PROFILE_REVIEW_V1';

const userInclude = {
  userProfile: true,
  healthConditions: true,
  allergies: true,
  safetyProfileEntries: true,
} satisfies Prisma.UserInclude;

type ProfileUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function snapshotKey(value: Prisma.JsonValue): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, Prisma.JsonValue>;
  const fields = ['conditions', 'allergies', 'customConditions', 'customFoodRestrictions'] as const;
  if (typeof record.safetyRevision !== 'number' || fields.some((field) =>
    !Array.isArray(record[field]) || !(record[field] as Prisma.JsonArray).every((item) => typeof item === 'string'))) return null;
  return JSON.stringify([record.safetyRevision, ...fields.map((field) =>
    [...(record[field] as string[])].sort())]);
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
    conditions: [...restrictions.conditions].sort(),
    allergies: [...restrictions.allergies].sort(),
    customConditions: [...restrictions.customConditions].sort(),
    customFoodRestrictions: [...restrictions.customFoodRestrictions].sort(),
  };
  return {
    profile,
    snapshot,
    scopeKey: snapshotKey(snapshot)!,
    restricted: snapshot.conditions.some((item) => item !== 'NONE') || snapshot.allergies.some((item) => item !== 'NONE') ||
      snapshot.customConditions.length > 0 || snapshot.customFoodRestrictions.length > 0,
    needsClarification: restrictions.requiresReview,
  };
}

function isCurrentApproval(review: { status: ClinicalProfileReviewStatus; profileSnapshot: Prisma.JsonValue }, scopeKey: string) {
  return review.status === 'APPROVED' &&
    snapshotKey(review.profileSnapshot) === scopeKey;
}

export class ClinicalProfileReviewService {
  static async status(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    const required = context(user).restricted;
    return { required, approved: await this.hasCurrentApproval(userId) };
  }

  static async hasCurrentApproval(userId: string, client: Pick<Prisma.TransactionClient, 'user' | 'clinicalProfileReview'> = prisma) {
    const user = await client.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    const current = context(user);
    if (!current.restricted) return true;
    const approvals = await client.clinicalProfileReview.findMany({
      where: { userId, policyVersion: POLICY_VERSION, status: 'APPROVED' },
      orderBy: { reviewedAt: 'desc' }, select: { status: true, profileSnapshot: true },
    });
    return approvals.some((review) => isCurrentApproval(review, current.scopeKey));
  }

  static async assertReadyForMealPlanning(userId: string) {
    if (await this.hasCurrentApproval(userId)) return;
    throw new AppError('Your health profile is awaiting nutritionist review before meals can be prepared.', 422, 'PROFILE_REVIEW_REQUIRED');
  }

  static async queue() {
    const users = await prisma.user.findMany({
      where: {
        role: Role.USER, onboardingDone: true,
        OR: [
          { healthConditions: { some: { condition: { not: 'NONE' } } } },
          { allergies: { some: { allergen: { not: 'NONE' } } } },
          { safetyProfileEntries: { some: {} } },
          { userProfile: { is: { otherConditions: { not: null } } } },
          { userProfile: { is: { otherAllergies: { not: null } } } },
        ],
      },
      include: userInclude, orderBy: { createdAt: 'asc' },
    });
    const eligible = users.filter((user) => Boolean(user.userProfile))
      .map((user) => ({ user, current: context(user) })).filter(({ current }) => current.restricted);
    const reviews = eligible.length ? await prisma.clinicalProfileReview.findMany({
      where: { userId: { in: eligible.map(({ user }) => user.id) }, policyVersion: POLICY_VERSION },
      orderBy: { createdAt: 'desc' },
    }) : [];
    return eligible.filter(({ user, current }) =>
      !reviews.some((review) => review.userId === user.id && isCurrentApproval(review, current.scopeKey))
    ).map(({ user, current }) => ({
      userId: user.id, name: user.name, profileRevision: current.profile.revision,
      conditions: current.snapshot.conditions, allergies: current.snapshot.allergies,
      needsClarification: current.needsClarification,
      status: reviews.find((review) => review.userId === user.id &&
        snapshotKey(review.profileSnapshot) === current.scopeKey)?.status ?? 'PENDING',
    }));
  }

  static async detail(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user || user.role !== Role.USER) throw new AppError('Profile not found.', 404, 'PROFILE_NOT_FOUND');
    const current = context(user);
    if (!current.restricted) throw new AppError('This profile does not need a clinical review.', 409, 'PROFILE_REVIEW_NOT_REQUIRED');
    const [requirements, documents, report] = await Promise.all([
      ClinicalEvidenceService.requirementsForUser(userId),
      prisma.clinicalDocument.findMany({ where: { userId }, orderBy: { createdAt: 'desc' },
        select: { id: true, area: true, documentType: true, status: true, originalFileName: true, createdAt: true } }),
      prisma.nutritionReport.findUnique({ where: { userId }, select: {
        version: true, profileRevision: true, isStale: true, generatedAt: true,
        acknowledgedAt: true, generalSummary: true,
      } }),
    ]);
    const reportVersion = report ? await prisma.nutritionReportVersion.findFirst({
      where: { userId, version: report.version }, select: { content: true, policyVersion: true },
    }) : null;
    const reportContent = reportVersion?.content;
    const references = reportContent && typeof reportContent === 'object' && !Array.isArray(reportContent)
      ? (reportContent as Record<string, Prisma.JsonValue>).referenceItems : null;
    const referenceItems = Array.isArray(references) ? references.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const value = item as Record<string, Prisma.JsonValue>;
      if (typeof value.heading !== 'string' || typeof value.value !== 'string' ||
          typeof value.explanation !== 'string' || typeof value.sourceTitle !== 'string' ||
          typeof value.sourceUrl !== 'string') return [];
      return [{ heading: value.heading, value: value.value, explanation: value.explanation,
        sourceTitle: value.sourceTitle, sourceUrl: value.sourceUrl }];
    }) : [];
    return {
      userId, name: user.name, age: current.profile.age, goal: current.profile.goal,
      dietaryPreference: current.profile.dietaryPreference, dailyCalorieTarget: current.profile.dailyCalorieTarget,
      profileRevision: current.profile.revision, conditions: current.snapshot.conditions,
      allergies: current.snapshot.allergies, customConditions: current.snapshot.customConditions,
      customFoodRestrictions: current.snapshot.customFoodRestrictions,
      needsClarification: current.needsClarification, requirements, documents,
      nutritionGuidance: report ? {
        version: report.version, generatedAt: report.generatedAt, acknowledgedAt: report.acknowledgedAt,
        isCurrent: !report.isStale && report.profileRevision === current.profile.revision &&
          reportVersion?.policyVersion === NUTRITION_GUIDANCE_POLICY_VERSION,
        summary: report.generalSummary, referenceItems,
      } : null,
    };
  }

  static async decide(reviewerId: string, userId: string, decision: 'APPROVED' | 'DECLINED', notes: string) {
    const reviewer = await prisma.nutritionistProfile.findUnique({ where: { id: reviewerId } });
    if (!reviewer || !isNutritionistEligibleForReview(reviewer))
      throw new AppError('A currently verified nutritionist is required.', 403, 'NUTRITIONIST_INELIGIBLE');
    const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user || user.role !== Role.USER) throw new AppError('Profile not found.', 404, 'PROFILE_NOT_FOUND');
    const current = context(user);
    if (!current.restricted) throw new AppError('This profile does not need a clinical review.', 409, 'PROFILE_REVIEW_NOT_REQUIRED');
    if (decision === 'APPROVED') {
      if (current.needsClarification) throw new AppError('Clarify unsupported or vague restrictions before approval.', 422, 'PROFILE_CLARIFICATION_REQUIRED');
      await ClinicalEvidenceService.assertReadyForMealPlanning(userId);
    }
    const row = await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      const latestUser = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude });
      const latest = context(latestUser);
      if (latest.scopeKey !== current.scopeKey || latest.profile.revision !== current.profile.revision)
        throw new AppError('The profile changed during review. Open its latest version.', 409, 'PROFILE_REVIEW_STALE');
      const key = { userId_profileRevision_policyVersion: {
        userId, profileRevision: current.profile.revision, policyVersion: POLICY_VERSION,
      } };
      const existing = await tx.clinicalProfileReview.findUnique({ where: key });
      if (existing?.status === 'APPROVED')
        throw new AppError('This profile revision has already been approved.', 409, 'PROFILE_REVIEW_ALREADY_APPROVED');
      const data = { status: decision, reasonCodes: [], profileSnapshot: current.snapshot,
        reviewerId, reviewNotes: notes, reviewedAt: new Date() };
      let saved;
      if (existing) {
        const changed = await tx.clinicalProfileReview.updateMany({
          where: { id: existing.id, status: { not: 'APPROVED' } }, data,
        });
        if (changed.count !== 1) throw new AppError('Another nutritionist completed this review.', 409, 'PROFILE_REVIEW_CONFLICT');
        saved = await tx.clinicalProfileReview.findUniqueOrThrow({ where: { id: existing.id } });
      } else {
        saved = await tx.clinicalProfileReview.create({ data: {
          id: randomUUID(), userId, profileRevision: current.profile.revision,
          policyVersion: POLICY_VERSION, ...data,
        } });
      }
      await tx.auditEvent.create({ data: { actorUserId: reviewer.userId,
        action: 'CLINICAL_PROFILE_REVIEWED', entityType: 'ClinicalProfileReview', entityId: saved.id,
        metadata: { decision, profileRevision: current.profile.revision, safetyRevision: current.profile.safetyRevision } } });
      return saved;
    });
    try {
      await prisma.notification.create({ data: {
        userId,
        title: decision === 'APPROVED' ? 'Health profile reviewed' : 'Health profile needs an update',
        message: decision === 'APPROVED'
          ? 'A nutritionist reviewed your health profile. Meal candidates can now be prepared; each new meal still needs case approval before use.'
          : 'A nutritionist could not approve your current health profile. Review your health information and any requested clinical documents.',
        type: decision === 'APPROVED' ? NotificationType.ASSIGNMENT : NotificationType.REVIEW_REQUEST,
      } });
    } catch (error) {
      console.error('[ClinicalProfileReviewService] Notification failed:', error);
    }
    if (decision === 'APPROVED') {
      const report = await prisma.nutritionReport.findUnique({ where: { userId },
        select: { acknowledgedAt: true, isStale: true } });
      if (report?.acknowledgedAt && !report.isStale) {
        const { UpcomingPlanPreparationService } = await import('./upcoming-plan-preparation.service');
        UpcomingPlanPreparationService.triggerNonBlocking(userId);
      }
    }
    return { id: row.id, status: row.status, reviewedAt: row.reviewedAt };
  }
}
