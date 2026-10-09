CREATE TABLE "MealPlanRepairReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceCycleId" TEXT NOT NULL,
    "replacementCycleId" TEXT NOT NULL,
    "profileRevision" INTEGER NOT NULL,
    "retainedMealIds" JSONB NOT NULL,
    "purchasedItems" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MealPlanRepairReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MealPlanRepairReceipt_replacementCycleId_key" ON "MealPlanRepairReceipt"("replacementCycleId");
CREATE INDEX "MealPlanRepairReceipt_userId_createdAt_idx" ON "MealPlanRepairReceipt"("userId", "createdAt");
CREATE INDEX "MealPlanRepairReceipt_sourceCycleId_idx" ON "MealPlanRepairReceipt"("sourceCycleId");
ALTER TABLE "MealPlanRepairReceipt" ADD CONSTRAINT "MealPlanRepairReceipt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanRepairReceipt" ADD CONSTRAINT "MealPlanRepairReceipt_sourceCycleId_fkey"
    FOREIGN KEY ("sourceCycleId") REFERENCES "MealPlanCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanRepairReceipt" ADD CONSTRAINT "MealPlanRepairReceipt_replacementCycleId_fkey"
    FOREIGN KEY ("replacementCycleId") REFERENCES "MealPlanCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
