import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/lib/jwt';
import { AuthenticatedRequest } from '@/types';
import prisma from '@/lib/prisma';
import { UserProfileService } from '@/services/user-profile.service';

const accountSelect = {
  email: true,
  role: true,
  isSuspended: true,
  emailVerified: true,
  onboardingDone: true,
  tosAccepted: true,
  acceptedTermsVersion: true,
  acceptedPrivacyVersion: true,
} as const;

const userReadinessSelect = {
  ...accountSelect,
  nutritionReport: { select: { acknowledgedAt: true, isStale: true, profileRevision: true } },
  userProfile: { select: { revision: true, planningReportVersion: true } },
} as const;

/**
 * Express middleware to verify the access token from the Authorization header.
 * Attaches the decoded payload to req.user.
 */
const authenticateRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  includeProfile: boolean
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token is required. Format: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token using JWT helper
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired authentication session.' });
    }

    const currentUser = includeProfile
      ? await UserProfileService.getAuthenticatedProfileDetails(decoded.userId)
      : decoded.role === 'USER'
        ? await prisma.user.findUnique({ where: { id: decoded.userId }, select: userReadinessSelect })
        : await prisma.user.findUnique({ where: { id: decoded.userId }, select: accountSelect });
    if (!currentUser || currentUser.isSuspended) {
      return res.status(401).json({
        success: false,
        error: currentUser?.isSuspended ? 'This account has been suspended.' : 'User session not found.',
      });
    }

    req.user = {
      userId: decoded.userId,
      email: currentUser.email,
      role: currentUser.role,
    };

    if (includeProfile && currentUser && 'profile' in currentUser) {
      res.locals.authenticatedProfile = currentUser.profile;
    } else if (!includeProfile) {
      // A request-local snapshot only: every new request still checks the live
      // account, and prerequisite middleware can reuse this same database read.
      res.locals.authenticatedAccount = currentUser;
    }

    next();
  } catch {
    return res.status(503).json({
      success: false,
      error: 'Session verification is temporarily unavailable. Please try again.',
    });
  }
};

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  authenticateRequest(req, res, next, false);

export const authenticateProfile = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  authenticateRequest(req, res, next, true);

export default authenticate;
