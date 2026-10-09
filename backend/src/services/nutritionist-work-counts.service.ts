import prisma from '@/lib/prisma';
import { getActiveMealReviewPeriodWhere } from '@/domain/meal-actionability.policy';
import { MealBaseVerificationService } from '@/services/meal-base-verification.service';
import { NutritionistProfileWorkService } from '@/services/nutritionist-profile-work.service';
import { NutritionistService } from '@/services/nutritionist.service';

/** Counts the work shown in review workspaces and the separate Audit page. */
export class NutritionistWorkCountsService {
  static async get(nutritionistProfileId: string) {
    const countsPromise = Promise.all([
      MealBaseVerificationService.count(),
      NutritionistService.getReviewQueueCount(nutritionistProfileId),
      NutritionistProfileWorkService.queue(nutritionistProfileId),
      prisma.outsideMealReview.count({
        where: {
          status: { in: ['PENDING', 'CLAIMED'] },
          outsideMealLogItem: { mealLog: { status: 'DONE' } },
        },
      }),
      prisma.mealConditionClearance.count({
        where: {
          state: { in: ['REVIEW_DUE', 'SUSPENDED'] },
        },
      }),
      prisma.mealLibraryProfileApproval.count({
        where: {
          flaggedAt: { not: null },
        },
      }),
    ]);
    const disputesPromise = Promise.all([
      prisma.mealConditionClearance.count({ where: { state: 'DISPUTED' } }),
      prisma.mealPlan.count({ where: { status: 'DISPUTED', ...getActiveMealReviewPeriodWhere() } }),
    ]);
    const [
      [mealVerifications, caseReviews, profiles, outside, dueAudit, dueProfileApprovals],
      [disputes, disputedPlans],
    ] = await Promise.all([countsPromise, disputesPromise]);
    return {
      meal: mealVerifications,
      case: caseReviews + outside + disputes + disputedPlans,
      profile: profiles.reduce((total, person) => total + (person.profileStatus ? 1 : 0) + person.documentCount, 0),
      audit: dueAudit + dueProfileApprovals,
    };
  }
}
