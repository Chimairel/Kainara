-- Keep purchased ingredients after a recipe swap without writing zero quantity
-- or zero source meal count into the constrained active ingredient projection.
-- Existing rows remain visible; only guarded rebuilds retire removed rows.
ALTER TABLE "GroceryItem" ADD COLUMN "isObsolete" BOOLEAN NOT NULL DEFAULT false;
