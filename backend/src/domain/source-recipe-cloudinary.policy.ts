import manifest from '@/data/panlasang-cloudinary-images.json';
import type { PublicMealImage, RawRecipeImageRecord } from './meal-image.policy';

type SourcePhoto = {
  sourceRecordId: string;
  publicId: string;
  version: string;
  format: string;
  kind: string;
  creator: string | null;
  photoSourceUrl: string;
};
const photos: Readonly<Record<string, SourcePhoto>> = manifest.recipes;

export function configuredCloudinaryCloudName(): string | undefined {
  const explicit = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (explicit) return explicit;
  try {
    const config = new URL(process.env.CLOUDINARY_URL || '');
    return config.protocol === 'cloudinary:' ? config.hostname : undefined;
  } catch {
    return undefined;
  }
}

/** Exact recovered source identity only. Photos confer no recipe or member clearance. */
export function toPublicSourceCloudinaryImage(recipe: RawRecipeImageRecord): PublicMealImage | null {
  if (!['PANLASANG_PINOY', 'DEMO_STANDARD_PORTION'].includes(recipe.sourceName)) return null;
  if (configuredCloudinaryCloudName() !== manifest.cloudName) return null;
  const photo = photos[recipe.sourceUrl];
  if (!photo || (recipe.sourceRecordId && recipe.sourceRecordId !== photo.sourceRecordId)) return null;
  // Constrain delivery to the inventoried catalogue; no caller-supplied URL or transform.
  if (!/^nutrimind\/recipe-catalogue\/[a-f0-9]{28}$/.test(photo.publicId)) return null;
  if (!/^\d+$/.test(photo.version) || !/^(jpg|jpeg|png|webp|avif)$/.test(photo.format)) return null;
  return {
    url: `https://res.cloudinary.com/${manifest.cloudName}/image/upload/f_auto,q_auto,w_960,c_limit/v${photo.version}/${photo.publicId}.${photo.format}`,
    altText: `Recipe photo for ${recipe.recipeName}`,
    kind: recipe.sourceName === 'DEMO_STANDARD_PORTION' || photo.kind === 'REPRESENTATIVE' ? 'REPRESENTATIVE' : 'EXACT',
    attribution: {
      creator: photo.creator,
      sourcePageUrl: photo.photoSourceUrl,
      licenseCode: null,
      licenseUrl: null,
      modifications: 'Resized and format-optimized for display.',
    },
  };
}
