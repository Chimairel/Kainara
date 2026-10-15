ALTER TYPE "AiUsageOperation" ADD VALUE 'MEMBER_ASSISTANT';

CREATE TABLE "AssistantRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestKey" VARCHAR(36) NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  "state" VARCHAR(12) NOT NULL CHECK ("state" IN ('PENDING', 'SUCCEEDED', 'FAILED')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "response" JSONB
);
CREATE UNIQUE INDEX "AssistantRequest_userId_requestKey_key" ON "AssistantRequest"("userId", "requestKey");
CREATE INDEX "AssistantRequest_userId_createdAt_idx" ON "AssistantRequest"("userId", "createdAt");
CREATE INDEX "AssistantRequest_createdAt_idx" ON "AssistantRequest"("createdAt");
