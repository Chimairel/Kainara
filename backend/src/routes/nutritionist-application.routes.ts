import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '@/errors/AppError';
import { asyncHandler } from '@/middleware/errorHandler';
import { ApplicationEmailVerificationService } from '@/services/application-email-verification.service';
import { verificationAttemptLimiter, verificationResendLimiter } from '@/middleware/rateLimiter';
import { validateZodBody } from '@/middleware/validateZod';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import NutritionistApplicationService from '@/services/nutritionist-application.service';
import {
  applicationStatusLookupSchema,
  applicationLicenseLookupSchema,
  nutritionistApplicationSchema,
  nutritionistInvitationAcceptanceSchema,
} from '@/validation/nutritionist-application.schemas';
import {
  applicationStatusLimiter,
  professionalApplicationLimiter,
  applicationStatusReadLimiter,
  applicationLicenseLimiter,
} from '@/middleware/rateLimiter';

const router = Router();
const applicantEmail = z.string().trim().toLowerCase().max(254).email();
router.post(
  '/email/send',
  verificationResendLimiter,
  validateZodBody(z.object({ email: applicantEmail }).strict()),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await ApplicationEmailVerificationService.send(req.body.email) });
  })
);
router.post(
  '/email/verify',
  verificationAttemptLimiter,
  validateZodBody(z.object({ email: applicantEmail, code: z.string().regex(/^\d{6}$/) }).strict()),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await ApplicationEmailVerificationService.verify(req.body.email, req.body.code) });
  })
);

router.post(
  '/',
  professionalApplicationLimiter,
  validateZodBody(nutritionistApplicationSchema),
  async (req: Request, res: Response) => {
    try {
      const data = await NutritionistApplicationService.submit(req.body);
      return res.status(201).json({ success: true, data });
    } catch (error: unknown) {
      return res.status(error instanceof AppError ? error.statusCode : 400).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to submit nutritionist application.'),
        errorCode: error instanceof AppError ? error.errorCode : 'APPLICATION_SUBMISSION_FAILED',
      });
    }
  }
);

router.post(
  '/license-availability',
  applicationLicenseLimiter,
  validateZodBody(applicationLicenseLookupSchema),
  async (req: Request, res: Response) => {
    try {
      const data = await NutritionistApplicationService.checkLicenseAvailability(req.body.prcLicenseNumber);
      return res.json({ success: true, data });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: 'License availability could not be checked. Please try again.' });
    }
  }
);

router.post(
  '/status',
  applicationStatusReadLimiter,
  applicationStatusLimiter,
  validateZodBody(applicationStatusLookupSchema),
  async (req: Request, res: Response) => {
    try {
      const data = await NutritionistApplicationService.getPublicStatus(req.body.referenceCode, req.body.email);
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(404).json({ success: false, error: sanitizeErrorMessage(error, 'Application not found.') });
    }
  }
);

router.post(
  '/activate',
  validateZodBody(nutritionistInvitationAcceptanceSchema),
  async (req: Request, res: Response) => {
    try {
      const data = await NutritionistApplicationService.acceptInvitation(req.body.token, req.body.password);
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res
        .status(400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to activate nutritionist account.') });
    }
  }
);

export default router;
