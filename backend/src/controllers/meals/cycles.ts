import { GroceryService } from '@/services/grocery.service';

import { MealPlanCycleService } from '@/services/meal-plan-cycle.service';

import { UpcomingPlanPreparationService } from '@/services/upcoming-plan-preparation.service';
import { AuthenticatedRequest } from '@/types';

import { Response } from 'express';

/** GET /api/user/meals/cycles — authoritative current/upcoming identities. */
export async function getPlanCycles(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
    res.once('finish', () => UpcomingPlanPreparationService.triggerNonBlocking(userId));
    const cycles = await MealPlanCycleService.getCurrentAndUpcoming(userId);
    return res.status(200).json({ success: true, data: cycles });
  } catch (error) {
    console.error('[MealsController] getPlanCycles error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve plan cycles.' });
  }
}

/** POST /api/user/meals/cycles/:cycleId/acknowledge-incomplete */
export async function acknowledgeIncompleteCycle(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
    // Materialize the confirmed subset before acknowledgment freezes it.
    // A zero-slot cycle may still be acknowledged, but has no actionable
    // grocery rows until at least one slot is cleared.
    try {
      await GroceryService.generateGroceryList(userId, undefined, req.params.cycleId);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('No approved meals')) throw error;
    }
    const cycle = await MealPlanCycleService.acknowledgeIncompleteCycle(userId, req.params.cycleId);
    return res.status(200).json({ success: true, data: cycle });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to acknowledge the incomplete cycle.';
    return res.status(400).json({ success: false, error: message });
  }
}

/** POST /api/user/meals/cycles/:cycleId/start-shopping */
export async function startShopping(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
    const cycle = await MealPlanCycleService.startShopping(userId, req.params.cycleId);
    return res.status(200).json({ success: true, data: cycle });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start shopping.';
    return res.status(400).json({ success: false, error: message });
  }
}
