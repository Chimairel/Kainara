import { Router } from 'express';
import { z } from 'zod';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { asyncHandler } from '@/middleware/errorHandler';
import type { AuthenticatedRequest } from '@/types';
import { MembershipService } from '@/services/membership.service';
import { MealPlanCycleService } from '@/services/meal-plan-cycle.service';
import { AppError } from '@/errors/AppError';
import { membershipCheckoutInput } from '@/domain/membership-checkout.policy';
import { MembershipCheckoutService } from '@/services/membership-checkout.service';
import { memberHistoryRouter } from './membership-history.routes';

const router = Router();
router.use(authenticate, requireRole('USER'));
router.use('/history', memberHistoryRouter);
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
  '/checkout/quote',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = z
      .object({ tier: z.enum(['LIFESTYLE', 'HEALTH']), period: z.enum(['MONTHLY', 'YEARLY']) })
      .strict()
      .safeParse(req.body);
    if (!input.success) throw new AppError('Choose a plan and billing period.', 400, 'INVALID_CHECKOUT_SELECTION');
    res
      .set('Cache-Control', 'private, no-store')
      .json({ success: true, data: await MembershipCheckoutService.quote(req.user!.userId, input.data) });
  })
);
router.post(
  '/checkout/:id/close',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(req.params.id))
      throw new AppError('Checkout not found.', 404, 'CHECKOUT_NOT_FOUND');
    res
      .set('Cache-Control', 'private, no-store')
      .json({ success: true, data: await MembershipCheckoutService.close(req.user!.userId, req.params.id) });
  })
);
router.post(
  '/checkout',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = membershipCheckoutInput.safeParse(req.body);
    if (!input.success)
      throw new AppError(
        'Choose Lifestyle or Health and monthly or yearly billing.',
        400,
        'INVALID_CHECKOUT_SELECTION'
      );
    const data = await MembershipCheckoutService.create(req.user!.userId, input.data);
    res.set('Cache-Control', 'private, no-store').json({ success: true, data });
  })
);
router.get(
  '/checkout/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(req.params.id))
      throw new AppError('Checkout not found.', 404, 'CHECKOUT_NOT_FOUND');
    const data = await MembershipCheckoutService.status(req.user!.userId, req.params.id);
    res.set('Cache-Control', 'private, no-store').json({ success: true, data });
  })
);
export default router;
