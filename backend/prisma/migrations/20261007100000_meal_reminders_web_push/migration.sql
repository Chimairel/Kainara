-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MEAL_REMINDER';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "context" JSONB,
ADD COLUMN     "deduplicationKey" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "targetPath" TEXT;

-- CreateTable
CREATE TABLE "MealReminderSettings" (
    "userId" TEXT NOT NULL,
    "breakfastTime" VARCHAR(5) NOT NULL,
    "lunchTime" VARCHAR(5) NOT NULL,
    "dinnerTime" VARCHAR(5) NOT NULL,
    "timeZone" VARCHAR(80) NOT NULL,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "prepareEnabled" BOOLEAN NOT NULL DEFAULT true,
    "logEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealReminderSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" VARCHAR(120) NOT NULL,
    "auth" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebPushDelivery" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "attemptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebPushDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebPushSubscription_userId_idx" ON "WebPushSubscription"("userId");

-- CreateIndex
CREATE INDEX "WebPushDelivery_status_createdAt_idx" ON "WebPushDelivery"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebPushDelivery_subscriptionId_notificationId_key" ON "WebPushDelivery"("subscriptionId", "notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_deduplicationKey_key" ON "Notification"("deduplicationKey");

-- AddForeignKey
ALTER TABLE "MealReminderSettings" ADD CONSTRAINT "MealReminderSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushDelivery" ADD CONSTRAINT "WebPushDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebPushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushDelivery" ADD CONSTRAINT "WebPushDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
