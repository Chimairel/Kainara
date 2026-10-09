-- Preserve absent source values as NULL. No approvals or existing totals are inferred.
ALTER TABLE "FoodItem"
  ADD COLUMN "sugar" DOUBLE PRECISION,
  ADD COLUMN "phosphorus" DOUBLE PRECISION,
  ADD COLUMN "saturatedFat" DOUBLE PRECISION,
  ADD COLUMN "sourceNutrientEvidence" JSONB;
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_extended_nutrients_nonnegative"
  CHECK (("sugar" IS NULL OR ("sugar" >= 0 AND "sugar" <= 100))
     AND ("phosphorus" IS NULL OR ("phosphorus" >= 0 AND "phosphorus" <= 100000))
     AND ("saturatedFat" IS NULL OR ("saturatedFat" >= 0 AND "saturatedFat" <= 100)));
