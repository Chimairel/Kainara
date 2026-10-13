-- CreateEnum
CREATE TYPE "SupportDeliveryStatus" AS ENUM ('PROCESSING', 'ACCEPTED', 'UNCONFIRMED');

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestKey" VARCHAR(36) NOT NULL,
    "category" VARCHAR(24) NOT NULL,
    "replyEmail" VARCHAR(254) NOT NULL,
    "message" VARCHAR(4000) NOT NULL,
    "deliveryStatus" "SupportDeliveryStatus" NOT NULL DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportReply" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT,
    "requestKey" VARCHAR(36) NOT NULL,
    "message" VARCHAR(4000) NOT NULL,
    "deliveryStatus" "SupportDeliveryStatus" NOT NULL DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportRequest_createdAt_id_idx" ON "SupportRequest"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequest_userId_requestKey_key" ON "SupportRequest"("userId", "requestKey");

-- CreateIndex
CREATE INDEX "SupportReply_requestId_createdAt_idx" ON "SupportReply"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportReply_requestId_requestKey_key" ON "SupportReply"("requestId", "requestKey");

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportReply" ADD CONSTRAINT "SupportReply_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportReply" ADD CONSTRAINT "SupportReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
