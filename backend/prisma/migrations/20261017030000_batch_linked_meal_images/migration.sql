-- Preserve the existing empty/uploaded-image states and admit attributed URL-only images.
-- No image bytes, dimensions or provider resource identities are invented for external links.
BEGIN;
ALTER TABLE "MealLibrary" DROP CONSTRAINT "MealLibrary_image_dimensions_check";
ALTER TABLE "MealLibrary" ADD CONSTRAINT "MealLibrary_image_dimensions_check" CHECK (
  ("imagePublicId" IS NULL AND "imageVersion" IS NULL AND "imageFormat" IS NULL
    AND "imageWidth" IS NULL AND "imageHeight" IS NULL AND "imageBytes" IS NULL
    AND "imageKind" IS NULL AND "imageAltText" IS NULL AND "imageCreator" IS NULL
    AND "imageSourcePageUrl" IS NULL AND "imageLicenseCode" IS NULL
    AND "imageLicenseUrl" IS NULL AND "imageAssignedAt" IS NULL)
  OR
  ("imagePublicId" IS NOT NULL AND "imageVersion" IS NOT NULL AND "imageFormat" IS NOT NULL
    AND "imageWidth" >= 320 AND "imageHeight" >= 240 AND "imageBytes" > 0
    AND "imageBytes" <= 5242880 AND "imageKind" IS NOT NULL
    AND length("imageAltText") >= 8 AND "imageAssignedAt" IS NOT NULL)
  OR
  COALESCE(("adaptedImageUrl" IS NOT NULL
    AND "imagePublicId" IS NULL AND "imageVersion" IS NULL AND "imageFormat" IS NULL
    AND "imageWidth" IS NULL AND "imageHeight" IS NULL AND "imageBytes" IS NULL
    AND "imageKind" IS NOT NULL AND length("imageAltText") >= 8 AND "imageAssignedAt" IS NOT NULL
    AND (
      ("imageLicenseCode" IS NULL AND length("imageCreator") > 0 AND length("imageSourcePageUrl") > 0 AND "imageLicenseUrl" IS NULL)
      OR "imageLicenseCode" IN ('OWNED', 'GENERATED', 'CC0', 'PUBLIC_DOMAIN', 'CC_BY_4_0', 'CC_BY_SA_4_0')
    )), FALSE)
);
COMMIT;
