import { z } from 'zod';
import type { UploadApiResponse } from 'cloudinary';
import { AppError } from '@/errors/AppError';

export const LANDING_CONTENT_ID = 'landing-hero';
export const LANDING_IMAGE_BYTES = 5 * 1024 * 1024;
export const LANDING_VIDEO_BYTES = 20 * 1024 * 1024;
export const LANDING_VIDEO_SECONDS = 30;
export const landingMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'];
export const landingRevisionSchema = z.object({ revision: z.coerce.number().int().min(0) }).strict();
export const landingUploadSchema = landingRevisionSchema.extend({ slot: z.enum(['asset', 'poster']) });
export const landingTextSchema = landingRevisionSchema.extend({ altText: z.string().trim().min(1).max(240) });

const assetSchema = z
  .object({
    kind: z.enum(['image', 'video']),
    publicId: z.string().startsWith('nutrimind/landing/').max(240),
    url: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.username && !url.password;
      }),
    width: z.number().int().min(320),
    height: z.number().int().min(180),
    bytes: z.number().int().positive().max(LANDING_VIDEO_BYTES),
    format: z.enum(['jpg', 'jpeg', 'png', 'webp', 'avif', 'mp4', 'webm']),
    duration: z.number().positive().max(LANDING_VIDEO_SECONDS).nullable(),
  })
  .strict()
  .superRefine((asset, ctx) => {
    const formats = asset.kind === 'image' ? ['jpg', 'jpeg', 'png', 'webp', 'avif'] : ['mp4', 'webm'];
    if (!formats.includes(asset.format) || !new URL(asset.url).pathname.includes(`/${asset.kind}/upload/`))
      ctx.addIssue({ code: 'custom', message: 'Invalid media format.' });
    if (asset.kind === 'image' && (asset.bytes > LANDING_IMAGE_BYTES || asset.duration !== null))
      ctx.addIssue({ code: 'custom', message: 'Invalid image metadata.' });
    if (asset.kind === 'video' && asset.duration === null)
      ctx.addIssue({ code: 'custom', message: 'Video duration is required.' });
  });
export type LandingAsset = z.infer<typeof assetSchema>;
export const landingConfigSchema = z
  .object({
    asset: assetSchema.nullable(),
    poster: assetSchema.nullable(),
    altText: z.string().trim().min(1).max(240),
  })
  .strict()
  .refine((config) => !config.poster || config.poster.kind === 'image', 'Poster must be an image.');
export type LandingConfig = z.infer<typeof landingConfigSchema>;
export const defaultLandingDraft = (): LandingConfig => ({
  asset: null,
  poster: null,
  altText: 'KAINARA platform preview',
});

/** Validate decoded provider metadata, not just a client filename or MIME label. */
export function validateLandingUpload(result: UploadApiResponse, kind: 'image' | 'video'): LandingAsset {
  const parsed = assetSchema.safeParse({
    kind,
    publicId: result.public_id,
    url: result.secure_url,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    format: result.format,
    duration: kind === 'video' ? result.duration : null,
  });
  if (!parsed.success || result.resource_type !== kind)
    throw new AppError(
      'Use an image up to 5 MB or an MP4/WebM video up to 20 MB and 30 seconds, at least 320 × 180 pixels.',
      400,
      'INVALID_LANDING_MEDIA'
    );
  return parsed.data;
}
