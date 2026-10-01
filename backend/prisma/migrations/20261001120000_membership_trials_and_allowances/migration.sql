-- CreateEnum
CREATE TYPE "MembershipFeature" AS ENUM ('AI_ESTIMATE', 'REPLAN', 'PLAN_REVIEW', 'OUTSIDE_REVIEW');

-- CreateTable
CREATE TABLE "MembershipAccount" (
    "userId" TEXT NOT NULL,
    "trialStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MembershipGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "evidenceReference" VARCHAR(200) NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" "MembershipFeature" NOT NULL,
    "requestKey" VARCHAR(240) NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "reservedUntil" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "resultEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipGrant_evidenceReference_key" ON "MembershipGrant"("evidenceReference");

-- CreateIndex
CREATE INDEX "MembershipGrant_userId_effectiveFrom_effectiveUntil_idx" ON "MembershipGrant"("userId", "effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE INDEX "MembershipUsage_userId_feature_windowStart_idx" ON "MembershipUsage"("userId", "feature", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipUsage_userId_feature_requestKey_key" ON "MembershipUsage"("userId", "feature", "requestKey");

-- AddForeignKey
ALTER TABLE "MembershipAccount" ADD CONSTRAINT "MembershipAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipGrant" ADD CONSTRAINT "MembershipGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipUsage" ADD CONSTRAINT "MembershipUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Defensive bounds for future trusted membership administration/payment adapters.
ALTER TABLE "MembershipAccount" ADD CONSTRAINT "MembershipAccount_trial_start_check"
CHECK ("trialStartedAt" IS NULL OR "trialStartedAt" >= "createdAt");
ALTER TABLE "MembershipGrant" ADD CONSTRAINT "MembershipGrant_verified_source_check"
CHECK ("source" IN ('PAID_INVOICE', 'ADMIN_ADJUSTMENT') AND length(trim("evidenceReference")) > 0 AND "effectiveUntil" > "effectiveFrom");
ALTER TABLE "MembershipUsage" ADD CONSTRAINT "MembershipUsage_window_check"
CHECK ("windowEnd" > "windowStart" AND "reservedUntil" > "createdAt" AND "payloadHash" ~ '^[0-9a-f]{64}$');

