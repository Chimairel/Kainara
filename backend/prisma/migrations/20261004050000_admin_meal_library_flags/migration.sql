-- Preserve existing nutritionist flags and add explicit administrator attribution.
ALTER TABLE "MealLibraryFlag"
  ALTER COLUMN "flaggedByNutritionistId" DROP NOT NULL,
  ADD COLUMN "flaggedByAdminUserId" TEXT;

ALTER TABLE "MealLibraryFlag"
  ADD CONSTRAINT "MealLibraryFlag_flaggedByAdminUserId_fkey"
  FOREIGN KEY ("flaggedByAdminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MealLibraryFlag_single_actor_check"
  CHECK (num_nonnulls("flaggedByNutritionistId", "flaggedByAdminUserId") = 1);
