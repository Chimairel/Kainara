import { Role } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';

/** One person can have a profile decision, document decisions, or both. */
export class NutritionistProfileWorkService {
  static async queue() {
    const [profiles, documents] = await Promise.all([
      ClinicalProfileReviewService.queue(),
      // The legacy document queue returns only its first 100 records. This
      // lightweight query must include every pending task before grouping.
      prisma.clinicalDocument.findMany({
        where: { status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] }, user: { role: Role.USER } },
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
    return [...people.values()];
  }

  static async assertQueued(userId: string) {
    const queued = (await this.queue()).find((person) => person.userId === userId);
    if (!queued) throw new AppError('This person has no profile work awaiting review.', 404, 'PROFILE_WORK_NOT_FOUND');
    return queued;
  }

  static async detail(userId: string, reviewerId?: string) {
    const queued = await this.assertQueued(userId);
    const [user, evidence, reports, profileDetail, currentReport] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          userProfile: true,
          healthConditions: true,
          allergies: true,
        },
      }),
      ClinicalEvidenceService.workspace(userId),
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
      queued.profileStatus ? ClinicalProfileReviewService.detail(userId, reviewerId) : Promise.resolve(null),
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
