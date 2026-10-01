import { asyncHandler } from './errorHandler';
import { MembershipService } from '@/services/membership.service';
import type { AuthenticatedRequest } from '@/types';

export const requireMembership = asyncHandler(async (req: AuthenticatedRequest, _res, next) => {
  await MembershipService.assertEnhanced(req.user!.userId);
  next();
});
