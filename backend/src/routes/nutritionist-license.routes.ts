import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '@/errors/AppError';
import { asyncHandler } from '@/middleware/errorHandler';
import { validateZodBody, validateZodRequest } from '@/middleware/validateZod';
import { NutritionistLicenseService } from '@/services/nutritionist-license.service';
import {
  LICENSE_DOCUMENT_MAX_BYTES,
  licenseDecisionSchema,
  licenseUpdateSchema,
} from '@/domain/nutritionist-license.policy';
import type { AuthenticatedRequest } from '@/types';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: LICENSE_DOCUMENT_MAX_BYTES, fields: 5, fieldSize: 2000 },
  fileFilter: (_req, file, done) => {
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype))
      return done(new AppError('Choose a PDF, JPG or PNG license document.', 422, 'LICENSE_DOCUMENT_INVALID'));
    done(null, true);
  },
}).single('document');
const limitedUpload: RequestHandler = (req, res, next) =>
  upload(req, res, (error) =>
    next(
      error instanceof multer.MulterError
        ? new AppError('Upload one PDF, JPG or PNG document up to 4 MB.', 413, 'LICENSE_DOCUMENT_TOO_LARGE')
        : error
    )
  );
const limiter = rateLimit({
  windowMs: 60_000,
  max: 6,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.userId ?? ipKeyGenerator(req.ip ?? '127.0.0.1'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Please wait a minute before submitting another license document.' },
});
const paramsSchema = z.object({ id: z.string().min(1).max(200) });
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

/** Mounted after live auth/RBAC, before clinical eligibility on the RND router. */
export function nutritionistLicenseRouter(role: 'ADMIN' | 'NUTRITIONIST') {
  const router = Router();
  router.get(
    '/',
    validateZodRequest({ query: querySchema }),
    asyncHandler(async (request, res) => {
      const req = request as AuthenticatedRequest;
      const query = querySchema.parse(req.query);
      res.json({
        success: true,
        data: await NutritionistLicenseService.list(req.user!.userId, role, query.page, query.status),
      });
    })
  );
  router.get(
    '/:id/document',
    validateZodRequest({ params: paramsSchema }),
    asyncHandler(async (request, res) => {
      const req = request as AuthenticatedRequest;
      const document = await NutritionistLicenseService.document(req.user!.userId, role, req.params.id);
      res.set('Cache-Control', 'private, no-store');
      res.set('X-Content-Type-Options', 'nosniff');
      res.attachment(document.fileName).type(document.mimeType).send(document.buffer);
    })
  );
  if (role === 'NUTRITIONIST')
    router.post(
      '/',
      limiter,
      limitedUpload,
      validateZodBody(licenseUpdateSchema),
      asyncHandler(async (request, res) => {
        const req = request as AuthenticatedRequest;
        if (!req.file) throw new AppError('Choose your current license document.', 422, 'LICENSE_DOCUMENT_REQUIRED');
        res.status(201).json({
          success: true,
          data: await NutritionistLicenseService.submit(
            req.user!.userId,
            licenseUpdateSchema.parse(req.body),
            req.file
          ),
        });
      })
    );
  if (role === 'ADMIN')
    router.post(
      '/:id/decision',
      validateZodRequest({ params: paramsSchema }),
      validateZodBody(licenseDecisionSchema),
      asyncHandler(async (request, res) => {
        const req = request as AuthenticatedRequest;
        const input = licenseDecisionSchema.parse(req.body);
        res.json({
          success: true,
          data: await NutritionistLicenseService.decide(req.user!.userId, req.params.id, input.decision, input.reason),
        });
      })
    );
  return router;
}
