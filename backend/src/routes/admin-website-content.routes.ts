import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { WebsiteContentService } from '@/services/website-content.service';
import {
  landingMimeTypes,
  LANDING_VIDEO_BYTES,
  landingRevisionSchema,
  landingTextSchema,
  landingUploadSchema,
} from '@/domain/landing-media.policy';
import { AppError } from '@/errors/AppError';
import type { AuthenticatedRequest } from '@/types';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: LANDING_VIDEO_BYTES, fields: 2, fieldSize: 100 },
  fileFilter: (_req, file, callback) => {
    if (!landingMimeTypes.includes(file.mimetype))
      return callback(new AppError('Choose JPG, PNG, WebP, AVIF, MP4, or WebM.', 400, 'INVALID_LANDING_UPLOAD'));
    callback(null, true);
  },
}).single('file');
const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Please wait a minute before uploading more media.' },
});

function fail(res: Response, error: unknown) {
  if (error instanceof AppError)
    return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
  if (error instanceof multer.MulterError)
    return res
      .status(400)
      .json({ success: false, error: 'Upload one file up to 20 MB. Images must be no larger than 5 MB.' });
  return res.status(503).json({ success: false, error: 'Website media is temporarily unavailable. Please try again.' });
}
function body<S extends { safeParse: (body: unknown) => { success: boolean; data?: unknown } }>(
  schema: S,
  req: Request
) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    throw new AppError(
      'Check the media description and reload the content before saving.',
      400,
      'INVALID_WEBSITE_CONTENT'
    );
  return parsed.data;
}
router.get('/', async (_req, res) => {
  try {
    return res.json({ success: true, data: await WebsiteContentService.getAdmin() });
  } catch (error) {
    return fail(res, error);
  }
});
router.post('/upload', uploadLimiter, (req: AuthenticatedRequest, res) => {
  upload(req, res, async (error) => {
    if (error) return fail(res, error);
    try {
      const parsed = landingUploadSchema.parse(body(landingUploadSchema, req));
      if (!req.file) throw new AppError('Choose an image or video first.', 400, 'LANDING_FILE_MISSING');
      return res.status(201).json({
        success: true,
        data: await WebsiteContentService.upload(req.user!.userId, parsed.revision, parsed.slot, req.file),
      });
    } catch (err) {
      return fail(res, err);
    }
  });
});
router.patch('/draft', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = landingTextSchema.parse(body(landingTextSchema, req));
    return res.json({
      success: true,
      data: await WebsiteContentService.saveText(req.user!.userId, parsed.revision, parsed.altText),
    });
  } catch (error) {
    return fail(res, error);
  }
});
for (const action of ['publish', 'reset'] as const) {
  router.post(`/${action}`, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = landingRevisionSchema.parse(body(landingRevisionSchema, req));
      return res.json({ success: true, data: await WebsiteContentService[action](req.user!.userId, parsed.revision) });
    } catch (error) {
      return fail(res, error);
    }
  });
}
export default router;
