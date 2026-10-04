import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '@/types';
import { NutritionistService } from '@/services/nutritionist.service';
import { flagWholeMealAsAdmin } from '@/services/meal-wide-flag.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import validateZodBody from '@/middleware/validateZod';

// Parent admin router authenticates and checks the live ADMIN role.
// Deliberately exposes no certification, release or member case-review actions.
const router = Router();
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, mealType, conditionTag, status, adminDraftsOnly, page, limit } = req.query;
    const data = await NutritionistService.getMealLibraryWithFilters(req.user!.userId, {
      search: search as string,
      mealType: mealType as string,
      conditionTag: conditionTag as string,
      status: status as string,
      adminDraftsOnly: adminDraftsOnly === 'true',
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
router.get('/coverage', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await NutritionistService.getMealLibraryCoverage() });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Recipe coverage could not be loaded.') });
  }
});
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
  validateZodBody(z.object({ reason: z.string().trim().min(10).max(1000) }).strict()),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await flagWholeMealAsAdmin(req.user!.userId, req.params.id, req.body.reason);
      return res.json({ success: true, data });
    } catch (error) {
      const message = sanitizeErrorMessage(error, 'The meal could not be flagged. Please try again.');
      return res.status(message.includes('Only an active') ? 403 : 409).json({ success: false, error: message });
    }
  }
);
export default router;
