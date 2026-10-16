import { z } from 'zod';
import { mealImageMetadataSchema } from './meal-image.schemas';

/** Match Next/Image and CSP; imports store links and never fetch caller-supplied URLs. */
export const batchMealImageUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
      if (url.hostname === 'res.cloudinary.com') return /^\/[^/]+\/image\/upload\/.+/.test(url.pathname);
      if (url.hostname === 'panlasangpinoy.com')
        return /^\/wp-content\/uploads\/.+\.(jpe?g|png|webp|avif)$/i.test(url.pathname);
      return url.hostname === 'i.ytimg.com' && /^\/vi\/[\w-]{11}\/[\w-]+\.(jpg|webp)$/i.test(url.pathname);
    } catch {
      return false;
    }
  }, 'Use a direct HTTPS image URL from Cloudinary, Panlasang Pinoy uploads or a YouTube thumbnail.');

export const batchMealImageSchema = z
  .object({
    url: batchMealImageUrlSchema,
    imageKind: mealImageMetadataSchema.shape.imageKind,
    altText: mealImageMetadataSchema.shape.altText,
    creator: mealImageMetadataSchema.shape.creator,
    sourcePageUrl: mealImageMetadataSchema.shape.sourcePageUrl,
    licenseCode: mealImageMetadataSchema.shape.licenseCode.nullable(),
    licenseUrl: mealImageMetadataSchema.shape.licenseUrl,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.licenseCode === null) {
      for (const field of ['creator', 'sourcePageUrl'] as const)
        if (!value[field])
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: `${field} is required for a source photo without a recorded license.`,
          });
      if (value.licenseUrl)
        ctx.addIssue({
          code: 'custom',
          path: ['licenseUrl'],
          message: 'Record a license code when supplying a license URL.',
        });
    } else {
      const metadata = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'url'));
      const result = mealImageMetadataSchema.safeParse(metadata);
      if (!result.success)
        for (const issue of result.error.issues)
          ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
    for (const field of ['sourcePageUrl', 'licenseUrl'] as const) {
      if (!value[field]) continue;
      let safe = false;
      try {
        const url = new URL(value[field]);
        safe = url.protocol === 'https:' && !url.username && !url.password;
      } catch {
        /* Report the malformed field through validation. */
      }
      if (!safe) ctx.addIssue({ code: 'custom', path: [field], message: 'Use an HTTPS link without credentials.' });
    }
  });

export type BatchMealImage = z.infer<typeof batchMealImageSchema>;
