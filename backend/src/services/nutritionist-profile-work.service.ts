import { ReviewRoutingService } from './review-routing.service';
import { Role } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { userInclude, type ProfileRead } from './clinical-profile-review.context';

/** One person can have a profile decision, document decisions, or both. */
export class NutritionistProfileWorkService {
  static async queue(reviewerId?: string, userId?: string, read?: ProfileRead) {
    const [profiles, documents] = await Promise.all([
      ClinicalProfileReviewService.queue(undefined, userId, read),
      // The legacy document queue returns only its first 100 records. This
      // lightweight query must include every pending task before grouping.
      prisma.clinicalDocument.findMany({
        where: {
          ...(userId ? { userId } : {}),
          status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] },
          user: { role: Role.USER },
        },
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true,
              healthConditions: { select: { condition: true } },
              allergies: { select: { allergen: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const people = new Map<
      string,
      {
        userId: string;
        name: string;
        conditions: string[];
        allergies: string[];
        profileStatus: string | null;
        documentCount: number;
        documentIds: string[];
      }
    >();
    for (const profile of profiles)
      people.set(profile.userId, {
        userId: profile.userId,
        name: profile.name,
        conditions: profile.conditions,
        allergies: profile.allergies,
        profileStatus: profile.status,
        documentCount: 0,
        documentIds: [],
      });
    for (const document of documents) {
      const person = people.get(document.user.id) ?? {
        userId: document.user.id,
        name: document.user.name,
        conditions: document.user.healthConditions.map((item) => item.condition),
        allergies: document.user.allergies.map((item) => item.allergen),
        profileStatus: null,
        documentCount: 0,
        documentIds: [] as string[],
      };
      person.documentCount += 1;
      person.documentIds.push(document.id);
      people.set(person.userId, person);
    }
    const result = [...people.values()];
    return reviewerId ? ReviewRoutingService.filterProfiles(result, reviewerId) : result;
  }

  static async assertQueued(userId: string, reviewerId?: string, read?: ProfileRead) {
    if (reviewerId) await ReviewRoutingService.assertProfile(reviewerId, userId);
    const queued = (await this.queue(undefined, userId, read)).find((person) => person.userId === userId);
    if (!queued) throw new AppError('This person has no profile work awaiting review.', 404, 'PROFILE_WORK_NOT_FOUND');
    return queued;
  }

  static async detail(userId: string, reviewerId?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user || user.role !== Role.USER) throw new AppError('Profile not found.', 404, 'PROFILE_NOT_FOUND');
    const read = { user };
    const queued = await this.assertQueued(userId, reviewerId, read);
    // Share this request's evidence read with its profile panel, without caching
    // across requests or bypassing the panel's reviewer authorization.
    const workspace = ClinicalEvidenceService.workspace(userId, read);
    const [evidence, reports, profileDetail, currentReport] = await Promise.all([
      workspace,
      prisma.nutritionReportVersion.findMany({
        where: { userId },
        orderBy: { version: 'desc' },
        select: {
          id: true,
          version: true,
          generatedAt: true,
          acknowledgedAt: true,
          profileRevision: true,
          profileSnapshot: true,
          content: true,
          policyVersion: true,
        },
      }),
      queued.profileStatus
        ? ClinicalProfileReviewService.detail(userId, reviewerId, workspace, read)
        : Promise.resolve(null),
      prisma.nutritionReport.findUnique({
        where: { userId },
        select: { version: true, isStale: true, profileRevision: true },
      }),
    ]);
    if (!user || user.role !== Role.USER) throw new AppError('Profile not found.', 404, 'PROFILE_NOT_FOUND');
    return {
      userId,
      name: user.name,
      profileStatus: queued.profileStatus,
      currentProfile: {
        revision: user.userProfile?.revision ?? null,
        age: user.userProfile?.age ?? null,
        goal: user.userProfile?.goal ?? null,
        dailyCalorieTarget: user.userProfile?.dailyCalorieTarget ?? null,
        conditions: user.healthConditions.map((item) => item.condition),
        allergies: user.allergies.map((item) => item.allergen),
      },
      activePlanningReportVersion: user.userProfile?.planningReportVersion ?? null,
      profileReview: profileDetail,
      reports: reports.map((report) => ({
        ...report,
        isPlanningReport: report.version === user.userProfile?.planningReportVersion,
        isCurrent:
          report.version === currentReport?.version &&
          !currentReport.isStale &&
          report.profileRevision === currentReport.profileRevision,
      })),
      documents: evidence.documents.map(
        ({ id, area, documentType, status, originalFileName, mimeType, createdAt, latestReview }) => ({
          id,
          area,
          documentType,
          status,
          originalFileName,
          mimeType,
          createdAt,
          latestReview,
          pending: queued.documentIds.includes(id),
        })
      ),
      requirements: evidence.requirements,
      availableAreas: evidence.availableAreas,
    };
  }
}
