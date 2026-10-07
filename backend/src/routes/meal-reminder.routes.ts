import { Router } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { requireVerifiedUser } from '@/middleware/userPrerequisites';
import validateZodBody from '@/middleware/validateZod';
import { asyncHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/types';
import prisma from '@/lib/prisma';
import { MealReminderService } from '@/services/meal-reminder.service';
import { mealReminderSettingsSchema } from '@/validation/meal-reminder.schemas';

const router = Router();
router.use(authenticate, requireRole('USER'), requireVerifiedUser);
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.json({
      success: true,
      data: await prisma.mealReminderSettings.findUnique({ where: { userId: req.user!.userId } }),
    });
  })
);
router.put(
  '/',
  validateZodBody(mealReminderSettingsSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.json({ success: true, data: await MealReminderService.saveSettings(req.user!.userId, req.body) });
  })
);
export default router;
