import { HealthConditionType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { isActiveMealReviewPeriod } from '@/domain/meal-actionability.policy';

type Db = Prisma.TransactionClient;
export type RoutingInfo = { stage: string; opensAt: Date | null; reason: string };
const shared: RoutingInfo = { stage: 'GENERAL', opensAt: null, reason: 'SHARED_POOL' };

async function audit(db: Db, actorUserId: string, action: string, entityId: string, metadata: Prisma.InputJsonObject) {
  await db.auditEvent.create({ data: { actorUserId, action, entityType: 'ReviewRouting', entityId, metadata } });
}

/** Compatibility boundary for retired priority routing. Role/credential/claim checks stay in callers. */
export class ReviewRoutingService {
  static async config(db: Db = prisma) {
    void db;
    // Persisted legacy configuration must never restore expertise or experience restrictions.
    return { id: 'global', enabled: false, enabledAt: null, retired: true };
  }

  static async setEnabled(actorUserId: string, enabled: boolean) {
    const admin = await prisma.user.findFirst({ where: { id: actorUserId, role: 'ADMIN', isSuspended: false } });
    if (!admin) throw new AppError('Administrator access is required.', 403, 'ADMIN_REQUIRED');
    if (enabled)
      throw new AppError(
        'Priority routing has been removed. All eligible RNDs use the shared queue.',
        410,
        'REVIEW_ROUTING_RETIRED'
      );
    return this.config();
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
          expertiseVerifiedAt: input.experienceYears !== null ? new Date() : null,
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

  static async filterMeals<T extends { id: string; userId: string }>(meals: T[], reviewerId: string, db?: Db) {
    void reviewerId;
    void db;
    return meals.map((meal) => ({ ...meal, routing: shared }));
  }

  static async assertMeal(reviewerId: string, mealId: string, db: Db = prisma) {
    void reviewerId;
    const meal = await db.mealPlan.findUnique({
      where: { id: mealId },
      select: {
        scheduledDate: true,
        supersededByMealPlanId: true,
        cycle: { select: { endDate: true, status: true, supersededById: true } },
      },
    });
    if (!meal) throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    if (!isActiveMealReviewPeriod(meal))
      throw new AppError(
        'This meal approval request has expired or belongs to a replaced plan. Refresh the queue to review current meals.',
        409,
        'MEAL_REVIEW_INACTIVE'
      );
    return shared;
  }

  static async assertProfile(reviewerId: string, userId: string, db: Db = prisma) {
    void reviewerId;
    void userId;
    void db;
    return shared;
  }

  static async assertDocument(reviewerId: string, documentId: string, db: Db = prisma) {
    void reviewerId;
    void documentId;
    void db;
    return shared;
  }

  static async filterProfiles<T extends { userId: string }>(people: T[], reviewerId: string) {
    void reviewerId;
    return people.map((person) => ({ ...person, routing: shared }));
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

  /** Retained for historical acceptance scripts; priority episodes are no longer created or enforced. */
  static async resolve(subject: { userId: string; readyAt?: Date; cycleId?: string }, db?: Db) {
    void subject;
    void db;
    return null;
  }

  static async sweep() {}
}
