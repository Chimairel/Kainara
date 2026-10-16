import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { validateZodRequest } from '@/middleware/validateZod';
import type { AuthenticatedRequest } from '@/types';
import { PatientNutritionLimitService } from '@/services/patient-nutrition-limit.service';
import { patientNutritionLimitSchema } from '@/validation/patient-nutrition-limit.schemas';
const router = Router();
const params = z.object({ mealId: z.string().min(1).max(100) });
router.get('/:mealId/limits', validateZodRequest({ params }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await PatientNutritionLimitService.list((req as AuthenticatedRequest).nutritionistProfileId!, req.params.mealId) });
}));
router.post('/:mealId/limits', validateZodRequest({ params, body: patientNutritionLimitSchema }), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await PatientNutritionLimitService.save((req as AuthenticatedRequest).nutritionistProfileId!, req.params.mealId, req.body) });
}));
router.post('/:mealId/limits/:limitId/revoke', validateZodRequest({ params: params.extend({ limitId: z.string().min(1).max(100) }), body: z.object({ reason: z.string().trim().min(10).max(1000) }).strict() }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await PatientNutritionLimitService.revoke((req as AuthenticatedRequest).nutritionistProfileId!, req.params.mealId, req.params.limitId, req.body.reason) });
}));
export default router;
