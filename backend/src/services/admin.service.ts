import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { AdminAnalyticsService } from '@/services/admin-analytics.service';
import { normalizePagination, normalizeSearch } from '@/policies/pagination.policy';
import { enforceClearanceCircuitBreakers } from '@/services/condition-clearance.service';

export class AdminService {
  /**
   * Returns all users with pagination and search.
   */
  static async getUsers(page = 1, limit = 20, search?: string) {
    const pagination = normalizePagination(page, limit, 20);
    const normalizedSearch = normalizeSearch(search);
    const where = normalizedSearch
      ? {
          OR: [
            { name: { contains: normalizedSearch, mode: 'insensitive' as const } },
            { email: { contains: normalizedSearch, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          image: true,
          emailVerified: true,
          onboardingDone: true,
          isSuspended: true,
          suspendedAt: true,
          suspensionReason: true,
          createdAt: true,
        },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  /**
   * Returns all nutritionist profiles (pending first).
   */
  static async getNutritionists() {
    return prisma.nutritionistProfile.findMany({
      select: {
        id: true,
        prcLicenseNumber: true,
        prcLicenseExpiry: true,
        specialization: true,
        acceptingReviews: true,
        verifiedExpertise: true,
        verifiedExperienceYears: true,
        expertiseEvidence: true,
        expertiseVerifiedAt: true,
        isVerified: true,
        totalVerified: true,
        verifiedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            isSuspended: true,
            suspensionReason: true,
          },
        },
      },
      orderBy: [{ isVerified: 'asc' }, { userId: 'asc' }],
    });
  }

  /**
   * Verifies a nutritionist by admin.
   */
  static async verifyNutritionist(adminUserId: string, nutritionistProfileId: string) {
    const profile = await prisma.nutritionistProfile.findUnique({
      where: { id: nutritionistProfileId },
    });

    if (!profile) throw new Error('Nutritionist profile not found.');
    if (profile.isVerified) throw new Error('Nutritionist is already verified.');
    if (profile.prcLicenseExpiry < new Date()) {
      throw new Error('An expired PRC license cannot be verified. Update and re-check the credential first.');
    }

    await prisma.$transaction(
      async (tx) => {
        const updated = await tx.nutritionistProfile.updateMany({
          where: { id: nutritionistProfileId, isVerified: false, prcLicenseExpiry: { gte: new Date() } },
          data: { isVerified: true, verifiedByAdminId: adminUserId, verifiedAt: new Date() },
        });
        if (!updated.count) throw new Error('Nutritionist credentials changed. Reload before verifying.');
        await tx.user.update({ where: { id: profile.userId }, data: { role: 'NUTRITIONIST' } });
        await tx.auditEvent.create({
          data: {
            actorUserId: adminUserId,
            action: 'NUTRITIONIST_VERIFIED',
            entityType: 'NutritionistProfile',
            entityId: profile.id,
          },
        });
      },
      { maxWait: 10000, timeout: 30000 }
    );

    return { success: true };
  }

  static async setUserSuspension(adminUserId: string, targetUserId: string, suspended: boolean, reason?: string) {
    if (adminUserId === targetUserId) throw new Error('Administrators cannot suspend their own active account.');
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new Error('User not found.');

    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: {
          isSuspended: suspended,
          suspendedAt: suspended ? new Date() : null,
          suspensionReason: suspended ? reason?.trim() || 'Administrative safety action' : null,
        },
        select: { id: true, isSuspended: true, suspendedAt: true, suspensionReason: true },
      });
      if (suspended) {
        await tx.session.deleteMany({ where: { userId: targetUserId } });
        const professional = await tx.nutritionistProfile.findUnique({
          where: { userId: targetUserId },
          select: { id: true },
        });
        if (professional) {
          const data = { claimedByNutritionistId: null, claimedAt: null };
          await tx.clinicalProfileReview.updateMany({ where: { claimedByNutritionistId: professional.id }, data });
          await tx.clinicalDocument.updateMany({ where: { claimedByNutritionistId: professional.id }, data });
          await tx.mealPlan.updateMany({ where: { claimedByNutritionistId: professional.id }, data });
          await tx.mealBaseVerification.updateMany({ where: { claimedByNutritionistId: professional.id }, data });
          await tx.outsideMealReview.updateMany({
            where: { claimedByNutritionistId: professional.id, status: 'CLAIMED' },
            data: { ...data, claimedRevision: null, status: 'PENDING' },
          });
        }
      }
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: suspended ? 'USER_SUSPENDED' : 'USER_REINSTATED',
          entityType: 'User',
          entityId: targetUserId,
          metadata: { reason: updated.suspensionReason },
        },
      });
      return updated;
    });
    if (suspended && target.role === 'NUTRITIONIST') await enforceClearanceCircuitBreakers();
    return updated;
  }

  static async getAuditEvents(page = 1, limit = 50) {
    const { page: safePage, limit: safeLimit } = normalizePagination(page, limit, 50);
    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: { actorUser: { select: { name: true, email: true, role: true } } },
      }),
      prisma.auditEvent.count(),
    ]);
    return { events, total, page: safePage, totalPages: Math.ceil(total / safeLimit) };
  }

  static async getSafetyIncidents() {
    // A whole-meal flag fans out to every serving. Show one concern with its serving count.
    const rows = await prisma.$queryRaw<Array<{ incident: Prisma.JsonValue }>>(Prisma.sql`
      WITH flags AS (
        SELECT f.*, COALESCE(root."sourceRawRecipeCandidateId", m."sourceRawRecipeCandidateId", m."recipeFamilyId", m.id) AS family,
          COALESCE(root."mealName", m."mealName") AS "mealName", m.status AS "mealStatus",
          m."safetyEvidenceStatus", u.name AS "reviewerName", a.name AS "adminName"
        FROM "MealLibraryFlag" f JOIN "MealLibrary" m ON m.id = f."mealLibraryId"
        LEFT JOIN "MealLibrary" root ON root.id = m."recipeFamilyId"
        LEFT JOIN "NutritionistProfile" n ON n.id = f."flaggedByNutritionistId"
        LEFT JOIN "User" u ON u.id = n."userId" LEFT JOIN "User" a ON a.id = f."flaggedByAdminUserId"
        WHERE f.status = 'PENDING'
      ), grouped AS (
        SELECT *, row_number() OVER concerns AS position, count(*) OVER concerns AS servings
        FROM flags WINDOW concerns AS (PARTITION BY family, "flaggedByNutritionistId", "flaggedByAdminUserId", "createdAt", reason ORDER BY id
          ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
      )
      SELECT jsonb_build_object(
        'id', id, 'reason', reason, 'createdAt', to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'affectedServingCount', servings,
        'mealLibrary', jsonb_build_object('id', "mealLibraryId", 'mealName', "mealName", 'status', "mealStatus", 'safetyEvidenceStatus', "safetyEvidenceStatus"),
        'flaggedByNutritionist', CASE WHEN "flaggedByNutritionistId" IS NOT NULL THEN jsonb_build_object('user', jsonb_build_object('name', "reviewerName")) ELSE NULL END,
        'flaggedByAdminUser', CASE WHEN "flaggedByAdminUserId" IS NOT NULL THEN jsonb_build_object('name', "adminName") ELSE NULL END
      ) AS incident FROM grouped WHERE position = 1 ORDER BY "createdAt", id
    `);
    return rows.map((row) => row.incident);
  }

  static async getStructuredSafetyOperations() {
    const reviewStates = ['RECOGNIZED_UNSUPPORTED', 'NEEDS_CLARIFICATION', 'PENDING_REVIEW', 'INVALID'] as const;
    const [groupedEntries, reviewUsers] = await Promise.all([
      prisma.safetyProfileEntry.groupBy({
        by: ['domain', 'supportState'],
        where: { user: { role: 'USER', isSuspended: false } },
        _count: { _all: true },
        orderBy: [{ domain: 'asc' }, { supportState: 'asc' }],
      }),
      prisma.safetyProfileEntry.findMany({
        where: { supportState: { in: [...reviewStates] }, user: { role: 'USER', isSuspended: false } },
        distinct: ['userId'],
        select: { userId: true },
      }),
    ]);
    return {
      usersRequiringReview: reviewUsers.length,
      entries: groupedEntries.map((row) => ({
        domain: row.domain,
        supportState: row.supportState,
        count: row._count._all,
      })),
    };
  }

  /** Read-only, consistent platform metrics; no lifecycle synchronization writes. */
  static getAnalytics() {
    return AdminAnalyticsService.getSnapshot();
  }
}
