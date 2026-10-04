import { z } from 'zod';
import type { UploadApiResponse } from 'cloudinary';
import { listLandingMedia } from '@/lib/cloudinary';
import { AppError } from '@/errors/AppError';
import { validateLandingUpload, landingPosterUrl } from '@/domain/landing-media.policy';

const cursorSchema = z
  .string()
  .min(1)
  .max(2048)
  .regex(/^[A-Za-z0-9_+/=.-]+$/);

export async function getLandingGallery(cursor?: string) {
  if (cursor !== undefined && !cursorSchema.safeParse(cursor).success)
    throw new AppError('Reload the upload gallery to continue.', 400, 'INVALID_GALLERY_CURSOR');
  const page = await listLandingMedia(cursor);
  const items = (page.resources as UploadApiResponse[]).flatMap((resource) => {
    try {
      const kind = resource.resource_type;
      if (
        (kind !== 'image' && kind !== 'video') ||
        resource.type !== 'upload' ||
        resource.status !== 'active' ||
        (resource.access_mode && resource.access_mode !== 'public')
      )
        return [];
      const asset = validateLandingUpload(resource, kind);
      return [
        {
          ...asset,
          createdAt: typeof resource.created_at === 'string' ? resource.created_at : null,
          posterUrl: landingPosterUrl({ asset, poster: null, altText: 'Saved upload' }),
        },
      ];
    } catch {
      // Older or invalid provider assets cannot become publishable through the gallery.
      return [];
    }
  });
  return { items, nextCursor: typeof page.next_cursor === 'string' ? page.next_cursor : null };
}
