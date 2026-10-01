-- Preserve every rejected application and its audit/reference history.
-- Only non-rejected applications reserve an email/license. Normalize index keys
-- so concurrent callers cannot bypass active uniqueness with casing/spacing.
BEGIN;
CREATE UNIQUE INDEX "NutritionistApplication_active_email_key"
  ON "NutritionistApplication" (lower(btrim("email"))) WHERE "status" <> 'REJECTED';
CREATE UNIQUE INDEX "NutritionistApplication_active_prc_key"
  ON "NutritionistApplication" (upper(btrim("prcLicenseNumber"))) WHERE "status" <> 'REJECTED';
DROP INDEX "NutritionistApplication_email_key";
DROP INDEX "NutritionistApplication_prcLicenseNumber_key";
CREATE INDEX "NutritionistApplication_email_createdAt_idx" ON "NutritionistApplication" ("email", "createdAt");
CREATE INDEX "NutritionistApplication_prcLicenseNumber_status_idx" ON "NutritionistApplication" ("prcLicenseNumber", "status");
COMMIT;
ALTER TYPE "NotificationType" ADD VALUE 'NUTRITIONIST_APPLICATION';
