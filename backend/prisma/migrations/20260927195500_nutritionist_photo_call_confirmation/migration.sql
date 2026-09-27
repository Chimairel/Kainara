ALTER TABLE "NutritionistApplication"
  ADD COLUMN "photoRecentAttestedAt" TIMESTAMP(3),
  ADD COLUMN "callVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "callVerifiedByAdminId" TEXT;
