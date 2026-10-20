CREATE TABLE "AssistantMessageLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestKey" VARCHAR(36) NOT NULL,
  "message" VARCHAR(1000) NOT NULL,
  "mode" VARCHAR(16) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantMessageLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssistantMessageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AssistantMessageLog_userId_requestKey_key" ON "AssistantMessageLog"("userId", "requestKey");
CREATE INDEX "AssistantMessageLog_createdAt_id_idx" ON "AssistantMessageLog"("createdAt", "id");
CREATE INDEX "AssistantMessageLog_userId_createdAt_idx" ON "AssistantMessageLog"("userId", "createdAt");
