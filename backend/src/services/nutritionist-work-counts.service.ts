import prisma from '@/lib/prisma';
import { MealBaseVerificationService } from '@/services/meal-base-verification.service';
import { ClinicalProfileReviewService } from '@/services/clinical-profile-review.service';
import { NutritionistService } from '@/services/nutritionist.service';

/** Counts the work shown in the three review workspaces, without returning patient or recipe details. */
export class NutritionistWorkCountsService {
  static async get(nutritionistProfileId: string) {
    const now = new Date();
    const reviewer = await prisma.nutritionistProfile.findUniqueOrThrow({
      where: { id: nutritionistProfileId }, select: { canLeadReview: true },
    });
    const [mealVerifications, caseReviews, profiles, documents, outside, dueAudit, disputes, disputedPlans] =
      await Promise.all([
        MealBaseVerificationService.count(),
        NutritionistService.getReviewQueueCount(nutritionistProfileId),
        ClinicalProfileReviewService.queue(),
        prisma.clinicalDocument.count({ where: { status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] } } }),
        prisma.outsideMealReview.count({ where: {
          status: { in: ['PENDING', 'CLAIMED'] }, outsideMealLogItem: { mealLog: { status: 'DONE' } },
        } }),
        prisma.mealConditionClearance.count({ where: {
          OR: [{ state: { in: ['REVIEW_DUE', 'SUSPENDED'] } }, { state: 'ACTIVE', auditDueAt: { lte: now } }],
        } }),
        reviewer.canLeadReview ? prisma.mealConditionClearance.count({ where: { state: 'DISPUTED' } }) : Promise.resolve(0),
        reviewer.canLeadReview ? prisma.mealPlan.count({ where: { status: 'DISPUTED' } }) : Promise.resolve(0),
      ]);
    return {
      meal: mealVerifications,
      case: caseReviews + outside + dueAudit + disputes + disputedPlans,
      profile: profiles.length + documents,
    };
  }
}
