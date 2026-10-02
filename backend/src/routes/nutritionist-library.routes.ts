import prisma from '@/lib/prisma';
import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '@/types';
import { NutritionistService } from '@/services/nutritionist.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import { asyncHandler } from '@/middleware/errorHandler';
import validateZodBody from '@/middleware/validateZod';
import { libraryMealEditSchema } from '@/validation/nutritionist.schemas';
import { certifyMealLibrarySafetySchema } from '@/domain/meal-library-safety-review.schema';
import { prepareLibraryNutritionEvidenceSchema } from '@/domain/library-nutrition-evidence.schema';
import {
  prepareLibraryNutritionEvidence,
  searchLibraryCompositionFoods,
} from '@/services/nutritionist-library-nutrition-evidence.service';
import { createRecipeDerivation } from '@/services/recipe-derivation.service';
import { recipeDerivationSchema } from '@/validation/recipe-derivation.schemas';
import { flagWholeMeal, releaseWholeMeal } from '@/services/meal-wide-flag.service';
import {
  flagMealApproval,
  getMealApprovalCaseDetails,
  listDueProfileApprovals,
  listMealApprovals,
  recheckConditionApproval,
  recheckProfileApproval,
} from '@/services/meal-approval-lifecycle.service';

// Mounted only after authentication, role and active PRC eligibility middleware.
const router = Router();
/**
 * GET /api/nutritionist/library
 * Browse the MealLibrary with search, filters, and pagination.
 */
router.get('/library', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, mealType, conditionTag, status, verifiedByMe, adminDraftsOnly, page, limit } = req.query;
    const library = await NutritionistService.getMealLibraryWithFilters(req.user!.userId, {
      search: search as string,
      mealType: mealType as string,
      conditionTag: conditionTag as string,
      status: status as string,
      verifiedByMe: verifiedByMe === 'true',
      adminDraftsOnly: adminDraftsOnly === 'true',
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    return res.status(200).json({ success: true, data: library });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve meal library.') });
  }
});

router.get('/library-coverage', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const coverage = await NutritionistService.getMealLibraryCoverage();
    return res.status(200).json({ success: true, data: coverage });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve meal-library coverage.') });
  }
});

router.get('/library/composition-foods', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const source = req.query.source === 'USDA_FDC' ? 'USDA_FDC' : 'FNRI';
    const foods = await searchLibraryCompositionFoods(String(req.query.search ?? ''), source);
    return res.status(200).json({ success: true, data: foods });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to search food records.') });
  }
});

router.post(
  '/library/:id/nutrition-evidence/prepare',
  validateZodBody(prepareLibraryNutritionEvidenceSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await prepareLibraryNutritionEvidence(req.nutritionistProfileId!, req.params.id, req.body);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      const message = sanitizeErrorMessage(error, 'Failed to prepare nutrition evidence.');
      const status =
        message.includes('conflict') || message.includes('Flagged or archived')
          ? 409
          : message.includes('Only a currently verified')
            ? 403
            : message.includes('not found')
              ? 404
              : 422;
      return res.status(status).json({ success: false, error: message });
    }
  }
);

/**
 * POST /api/nutritionist/library/:id/safety-evidence/certify
 * Certify one exact current evidence revision after strict server validation.
 */
router.post(
  '/library/:id/safety-evidence/certify',
  validateZodBody(certifyMealLibrarySafetySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const meal = await NutritionistService.certifyLibraryMealSafety(
        req.nutritionistProfileId!,
        req.params.id,
        req.body
      );
      return res.status(200).json({ success: true, data: meal });
    } catch (error: any) {
      const message = sanitizeErrorMessage(error, 'Failed to certify meal safety evidence.');
      if (message.includes('revision conflict') || message.includes('Flagged or archived')) {
        return res.status(409).json({ success: false, error: message });
      }
      if (
        message.includes('requires') ||
        message.includes('must be resolved') ||
        message.includes('different nutritionist') ||
        message.includes('general meal verification')
      ) {
        return res.status(422).json({ success: false, error: message });
      }
      if (message.includes('Only a currently verified')) {
        return res.status(403).json({ success: false, error: message });
      }
      if (message.includes('not found')) {
        return res.status(404).json({ success: false, error: message });
      }
      return res.status(500).json({ success: false, error: message });
    }
  }
);

/**
 * GET /api/nutritionist/library/:id
 * Retrieve details of a single library meal.
 */
router.get('/library/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meal = await NutritionistService.getLibraryMeal(req.params.id);
    if (!meal) return res.status(404).json({ success: false, error: 'Meal not found.' });
    return res.status(200).json({ success: true, data: meal });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve library meal details.') });
  }
});

router.get('/library/:id/approvals', async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.status(200).json({ success: true, data: await listMealApprovals(req.params.id) });
  } catch (error) {
    return res.status(404).json({ success: false, error: sanitizeErrorMessage(error, 'Approvals unavailable.') });
  }
});

const mealFlagReasonSchema = z.object({ reason: z.string().trim().min(10).max(1000) }).strict();
const mealFlagReleaseSchema = z.object({ rationale: z.string().trim().min(10).max(1000) }).strict();
router.post(
  '/library/:id/flag',
  validateZodBody(mealFlagReasonSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await flagWholeMeal(req.nutritionistProfileId!, req.params.id, req.body.reason);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(409).json({ success: false, error: sanitizeErrorMessage(error, 'Could not flag meal.') });
    }
  }
);
router.post(
  '/library/:id/release-flag',
  validateZodBody(mealFlagReleaseSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await releaseWholeMeal(req.nutritionistProfileId!, req.params.id, req.body.rationale);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res
        .status(409)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Could not release meal flag.') });
    }
  }
);

router.get(
  '/approval-follow-ups',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await listDueProfileApprovals(req.nutritionistProfileId!) });
  })
);

router.get('/library/:id/approvals/:kind/:approvalId', async (req: AuthenticatedRequest, res: Response) => {
  const kind = req.params.kind;
  if (kind !== 'PROFILE' && kind !== 'CONDITION') {
    return res.status(400).json({ success: false, error: 'Unknown approval type.' });
  }
  try {
    const data = await getMealApprovalCaseDetails({
      mealLibraryId: req.params.id,
      kind,
      approvalId: req.params.approvalId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const message = sanitizeErrorMessage(error, 'Could not load approval details.');
    return res.status(message.includes('not found') ? 404 : 500).json({ success: false, error: message });
  }
});

const scopedFlagSchema = z
  .object({
    kind: z.enum(['PROFILE', 'CONDITION']),
    approvalId: z.string().min(1),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
router.post(
  '/library/:id/approvals/flag',
  validateZodBody(scopedFlagSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await flagMealApproval({
        nutritionistProfileId: req.nutritionistProfileId!,
        mealLibraryId: req.params.id,
        ...req.body,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(409).json({ success: false, error: sanitizeErrorMessage(error, 'Could not flag approval.') });
    }
  }
);

const approvalRecheckSchema = z
  .object({
    kind: z.enum(['PROFILE', 'CONDITION']),
    rationale: z.string().trim().min(10).max(1000),
  })
  .strict();
router.post(
  '/library/:id/approvals/:approvalId/recheck',
  validateZodBody(approvalRecheckSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const input = {
        nutritionistProfileId: req.nutritionistProfileId!,
        mealLibraryId: req.params.id,
        approvalId: req.params.approvalId,
      };
      const data =
        req.body.kind === 'CONDITION'
          ? await recheckConditionApproval({ ...input, rationale: req.body.rationale })
          : await recheckProfileApproval({ ...input, rationale: req.body.rationale });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res
        .status(409)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Could not recheck approval.') });
    }
  }
);

/**
 * PATCH /api/nutritionist/library/:id
 * Legacy mutation endpoint. Published recipes require an immutable new draft.
 */
router.get(
  '/recipe-foods',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const foods =
      search.length >= 2
        ? await prisma.foodItem.findMany({
            where: { source: { in: ['FNRI', 'USDA_FDC'] }, name: { contains: search, mode: 'insensitive' } },
            select: { id: true, name: true, source: true, calories: true, proteinG: true, carbsG: true, fatG: true },
            take: 20,
            orderBy: { name: 'asc' },
          })
        : [];
    res.json({ success: true, data: foods });
  })
);
router.post(
  '/library/:id/derive',
  validateZodBody(recipeDerivationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const meal = await createRecipeDerivation(req.nutritionistProfileId!, req.params.id, req.body);
    res.status(201).json({ success: true, data: meal });
  })
);

router.patch(
  '/library/:id',
  validateZodBody(libraryMealEditSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await NutritionistService.editLibraryMeal(
        req.user!.userId,
        req.user!.role,
        req.params.id,
        req.body
      );
      return res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      return res
        .status(400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to edit library meal.') });
    }
  }
);

/**
 * DELETE /api/nutritionist/library/:id
 * Delete a meal from library (Only original verifier or admin override).
 */
router.delete('/library/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await NutritionistService.deleteLibraryMeal(req.user!.userId, req.user!.role, req.params.id);
    return res.status(200).json({ success: true, message: 'Meal deleted successfully.' });
  } catch (error: any) {
    return res
      .status(400)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to delete library meal.') });
  }
});

export default router;
