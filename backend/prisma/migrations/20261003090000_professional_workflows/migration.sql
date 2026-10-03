-- AlterTable
ALTER TABLE "ClinicalProfileReview" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedByNutritionistId" TEXT;

-- AlterTable
ALTER TABLE "NutritionistApplication" ADD COLUMN     "callEmailAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "callEmailSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ApplicationEmailVerification" (
    "email" VARCHAR(254) NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "proofHash" TEXT,
    "verifiedUntil" TIMESTAMP(3),

    CONSTRAINT "ApplicationEmailVerification_pkey" PRIMARY KEY ("email")
);
