import prisma from '@/lib/prisma';
import { MealBaseVerificationService } from '@/services/meal-base-verification.service';
import { ClinicalProfileReviewService } from '@/services/clinical-profile-review.service';
import { NutritionistService } from '@/services/nutritionist.service';

/** Counts the work shown in review workspaces and the separate Audit page. */
export class NutritionistWorkCountsService {
  static async get(nutritionistProfileId: string) {
    const countsPromise = Promise.all([
      MealBaseVerificationService.count(),
      NutritionistService.getReviewQueueCount(nutritionistProfileId),
      ClinicalProfileReviewService.queue(),
      prisma.clinicalDocument.count({ where: { status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] } } }),
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
      prisma.mealPlan.count({ where: { status: 'DISPUTED' } }),
    ]);
    const [
      [mealVerifications, caseReviews, profiles, documents, outside, dueAudit, dueProfileApprovals],
      [disputes, disputedPlans],
    ] = await Promise.all([countsPromise, disputesPromise]);
    return {
      meal: mealVerifications,
      case: caseReviews + outside + disputes + disputedPlans,
      profile: profiles.length + documents,
      audit: dueAudit + dueProfileApprovals,
    };
  }
}
