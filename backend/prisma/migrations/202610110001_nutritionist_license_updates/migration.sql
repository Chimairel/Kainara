CREATE TYPE "NutritionistLicenseUpdateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "NutritionistLicenseUpdatePurpose" AS ENUM ('RENEWAL', 'CORRECTION');
CREATE TABLE "NutritionistLicenseUpdate" (
  "id" TEXT NOT NULL,
  "nutritionistProfileId" TEXT NOT NULL,
  "purpose" "NutritionistLicenseUpdatePurpose" NOT NULL,
  "status" "NutritionistLicenseUpdateStatus" NOT NULL DEFAULT 'PENDING',
  "previousLicenseNumber" VARCHAR(80) NOT NULL,
  "previousLicenseExpiry" TIMESTAMP(3) NOT NULL,
  "proposedLicenseNumber" VARCHAR(80) NOT NULL,
  "proposedLicenseExpiry" TIMESTAMP(3) NOT NULL,
  "submissionReason" VARCHAR(1500) NOT NULL,
  "originalFileName" VARCHAR(180) NOT NULL,
  "mimeType" VARCHAR(40) NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "encryptedPayload" BYTEA NOT NULL,
  "encryptionIv" BYTEA NOT NULL,
  "encryptionAuthTag" BYTEA NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewerName" VARCHAR(200),
  "decisionReason" VARCHAR(1500),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NutritionistLicenseUpdate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NutritionistLicenseUpdate_size_check" CHECK ("byteSize" > 0 AND "byteSize" <= 4194304),
  CONSTRAINT "NutritionistLicenseUpdate_mime_check" CHECK ("mimeType" IN ('application/pdf','image/jpeg','image/png')),
  CONSTRAINT "NutritionistLicenseUpdate_decision_check" CHECK (
    ("status" = 'PENDING' AND "reviewedAt" IS NULL AND "decisionReason" IS NULL AND "reviewerName" IS NULL)
    OR ("status" <> 'PENDING' AND "reviewedAt" IS NOT NULL AND "decisionReason" IS NOT NULL AND length("decisionReason") >= 10 AND "reviewerName" IS NOT NULL)
  )
);
CREATE INDEX "NutritionistLicenseUpdate_status_createdAt_id_idx" ON "NutritionistLicenseUpdate"("status", "createdAt", "id");
CREATE INDEX "NutritionistLicenseUpdate_nutritionistProfileId_createdAt_id_idx" ON "NutritionistLicenseUpdate"("nutritionistProfileId", "createdAt", "id");
CREATE UNIQUE INDEX "NutritionistLicenseUpdate_one_pending" ON "NutritionistLicenseUpdate"("nutritionistProfileId") WHERE "status" = 'PENDING';
ALTER TABLE "NutritionistLicenseUpdate" ADD CONSTRAINT "NutritionistLicenseUpdate_nutritionistProfileId_fkey" FOREIGN KEY ("nutritionistProfileId") REFERENCES "NutritionistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NutritionistLicenseUpdate" ADD CONSTRAINT "NutritionistLicenseUpdate_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
