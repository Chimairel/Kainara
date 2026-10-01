import { Router } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { asyncHandler } from '@/middleware/errorHandler';
import type { AuthenticatedRequest } from '@/types';
import { MembershipService } from '@/services/membership.service';
import { MealPlanCycleService } from '@/services/meal-plan-cycle.service';
import { AppError } from '@/errors/AppError';

const router = Router();
router.use(authenticate, requireRole('USER'));
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    let data = await MembershipService.view(req.user!.userId);
    if (data.enabled && data.level === 'TRIAL_PENDING') {
      await MealPlanCycleService.getCurrentCycleWithClearance(req.user!.userId);
      data = await MembershipService.view(req.user!.userId);
    }
    res.set('Cache-Control', 'private, no-store').json({ success: true, data });
  })
);
router.post(
  '/checkout',
  asyncHandler(async () => {
    throw new AppError(
      'Purchases are not available yet. Pricing and payment setup are being finalized.',
      503,
      'MEMBERSHIP_PURCHASES_UNAVAILABLE'
    );
  })
);
export default router;
