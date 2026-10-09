-- CreateTable
CREATE TABLE "ClinicalClarificationForm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "profileRevision" INTEGER NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "profileSnapshot" JSONB NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "questions" JSONB NOT NULL,
    "requestKey" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalClarificationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalClarificationResponse" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "requestKey" VARCHAR(80) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalClarificationResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalClarificationResolution" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "rationale" VARCHAR(2000) NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalClarificationResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicalClarificationForm_userId_profileRevision_createdAt_idx" ON "ClinicalClarificationForm"("userId", "profileRevision", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalClarificationForm_userId_requestKey_key" ON "ClinicalClarificationForm"("userId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalClarificationResponse_formId_version_key" ON "ClinicalClarificationResponse"("formId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalClarificationResponse_formId_requestKey_key" ON "ClinicalClarificationResponse"("formId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalClarificationResolution_formId_key" ON "ClinicalClarificationResolution"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalClarificationResolution_responseId_key" ON "ClinicalClarificationResolution"("responseId");

-- AddForeignKey
ALTER TABLE "ClinicalClarificationForm" ADD CONSTRAINT "ClinicalClarificationForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalClarificationForm" ADD CONSTRAINT "ClinicalClarificationForm_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalClarificationResponse" ADD CONSTRAINT "ClinicalClarificationResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ClinicalClarificationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalClarificationResolution" ADD CONSTRAINT "ClinicalClarificationResolution_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ClinicalClarificationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalClarificationResolution" ADD CONSTRAINT "ClinicalClarificationResolution_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ClinicalClarificationResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalClarificationResolution" ADD CONSTRAINT "ClinicalClarificationResolution_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Version-bound case records must never use a zero or negative revision.
ALTER TABLE "ClinicalClarificationForm" ADD CONSTRAINT "ClinicalClarificationForm_positive_revision" CHECK ("profileRevision" > 0);
ALTER TABLE "ClinicalClarificationResponse" ADD CONSTRAINT "ClinicalClarificationResponse_positive_version" CHECK ("version" > 0);
