import { mealFlagSubmissionSchema } from '@/validation/meal-review.schemas';
import { Router, Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import { NutritionistService } from '@/services/nutritionist.service';
import { flagWholeMealAsAdmin } from '@/services/meal-wide-flag.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import validateZodBody from '@/middleware/validateZod';
import { asyncHandler } from '@/middleware/errorHandler';
import { z } from 'zod';
import { NutritionistAuditService } from '@/services/nutritionist-audit.service';
import { recipeCaseHistoryQuery } from '@/validation/recipe-case-history.schema';

// Parent admin router authenticates and checks the live ADMIN role.
// Certification remains an RND action; quarantine administration uses the separate case router.
const router = Router();
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, mealType, conditionTag, status, page, limit } = req.query;
    const data = await NutritionistService.getMealLibraryWithFilters(req.user!.userId, {
      search: search as string,
      mealType: mealType as string,
      conditionTag: conditionTag as string,
      status: status as string,
      verifiedByMe: false,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Meal library could not be loaded.') });
  }
});
router.get('/:id/case-history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = z.object({ id: z.string().min(1).max(191) }).strict().safeParse(req.params);
  const query = recipeCaseHistoryQuery.safeParse(req.query);
  if (!id.success || !query.success) return res.status(400).json({ success: false, error: 'Check the meal and approval history filters.' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ success: true, data: await NutritionistAuditService.recipeCases(id.data.id, query.data.page, undefined, query.data.approvalsOnly === 'true', query.data.condition) });
}));
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await NutritionistService.getLibraryMeal(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Meal not found.' });
    return res.json({ success: true, data });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Meal details could not be loaded.') });
  }
});
router.post(
  '/:id/flag',
  validateZodBody(mealFlagSubmissionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await flagWholeMealAsAdmin(req.user!.userId, req.params.id, req.body);
      return res.json({ success: true, data });
    } catch (error) {
      const message = sanitizeErrorMessage(error, 'The meal could not be flagged. Please try again.');
      return res.status(message.includes('Only an active') ? 403 : 409).json({ success: false, error: message });
    }
  }
);
export default router;
