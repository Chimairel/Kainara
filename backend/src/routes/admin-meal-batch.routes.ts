import { Router, type Response } from 'express';
import { z } from 'zod';
import { AppError } from '@/errors/AppError';
import type { AuthenticatedRequest } from '@/types';
import validateZodBody from '@/middleware/validateZod';
import { AdminMealBatchService } from '@/services/admin-meal-batch.service';

const router = Router();
const respond =
  (handler: (req: AuthenticatedRequest) => Promise<unknown>) => async (req: AuthenticatedRequest, res: Response) => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      return res.json({ success: true, data: await handler(req) });
    } catch (error) {
      return res.status(error instanceof AppError ? error.statusCode : 500).json({
        success: false,
        error: error instanceof AppError ? error.message : 'Batch operation failed. No partial import was committed.',
        errorCode: error instanceof AppError ? error.errorCode : 'INTERNAL_ERROR',
        details: error instanceof AppError ? error.details : undefined,
      });
    }
  };
router.get(
  '/template',
  respond(async () => AdminMealBatchService.template())
);
router.post(
  '/export',
  validateZodBody(z.object({ ids: z.array(z.string().min(1).max(191)).min(1).max(100) }).strict()),
  respond((req) => AdminMealBatchService.export(req.body.ids))
);
router.post(
  '/preview',
  respond((req) => AdminMealBatchService.preview(req.user!.userId, req.body))
);
router.post(
  '/import',
  validateZodBody(z.object({ previewId: z.string().min(1).max(191) }).strict()),
  respond((req) => AdminMealBatchService.import(req.user!.userId, req.body.previewId))
);
export default router;
