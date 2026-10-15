CREATE TABLE "ReviewFlagDraft" (
    "id" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "expectedVersion" TEXT NOT NULL,
    "notes" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "result" JSONB,
    CONSTRAINT "ReviewFlagDraft_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReviewFlagDraft_state_check" CHECK ("state" IN ('ACTIVE', 'CANCELLED', 'EXPIRED', 'SUBMITTED'))
);
CREATE INDEX "ReviewFlagDraft_targetKey_state_idx" ON "ReviewFlagDraft"("targetKey", "state");
CREATE INDEX "ReviewFlagDraft_state_expiresAt_idx" ON "ReviewFlagDraft"("state", "expiresAt");
CREATE UNIQUE INDEX "ReviewFlagDraft_one_active_target" ON "ReviewFlagDraft"("targetKey") WHERE "state" = 'ACTIVE';
