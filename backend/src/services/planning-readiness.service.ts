import prisma from '@/lib/prisma';
import { loadUserNutritionContext } from '@/domain/user-nutrition-context';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { determinePlanningReadiness, type PlanningReadiness } from '@/domain/planning-readiness.policy';
import { membershipEnabled } from '@/domain/membership.policy';
import { MembershipService } from './membership.service';

export class PlanningReadinessService {
  static async getForUser(userId: string): Promise<PlanningReadiness> {
    const [requirements, context, profileReviewApproved] = await Promise.all([
      ClinicalEvidenceService.requirementsForUser(userId),
      loadUserNutritionContext(prisma, userId, 'Complete your health profile before requesting a meal plan.'),
      ClinicalProfileReviewService.hasCurrentApproval(userId),
    ]);

    const readiness = determinePlanningReadiness({
      requirements,
      restrictionsRequireReview: context.safetyRestrictions.requiresReview,
      conditions: context.conditions,
      profileReviewApproved,
    });
    if (readiness.canRequestPlan && membershipEnabled()) {
      const membership = await MembershipService.state(userId);
      if (membership.requiresCaseReview && !membership.enhanced)
        return {
          status: 'BLOCKED_MEMBERSHIP',
          canRequestPlan: false,
          title: 'Membership needed for a new case plan',
          message:
            'Your trial has ended. New plans for conditions or allergies require membership. Existing eligible active meals and submitted reviews remain available.',
          actionPath: '/membership',
        };
    }
    return readiness;
  }
}
