-- CreateTable
CREATE TABLE "ClinicalProfileProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "profileRevision" INTEGER NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "beforeSnapshot" JSONB NOT NULL,
    "changes" JSONB NOT NULL,
    "evidenceSnapshot" JSONB NOT NULL,
    "rationale" VARCHAR(2000) NOT NULL,
    "requestKey" VARCHAR(80) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "replacesProposalId" TEXT,
    "memberNote" VARCHAR(2000),
    "memberRequestKey" VARCHAR(80),
    "respondedAt" TIMESTAMP(3),
    "acceptedProfileRevision" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalProfileProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicalProfileProposal_userId_createdAt_idx" ON "ClinicalProfileProposal"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalProfileProposal_userId_requestKey_key" ON "ClinicalProfileProposal"("userId", "requestKey");

-- AddForeignKey
ALTER TABLE "ClinicalProfileProposal" ADD CONSTRAINT "ClinicalProfileProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalProfileProposal" ADD CONSTRAINT "ClinicalProfileProposal_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One active proposal across claim handoffs; history is never overwritten.
CREATE UNIQUE INDEX "ClinicalProfileProposal_one_active_per_member"
ON "ClinicalProfileProposal" ("userId") WHERE "status" IN ('PENDING', 'CORRECTION_REQUESTED');
ALTER TABLE "ClinicalProfileProposal" ADD CONSTRAINT "ClinicalProfileProposal_status_check"
CHECK ("status" IN ('PENDING', 'CORRECTION_REQUESTED', 'ACCEPTED', 'SUPERSEDED'));
ALTER TABLE "ClinicalProfileProposal" ADD CONSTRAINT "ClinicalProfileProposal_revision_check" CHECK ("profileRevision" > 0);
