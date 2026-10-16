import { toPublicMealImage, type MealImageRecord, type PublicMealImage } from './meal-image.policy';
import { batchMealImageSchema, type BatchMealImage } from '../validation/batch-meal-image.schemas';

/** No provider fetch/upload, clinical decision or ingredient change is implied by a linked photo. */
export function batchMealImageFields(image: BatchMealImage) {
  return {
    adaptedImageUrl: image.url,
    imageKind: image.imageKind,
    imageAltText: image.altText,
    imageCreator: image.creator || null,
    imageSourcePageUrl: image.sourcePageUrl || null,
    imageLicenseCode: image.licenseCode,
    imageLicenseUrl: image.licenseUrl || null,
    imageAssignedAt: new Date(),
  };
}

export function exportBatchMealImage(
  record: MealImageRecord,
  resolvedImage?: PublicMealImage | null
): BatchMealImage | null {
  const image = resolvedImage ?? toPublicMealImage(record);
  if (!image) return null;
  const candidate = {
    url: image.url,
    imageKind: image.kind,
    altText: image.altText,
    ...(image.attribution.creator ? { creator: image.attribution.creator } : {}),
    ...(image.attribution.sourcePageUrl ? { sourcePageUrl: image.attribution.sourcePageUrl } : {}),
    licenseCode: image.attribution.licenseCode,
    ...(image.attribution.licenseUrl ? { licenseUrl: image.attribution.licenseUrl } : {}),
  };
  const result = batchMealImageSchema.safeParse(candidate);
  return result.success ? result.data : null;
}
