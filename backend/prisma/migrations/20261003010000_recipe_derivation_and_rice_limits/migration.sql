ALTER TABLE "MealLibrary"
  ADD COLUMN "parentMealId" TEXT,
  ADD COLUMN "recipeFamilyId" TEXT,
  ADD COLUMN "derivationKind" VARCHAR(32) NOT NULL DEFAULT 'ORIGINAL',
  ADD COLUMN "authoredByNutritionistId" TEXT,
  ADD COLUMN "adaptedImageUrl" VARCHAR(2048),
  ADD COLUMN "riceMinHalfCups" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "riceMaxHalfCups" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "MealLibrary" ADD CONSTRAINT "MealLibrary_parentMealId_fkey"
  FOREIGN KEY ("parentMealId") REFERENCES "MealLibrary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealLibrary" ADD CONSTRAINT "MealLibrary_rice_limits_check"
  CHECK ("riceMinHalfCups" >= 1 AND "riceMaxHalfCups" >= "riceMinHalfCups" AND "riceMaxHalfCups" <= 6);
ALTER TABLE "MealLibrary" ADD CONSTRAINT "MealLibrary_derivation_kind_check"
  CHECK ("derivationKind" IN ('ORIGINAL', 'SERVING_VERSION', 'ADAPTED'));
CREATE INDEX "MealLibrary_parentMealId_idx" ON "MealLibrary"("parentMealId");
CREATE INDEX "MealLibrary_recipeFamilyId_idx" ON "MealLibrary"("recipeFamilyId");
