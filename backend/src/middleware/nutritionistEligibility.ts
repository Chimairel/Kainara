import { NextFunction, Response } from 'express';
import prisma from '@/lib/prisma';
import { AuthenticatedRequest } from '@/types';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import { credentialAccessState } from '@/domain/nutritionist-license.policy';

export async function requireEligibleNutritionist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication is required.' });
    }

    const account = res.locals.authenticatedAccount as { emailVerified: boolean } | undefined;
    const [profile, user, application] = await Promise.all([
      prisma.nutritionistProfile.findUnique({
        where: { userId: req.user.userId },
        select: { id: true, isVerified: true, prcLicenseExpiry: true },
      }),
      account ??
        prisma.user.findUnique({
          where: { id: req.user.userId },
          select: { emailVerified: true },
        }),
      prisma.nutritionistApplication.findUnique({
        where: { invitedUserId: req.user.userId },
        select: { status: true },
      }),
    ]);

    const state = credentialAccessState(profile, !!user?.emailVerified, application?.status ?? null);
    if (
      !profile ||
      !user?.emailVerified ||
      (application && application.status !== 'ACTIVATED') ||
      !isNutritionistEligibleForReview(profile)
    ) {
      return res.status(403).json({
        success: false,
        error:
          state.reason === 'LICENSE_EXPIRED'
            ? `Your recorded PRC license expired on ${state.expiryDate}. Open your RND profile to submit a renewal or correction.`
            : 'An activated, verified RND credential is required. Check your profile or contact an administrator.',
        errorCode: state.reason === 'LICENSE_EXPIRED' ? 'RND_LICENSE_EXPIRED' : 'RND_CREDENTIAL_REQUIRED',
      });
    }

    req.nutritionistProfileId = profile.id;
    next();
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Unable to verify nutritionist eligibility.'),
    });
  }
}

export default requireEligibleNutritionist;
