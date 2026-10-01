import { NextFunction, Response } from 'express';
import prisma from '@/lib/prisma';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { membershipEnabled } from '@/domain/membership.policy';
import { AuthenticatedRequest } from '@/types';
import { hasCurrentConsent } from '@/domain/onboarding.policy';

interface UserPrerequisiteOptions {
  emailVerified?: boolean;
  onboardingDone?: boolean;
  currentConsent?: boolean;
  reportAcknowledged?: boolean;
}

export const requireUserPrerequisites =
  (options: UserPrerequisiteOptions) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication is required.' });
      }

      const authenticatedAccount = res.locals.authenticatedAccount as
        | {
            emailVerified: boolean;
            onboardingDone: boolean;
            tosAccepted: boolean;
            acceptedTermsVersion: string | null;
            acceptedPrivacyVersion: string | null;
            nutritionReport?: { acknowledgedAt: Date | null; isStale: boolean; profileRevision: number } | null;
            userProfile?: { revision: number; planningReportVersion?: number | null } | null;
          }
        | undefined;
      const user =
        authenticatedAccount &&
        (!options.reportAcknowledged ||
          ('nutritionReport' in authenticatedAccount && 'userProfile' in authenticatedAccount))
          ? authenticatedAccount
          : await prisma.user.findUnique({
              where: { id: userId },
              select: {
                emailVerified: true,
                onboardingDone: true,
                tosAccepted: true,
                acceptedTermsVersion: true,
                acceptedPrivacyVersion: true,
                nutritionReport: { select: { acknowledgedAt: true, isStale: true, profileRevision: true } },
                userProfile: { select: { revision: true, planningReportVersion: true } },
              },
            });

      if (!user) {
        return res.status(401).json({ success: false, error: 'Authenticated account no longer exists.' });
      }
      if (options.emailVerified && !user.emailVerified) {
        return res.status(403).json({
          success: false,
          error: 'Verify your email before continuing.',
          errorCode: 'EMAIL_VERIFICATION_REQUIRED',
        });
      }
      if (options.onboardingDone && !user.onboardingDone) {
        return res.status(409).json({
          success: false,
          error: 'Complete onboarding before using this feature.',
          errorCode: 'ONBOARDING_REQUIRED',
        });
      }
      if (options.currentConsent && !hasCurrentConsent(user)) {
        return res.status(403).json({
          success: false,
          error: 'Accept the current terms and privacy notice before continuing.',
          errorCode: 'CURRENT_CONSENT_REQUIRED',
        });
      }
      let activePlanningReport = false;
      const validatePlanningBaseline = Boolean(membershipEnabled() || user.userProfile?.planningReportVersion);
      if (options.reportAcknowledged && validatePlanningBaseline) {
        try {
          await loadPlanningNutritionContext(prisma, userId, 'Profile missing.');
          activePlanningReport = true;
        } catch {
          /* Return the prerequisite error below without bypassing other gates. */
        }
      }
      if (
        options.reportAcknowledged &&
        (validatePlanningBaseline
          ? !activePlanningReport
          : !user.nutritionReport?.acknowledgedAt ||
            user.nutritionReport.isStale ||
            user.nutritionReport.profileRevision !== user.userProfile?.revision)
      ) {
        return res.status(409).json({
          success: false,
          error: 'Use a current nutrition report for meal planning before using this feature.',
          errorCode: 'REPORT_ACKNOWLEDGEMENT_REQUIRED',
        });
      }

      next();
    } catch {
      return res.status(500).json({ success: false, error: 'Unable to verify account prerequisites.' });
    }
  };

export const requireVerifiedUser = requireUserPrerequisites({ emailVerified: true });
export const requireReadyUser = requireUserPrerequisites({
  emailVerified: true,
  onboardingDone: true,
  currentConsent: true,
  reportAcknowledged: true,
});
