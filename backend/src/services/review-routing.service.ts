import { createHash } from 'node:crypto';
import { HealthConditionType, Prisma, type ReviewRoutingEpisode } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AppError } from '@/errors/AppError';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import {
  eligibleRoutingReviewer,
  matchingReviewers,
  specialistPool,
  routingOpensAt,
  routingStage,
  type RoutingReviewer,
} from '@/domain/review-routing.policy';
import { REVIEW_CLAIM_TTL_MS } from '@/domain/nutritionist-review.policy';
import { lockUserProfile } from './profile-revision.service';

type Db = Prisma.TransactionClient;
type Subject = { userId: string; readyAt?: Date; cycleId?: string };
export type RoutingInfo = { stage: string; opensAt: Date | null; reason: string };
const disabled: RoutingInfo = { stage: 'GENERAL', opensAt: null, reason: 'ROUTING_DISABLED' };

async function audit(
  db: Db,
  actorUserId: string | null,
  action: string,
  entityId: string,
  metadata: Prisma.InputJsonObject
) {
  await db.auditEvent.create({ data: { actorUserId, action, entityType: 'ReviewRouting', entityId, metadata } });
}

async function reviewers(db: Db, now: Date): Promise<RoutingReviewer[]> {
  const cutoff = new Date(now.getTime() - REVIEW_CLAIM_TTL_MS);
  const profiles = await db.nutritionistProfile.findMany({
    include: {
      user: {
        select: {
          role: true,
          isSuspended: true,
          emailVerified: true,
          nutritionistApplicationInvite: { select: { status: true } },
        },
      },
      _count: {
        select: {
          claimedPlans: { where: { status: 'PENDING_REVIEW', claimedAt: { gte: cutoff } } },
          claimedClinicalDocuments: {
            where: { status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] }, claimedAt: { gte: cutoff } },
          },
        },
      },
    },
  });
  const profileClaims = await db.clinicalProfileReview.groupBy({
    by: ['claimedByNutritionistId'],
    where: { status: 'PENDING', claimedAt: { gte: cutoff }, claimedByNutritionistId: { not: null } },
    _count: true,
  });
  return profiles.map((profile) => ({
    ...profile,
    user: { ...profile.user, nutritionistApplication: profile.user.nutritionistApplicationInvite },
    activeClaims:
      profile._count.claimedPlans +
      profile._count.claimedClinicalDocuments +
      (profileClaims.find((claim) => claim.claimedByNutritionistId === profile.id)?._count ?? 0),
  }));
}

/** A single policy governs case lists, private evidence and every decision path. */
export class ReviewRoutingService {
  static async config(db: Db = prisma) {
    return (
      (await db.reviewRoutingConfig.findUnique({ where: { id: 'global' } })) ?? {
        id: 'global',
        enabled: false,
        enabledAt: null,
      }
    );
  }

  static async setEnabled(actorUserId: string, enabled: boolean) {
    return prisma.$transaction(async (tx) => {
      const admin = await tx.user.findFirst({ where: { id: actorUserId, role: 'ADMIN', isSuspended: false } });
      if (!admin) throw new AppError('Administrator access is required.', 403, 'ADMIN_REQUIRED');
      const prior = await this.config(tx);
      const config = await tx.reviewRoutingConfig.upsert({
        where: { id: 'global' },
        create: { id: 'global', enabled, enabledAt: enabled ? new Date() : null },
        update: { enabled, ...(enabled && !prior.enabled ? { enabledAt: new Date() } : {}) },
      });
      if (!enabled)
        await tx.reviewRoutingEpisode.updateMany({
          where: { stage: 'SPECIALIST' },
          data: { stage: 'GENERAL', reason: 'ROUTING_DISABLED' },
        });
      await audit(tx, actorUserId, 'REVIEW_ROUTING_CONFIGURATION_UPDATED', 'global', { enabled });
      return config;
    });
  }

  static async verifyExpertise(
    actorUserId: string,
    reviewerId: string,
    input: {
      conditions: HealthConditionType[];
      experienceYears: number | null;
      evidence: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const admin = await tx.user.findFirst({ where: { id: actorUserId, role: 'ADMIN', isSuspended: false } });
      if (!admin) throw new AppError('Administrator access is required.', 403, 'ADMIN_REQUIRED');
      const before = await tx.nutritionistProfile.findUniqueOrThrow({ where: { id: reviewerId } });
      const profile = await tx.nutritionistProfile.update({
        where: { id: reviewerId },
        data: {
          verifiedExpertise: [...new Set(input.conditions)],
          verifiedExperienceYears: input.experienceYears,
          expertiseEvidence: input.evidence,
          expertiseVerifiedAt: input.conditions.length ? new Date() : null,
          expertiseVerifiedById: actorUserId,
        },
      });
      await audit(tx, actorUserId, 'RND_EXPERTISE_VERIFIED', reviewerId, {
        before: { conditions: before.verifiedExpertise, experienceYears: before.verifiedExperienceYears },
        after: { conditions: profile.verifiedExpertise, experienceYears: profile.verifiedExperienceYears },
        evidence: input.evidence,
      });
      return {
        id: profile.id,
        verifiedExpertise: profile.verifiedExpertise,
        verifiedExperienceYears: profile.verifiedExperienceYears,
        expertiseVerifiedAt: profile.expertiseVerifiedAt,
      };
    });
  }

  static async setAvailability(userId: string, acceptingReviews: boolean) {
    return prisma.$transaction(async (tx) => {
      const profile = await tx.nutritionistProfile.findUniqueOrThrow({ where: { userId }, include: { user: true } });
      const candidates = await reviewers(tx, new Date());
      const eligible = candidates.find((item) => item.id === profile.id);
      if (!eligible || !eligibleRoutingReviewer(eligible, new Date()))
        throw new AppError('Current RND eligibility is required.', 403, 'NUTRITIONIST_INELIGIBLE');
      await tx.nutritionistProfile.update({ where: { id: profile.id }, data: { acceptingReviews } });
      await audit(tx, userId, 'RND_REVIEW_AVAILABILITY_UPDATED', profile.id, { acceptingReviews });
      return { acceptingReviews };
    });
  }

  private static async notify(db: Db, episode: ReviewRoutingEpisode, pool: RoutingReviewer[], ids?: string[]) {
    const now = new Date();
    const recipients =
      ids ??
      (episode.stage === 'SPECIALIST'
        ? episode.selectedReviewerIds
        : pool.filter((reviewer) => eligibleRoutingReviewer(reviewer, now)).map((reviewer) => reviewer.id));
    const profiles = recipients.length
      ? await db.nutritionistProfile.findMany({
          where: { id: { in: recipients } },
          select: { userId: true },
        })
      : [];
    if (profiles.length)
      await db.notification.createMany({
        data: profiles.map(({ userId }) => ({
          userId,
          type: 'REVIEW_REQUEST',
          title:
            episode.stage === 'SPECIALIST' ? 'Matching specialist review available' : 'Review opened to eligible RNDs',
          message: 'New work is available in your review queues. Open KAINARA to view the work you can access.',
        })),
      });
  }

  private static async resolveInTransaction(subject: Subject, tx: Db) {
    const config = await this.config(tx);
    if (!config.enabled || !config.enabledAt) return null;
    await lockUserProfile(tx, subject.userId);
    const user = await tx.user.findUnique({
      where: { id: subject.userId },
      include: {
        userProfile: true,
        healthConditions: true,
        allergies: true,
        safetyProfileEntries: true,
        clinicalContextResponses: true,
      },
    });
    if (!user?.userProfile || user.role !== 'USER') throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    const now = new Date();
    const profile = user.userProfile;
    const safety = adaptUserSafetyRestrictions({
      safetyEntries: user.safetyProfileEntries,
      healthConditions: user.healthConditions.map((item) => item.condition),
      allergies: user.allergies.map((item) => item.allergen),
      otherConditions: profile.otherConditions,
      otherAllergies: profile.otherAllergies,
    });
    const conditions = [...new Set(safety.conditions)].filter((condition) => condition !== 'NONE').sort();
    const scopeKey = createHash('sha256')
      .update(
        JSON.stringify({
          safetyRevision: profile.safetyRevision,
          restrictions: safety.evaluationRestrictions,
          contexts: user.clinicalContextResponses.map((item) => [item.area, item.revision]).sort(),
        })
      )
      .digest('hex');
    const profileKey = `PROFILE:${user.id}:${profile.safetyRevision}`;
    const cycle = subject.cycleId
      ? await tx.mealPlanCycle.findFirst({
          where: { id: subject.cycleId, userId: user.id },
          include: { reviewRoutingEpisode: true },
        })
      : null;
    if (subject.cycleId && !cycle) throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    let episode =
      cycle?.reviewRoutingEpisode ?? (await tx.reviewRoutingEpisode.findUnique({ where: { episodeKey: profileKey } }));
    if (!episode) {
      const previousProfileEpisode = await tx.reviewRoutingEpisode.findFirst({
        where: { userId: user.id, episodeKey: { startsWith: `PROFILE:${user.id}:` } },
        orderBy: { beganAt: 'desc' },
      });
      if (previousProfileEpisode && previousProfileEpisode.safetyRevision !== profile.safetyRevision) {
        const pending = await Promise.all([
          tx.clinicalProfileReview.count({ where: { userId: user.id, status: 'PENDING' } }),
          tx.clinicalDocument.count({
            where: { userId: user.id, status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] } },
          }),
          tx.mealPlan.count({ where: { userId: user.id, status: 'PENDING_REVIEW' } }),
        ]);
        // Revising outstanding work reroutes its existing episode, never extending its clock.
        if (pending.some(Boolean))
          episode = await tx.reviewRoutingEpisode.update({
            where: { id: previousProfileEpisode.id },
            data: { episodeKey: profileKey },
          });
      }
    }
    const independentCycle = !!(cycle && episode?.firstCycleId && episode.firstCycleId !== cycle.id);
    // Only the first dependent cycle inherits a profile episode. Later independent cycles get a new clock.
    if (cycle && episode && episode.firstCycleId && episode.firstCycleId !== cycle.id)
      episode = await tx.reviewRoutingEpisode.findUnique({ where: { episodeKey: `CYCLE:${cycle.id}` } });
    const readyAt =
      subject.readyAt ??
      new Date(
        Math.max(
          profile.updatedAt.getTime(),
          user.createdAt.getTime(),
          ...user.clinicalContextResponses.map((item) => item.updatedAt.getTime())
        )
      );
    const beganAt = episode?.beganAt ?? new Date(Math.min(now.getTime(), readyAt.getTime()));
    const pool = await reviewers(tx, now);
    const matches = matchingReviewers(conditions, pool, now);
    const changedScope = episode && episode.scopeKey !== scopeKey;
    const selectedReviewerIds = specialistPool(changedScope ? [] : (episode?.selectedReviewerIds ?? []), matches);
    // Revoking verified expertise or eligibility invalidates a specialist claim.
    // Availability alone must not invalidate a claim that an RND can still finish.
    if (episode?.stage === 'SPECIALIST') {
      const invalidIds = pool
        .filter(
          (reviewer) =>
            !eligibleRoutingReviewer(reviewer, now) ||
            !reviewer.expertiseVerifiedAt ||
            reviewer.verifiedExperienceYears === null ||
            !conditions.every((condition) => reviewer.verifiedExpertise.includes(condition))
        )
        .map((reviewer) => reviewer.id);
      if (invalidIds.length) {
        const owner = { userId: user.id, claimedByNutritionistId: { in: invalidIds } };
        const released = await Promise.all([
          tx.mealPlan.updateMany({
            where: { ...owner, status: 'PENDING_REVIEW' },
            data: { claimedByNutritionistId: null, claimedAt: null },
          }),
          tx.clinicalProfileReview.updateMany({
            where: { ...owner, status: 'PENDING' },
            data: { claimedByNutritionistId: null, claimedAt: null },
          }),
          tx.clinicalDocument.updateMany({
            where: { ...owner, status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] } },
            data: { claimedByNutritionistId: null, claimedAt: null },
          }),
        ]);
        if (released.some((item) => item.count))
          await audit(tx, null, 'SPECIALIST_CLAIMS_REVOKED', episode.id, {
            reviewerIds: invalidIds,
            released: released.reduce((count, item) => count + item.count, 0),
          });
      }
    }

    const deadlines = cycle
      ? [
          cycle.shoppingDeadlineAt,
          ...(
            await tx.mealPlan.findMany({
              where: { planGroupId: cycle.id, status: 'PENDING_REVIEW' },
              select: { scheduledDate: true },
            })
          ).map((meal) => meal.scheduledDate),
        ]
      : [];
    const opensAt = routingOpensAt(beganAt, deadlines, episode?.opensAt);
    const state = routingStage({
      previousStage: episode?.stage,
      legacy: readyAt <= config.enabledAt,
      unknownConditions: safety.customConditions.length > 0,
      conditions,
      selectedReviewerIds,
      opensAt,
      beganAt,
      now,
    });
    const reason = state.reason === 'ALREADY_OPEN' ? episode!.reason : state.reason;
    const data = {
      scopeKey,
      safetyRevision: profile.safetyRevision,
      conditions,
      selectedReviewerIds: state.stage === 'SPECIALIST' ? selectedReviewerIds : [],
      opensAt,
      stage: state.stage,
      reason,
    };
    const before = episode;
    if (!episode)
      episode = await tx.reviewRoutingEpisode.create({
        data: {
          ...data,
          episodeKey: independentCycle ? `CYCLE:${cycle!.id}` : profileKey,
          userId: user.id,
          beganAt,
          firstCycleId: cycle?.id ?? null,
        },
      });
    else if (
      JSON.stringify([episode.scopeKey, episode.stage, episode.selectedReviewerIds, episode.opensAt]) !==
      JSON.stringify([data.scopeKey, data.stage, data.selectedReviewerIds, data.opensAt])
    )
      episode = await tx.reviewRoutingEpisode.update({ where: { id: episode.id }, data });
    if (cycle && cycle.reviewRoutingEpisodeId !== episode.id) {
      await tx.reviewRoutingEpisode.update({ where: { id: episode.id }, data: { firstCycleId: cycle.id } });
      await tx.mealPlanCycle.update({ where: { id: cycle.id }, data: { reviewRoutingEpisodeId: episode.id } });
    }
    if (changedScope) {
      // A material revision must never preserve a claim on the old evidence.
      await tx.mealPlan.updateMany({
        where: { userId: user.id, status: 'PENDING_REVIEW' },
        data: { claimedByNutritionistId: null, claimedAt: null },
      });
      await tx.clinicalProfileReview.updateMany({
        where: { userId: user.id, status: { not: 'APPROVED' } },
        data: { claimedByNutritionistId: null, claimedAt: null },
      });
      await tx.clinicalDocument.updateMany({
        where: { userId: user.id, status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] } },
        data: { claimedByNutritionistId: null, claimedAt: null },
      });
    }
    const changed =
      !before ||
      before.stage !== episode.stage ||
      before.scopeKey !== episode.scopeKey ||
      JSON.stringify(before.selectedReviewerIds) !== JSON.stringify(episode.selectedReviewerIds) ||
      before.opensAt.getTime() !== episode.opensAt.getTime();
    if (changed) {
      await audit(tx, null, 'REVIEW_ROUTING_UPDATED', episode.id, {
        stage: episode.stage,
        reason: episode.reason,
        reviewerIds: episode.selectedReviewerIds,
        beganAt: episode.beganAt.toISOString(),
        opensAt: episode.opensAt.toISOString(),
        scopeChanged: Boolean(changedScope),
      });
      const added = episode.selectedReviewerIds.filter((id) => !before?.selectedReviewerIds.includes(id));
      if (added.length)
        await tx.nutritionistProfile.updateMany({ where: { id: { in: added } }, data: { lastRoutingAssignedAt: now } });
      if (episode.reason !== 'EXISTING_WORK' && (!before || before.stage !== episode.stage || added.length))
        await this.notify(
          tx,
          episode,
          pool,
          before?.stage === 'SPECIALIST' && episode.stage === 'SPECIALIST' ? added : undefined
        );
    }
    return { episode, pool, scopeChanged: Boolean(changedScope) };
  }

  static async resolve(subject: Subject, db?: Db) {
    if (db) return this.resolveInTransaction(subject, db);
    if (!(await this.config()).enabled) return null;
    return prisma.$transaction((tx) => this.resolveInTransaction(subject, tx), { timeout: 20_000 });
  }

  private static allowed(
    result: Awaited<ReturnType<typeof ReviewRoutingService.resolve>>,
    reviewerId: string,
    claim?: { claimedByNutritionistId?: string | null; claimedAt?: Date | null }
  ) {
    if (!result) return true;
    const reviewer = result.pool.find((item) => item.id === reviewerId);
    if (!reviewer || !eligibleRoutingReviewer(reviewer, new Date())) return false;
    if (result.episode.stage === 'GENERAL' || result.episode.selectedReviewerIds.includes(reviewerId)) return true;
    // Availability can change while someone finishes an existing claim. Expertise/eligibility cannot lapse.
    return (
      !result.scopeChanged &&
      claim?.claimedByNutritionistId === reviewerId &&
      !!claim.claimedAt &&
      Date.now() - claim.claimedAt.getTime() < REVIEW_CLAIM_TTL_MS &&
      !!reviewer.expertiseVerifiedAt &&
      result.episode.conditions.every((condition) => reviewer.verifiedExpertise.includes(condition))
    );
  }

  private static info(result: Awaited<ReturnType<typeof ReviewRoutingService.resolve>>): RoutingInfo {
    return result
      ? { stage: result.episode.stage, opensAt: result.episode.opensAt, reason: result.episode.reason }
      : disabled;
  }

  static async filterMeals<
    T extends {
      id: string;
      userId: string;
      planGroupId: string;
      createdAt: Date;
      claimedByNutritionistId?: string | null;
      claimedAt?: Date | null;
    },
  >(meals: T[], reviewerId: string, db?: Db) {
    if (!(await this.config(db)).enabled) return meals.map((meal) => ({ ...meal, routing: disabled }));
    const grouped = new Map<string, Awaited<ReturnType<typeof this.resolve>>>();
    const visible: Array<T & { routing: RoutingInfo }> = [];
    for (const meal of meals) {
      const key = meal.planGroupId;
      if (!grouped.has(key))
        grouped.set(
          key,
          await this.resolve({ userId: meal.userId, cycleId: meal.planGroupId, readyAt: meal.createdAt }, db)
        );
      const result = grouped.get(key)!;
      if (this.allowed(result, reviewerId, meal)) visible.push({ ...meal, routing: this.info(result) });
    }
    return visible;
  }

  static async assertMeal(reviewerId: string, mealId: string, db: Db = prisma) {
    if (!(await this.config(db)).enabled) return disabled;
    const meal = await db.mealPlan.findUnique({
      where: { id: mealId },
      select: {
        id: true,
        userId: true,
        planGroupId: true,
        createdAt: true,
        claimedAt: true,
        claimedByNutritionistId: true,
      },
    });
    if (!meal) throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    const result = await this.resolve(
      { userId: meal.userId, cycleId: meal.planGroupId, readyAt: meal.createdAt },
      db === prisma ? undefined : db
    );
    if (!this.allowed(result, reviewerId, meal)) throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    return this.info(result);
  }

  static async assertProfile(reviewerId: string, userId: string, db: Db = prisma) {
    if (!(await this.config(db)).enabled) return disabled;
    const cutoff = new Date(Date.now() - REVIEW_CLAIM_TTL_MS);
    const claim = await db.clinicalProfileReview.findFirst({
      where: { userId, claimedByNutritionistId: reviewerId, claimedAt: { gte: cutoff }, status: { not: 'APPROVED' } },
      orderBy: { createdAt: 'desc' },
    });
    const documentClaim = claim
      ? null
      : await db.clinicalDocument.findFirst({
          where: {
            userId,
            claimedByNutritionistId: reviewerId,
            claimedAt: { gte: cutoff },
            status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] },
          },
        });
    const result = await this.resolve({ userId }, db === prisma ? undefined : db);
    if (!this.allowed(result, reviewerId, claim ?? documentClaim ?? undefined))
      throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    return this.info(result);
  }

  static async assertDocument(reviewerId: string, documentId: string, db: Db = prisma) {
    if (!(await this.config(db)).enabled) return disabled;
    const document = await db.clinicalDocument.findUnique({
      where: { id: documentId },
      select: { userId: true, createdAt: true, claimedByNutritionistId: true, claimedAt: true },
    });
    if (!document) throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    const result = await this.resolve(
      { userId: document.userId, readyAt: document.createdAt },
      db === prisma ? undefined : db
    );
    if (!this.allowed(result, reviewerId, document)) throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    return this.info(result);
  }

  static async filterProfiles<T extends { userId: string }>(people: T[], reviewerId: string) {
    const visible: Array<T & { routing: RoutingInfo }> = [];
    for (const person of people) {
      try {
        visible.push({ ...person, routing: await this.assertProfile(reviewerId, person.userId) });
      } catch (error) {
        if (!(error instanceof AppError) || error.errorCode !== 'REVIEW_NOT_FOUND') throw error;
      }
    }
    return visible;
  }

  static async adminOverview() {
    const config = await this.config();
    const episodes = await prisma.reviewRoutingEpisode.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        userId: true,
        conditions: true,
        stage: true,
        reason: true,
        beganAt: true,
        opensAt: true,
        selectedReviewerIds: true,
        user: { select: { name: true } },
      },
    });
    return { config, episodes };
  }

  static async sweep() {
    if (!(await this.config()).enabled) return;
    // Dynamic imports avoid cycles with queue services, whose unfiltered reads are internal only.
    const { ClinicalProfileReviewService } = await import('./clinical-profile-review.service');
    const { NutritionistReviewService } = await import('./nutritionist-review.service');
    for (const person of await ClinicalProfileReviewService.queue()) await this.resolve({ userId: person.userId });
    for (const document of await prisma.clinicalDocument.findMany({
      where: { status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] } },
      select: { userId: true, createdAt: true },
    }))
      await this.resolve({ userId: document.userId, readyAt: document.createdAt });
    for (const meal of await NutritionistReviewService.getReviewQueue(undefined, false))
      await this.resolve({ userId: meal.userId, cycleId: meal.intendedCycle.id, readyAt: meal.createdAt });
  }
}

let runningSweep: Promise<void> | null = null;
export function triggerReviewRoutingInBackground() {
  if (runningSweep) return;
  runningSweep = ReviewRoutingService.sweep()
    .catch(() => {
      logger.error('review_routing_sweep_failed');
    })
    .finally(() => {
      runningSweep = null;
    });
}
export async function waitForReviewRouting() {
  await runningSweep;
}
