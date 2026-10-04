import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'crypto';

let configured = false;

function configureCloudinary() {
  if (configured) return;
  const raw = process.env.CLOUDINARY_URL?.trim();
  if (!raw) throw new Error('Cloudinary is not configured.');
  const parsed = new URL(raw);
  if (parsed.protocol !== 'cloudinary:' || !parsed.username || !parsed.password || !parsed.hostname) {
    throw new Error('Cloudinary configuration is invalid.');
  }
  cloudinary.config({
    cloud_name: parsed.hostname,
    api_key: decodeURIComponent(parsed.username),
    api_secret: decodeURIComponent(parsed.password),
    secure: true,
  });
  configured = true;
}

export async function uploadMealImage(buffer: Buffer, mealId: string): Promise<UploadApiResponse> {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'nutrimind/meals',
        public_id: `${mealId}-${Date.now()}`,
        unique_filename: false,
        overwrite: false,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
      },
      (error, result) => {
        if (error || !result) reject(error || new Error('Cloudinary returned no upload result.'));
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export async function removeMealImage(publicId: string) {
  configureCloudinary();
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
}

export async function uploadLandingMedia(buffer: Buffer, kind: 'image' | 'video'): Promise<UploadApiResponse> {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: kind,
        folder: 'nutrimind/landing',
        public_id: randomUUID(),
        overwrite: false,
        allowed_formats: kind === 'video' ? ['mp4', 'webm'] : ['jpg', 'jpeg', 'png', 'webp', 'avif'],
        timeout: 90_000,
      },
      (error, result) => {
        if (error || !result) reject(error || new Error('Cloudinary returned no upload result.'));
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export async function removeLandingMedia(publicId: string, kind: 'image' | 'video') {
  configureCloudinary();
  await cloudinary.uploader.destroy(publicId, { resource_type: kind, invalidate: true });
}

/** Only the website folder is visible to the administrator's reusable gallery. */
export async function listLandingMedia(cursor?: string) {
  configureCloudinary();
  const query = cloudinary.search
    .expression('public_id:nutrimind/landing/* AND type:upload AND (resource_type:image OR resource_type:video)')
    .sort_by('created_at', 'desc')
    .max_results(24);
  if (cursor) query.next_cursor(cursor);
  return query.execute();
}

export async function getLandingMedia(publicId: string, kind: 'image' | 'video'): Promise<UploadApiResponse> {
  configureCloudinary();
  return cloudinary.api.resource(publicId, { resource_type: kind, type: 'upload', media_metadata: true });
}
