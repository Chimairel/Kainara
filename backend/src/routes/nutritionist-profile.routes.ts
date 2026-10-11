import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { validateZodBody } from '@/middleware/validateZod';
import { NutritionistProfileService } from '@/services/nutritionist-profile.service';
import type { AuthenticatedRequest } from '@/types';

const router = Router();
// Own biography/profile reads are maintenance, not authorization to review meals.
router.get(
  '/',
  asyncHandler(async (request, res) => {
    const req = request as AuthenticatedRequest;
    res.json({ success: true, data: await NutritionistProfileService.getProfile(req.user!.userId) });
  })
);
const profileInput = z
  .object({ bio: z.string().trim().max(5000).optional(), specialization: z.string().trim().max(200).optional() })
  .strict();
router.patch(
  '/',
  validateZodBody(profileInput),
  asyncHandler(async (request, res) => {
    const req = request as AuthenticatedRequest;
    res.json({
      success: true,
      data: await NutritionistProfileService.updateProfile(req.user!.userId, profileInput.parse(req.body)),
    });
  })
);
export default router;
