import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '@/types';
import { StaffAuditService } from '@/services/staff-audit.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import { AuditDetailsService } from '@/services/audit-details.service';
import { AppError } from '@/errors/AppError';
import { AdminReviewContextService } from '@/services/admin-review-context.service';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });
const querySchema = z
  .object({
    view: z.enum(['admin', 'nutritionist']).default('admin'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    actor: z.string().trim().max(200).optional(),
    action: z.string().trim().max(80).optional(),
    from: date.optional(),
    to: date.optional(),
    mine: z.enum(['true', 'false']).optional(),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to);
const router = Router();
router.get('/:id/review-context/documents/:documentId/file', async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (
    !z
      .object({ id: z.string().min(1).max(191), documentId: z.string().min(1).max(191) })
      .strict()
      .safeParse(req.params).success ||
    Object.keys(req.query).length
  )
    return res.status(400).json({ success: false, error: 'Supply one related case record and document.' });
  try {
    const file = await AdminReviewContextService.file(req.user!.userId, req.params.id, req.params.documentId);
    res.attachment('clinical-evidence');
    res.type(file.mimeType);
    return res.send(file.buffer);
  } catch (error) {
    if (!(error instanceof AppError))
      logger.error('admin_review_file_failed', {
        requestId: res.locals.requestId,
        databaseCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
      });
    return res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      error: error instanceof AppError ? error.message : 'Related clinical evidence could not be loaded.',
    });
  }
});
router.get('/:id/review-context', async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!z.string().min(1).max(191).safeParse(req.params.id).success || Object.keys(req.query).length)
    return res
      .status(400)
      .json({ success: false, error: 'Supply one audit case record; member selectors are not allowed.' });
  try {
    return res.json({ success: true, data: await AdminReviewContextService.detail(req.user!.userId, req.params.id) });
  } catch (error) {
    if (!(error instanceof AppError))
      logger.error('admin_review_context_failed', {
        requestId: res.locals.requestId,
        databaseCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
      });
    return res
      .status(error instanceof AppError ? error.statusCode : 500)
      .json({ success: false, error: error instanceof AppError ? error.message : 'Case details could not be loaded.' });
  }
});
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success)
    return res.status(400).json({ success: false, error: 'Check the audit filters and date range.' });
  try {
    const { mine, ...filters } = parsed.data;
    const data = await StaffAuditService.history({
      ...filters,
      actorId: mine === 'true' ? req.user!.userId : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Audit history could not be loaded. Please try again.'),
    });
  }
});
router.get('/:id/related', async (req: AuthenticatedRequest, res: Response) => {
  const id = z.string().min(1).max(200).safeParse(req.params.id);
  const query = z
    .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
    .strict()
    .safeParse(req.query);
  if (!id.success || !query.success)
    return res.status(400).json({ success: false, error: 'Invalid audit record or page.' });
  try {
    const data = await StaffAuditService.history({ view: 'admin', relatedTo: id.data, page: query.data.page });
    return res.json({ success: true, data });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Related activity could not be loaded.') });
  }
});
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = z.string().min(1).max(200).safeParse(req.params.id);
  if (!id.success || Object.keys(req.query).length)
    return res.status(400).json({ success: false, error: 'Invalid audit record.' });
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    return res.json({ success: true, data: await AuditDetailsService.detail(id.data, 'admin') });
  } catch (error) {
    return res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      error: error instanceof AppError ? error.message : 'Audit details could not be loaded. Please try again.',
    });
  }
});
export default router;
