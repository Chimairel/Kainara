CREATE TYPE "MembershipBillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "MembershipTestCheckoutStatus" AS ENUM ('CREATING', 'OPEN', 'PAID', 'FAILED');
CREATE TABLE "MembershipTestCheckout" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tier" "MembershipTier" NOT NULL,
  "period" "MembershipBillingPeriod" NOT NULL,
  "requestKey" VARCHAR(36) NOT NULL,
  "amountCentavos" INTEGER NOT NULL CHECK ("amountCentavos" > 0),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'PHP' CHECK ("currency" = 'PHP'),
  "accountHash" VARCHAR(64) NOT NULL,
  "providerSessionId" TEXT,
  "providerPaymentId" TEXT,
  "checkoutUrl" TEXT,
  "status" "MembershipTestCheckoutStatus" NOT NULL DEFAULT 'CREATING',
  "verifiedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "effectiveFrom" TIMESTAMP(3),
  "effectiveUntil" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom"),
  CHECK ("status" <> 'PAID' OR ("providerPaymentId" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "paidAt" IS NOT NULL AND "effectiveFrom" IS NOT NULL AND "effectiveUntil" IS NOT NULL))
);
CREATE UNIQUE INDEX "MembershipTestCheckout_userId_requestKey_key" ON "MembershipTestCheckout"("userId", "requestKey");
CREATE UNIQUE INDEX "MembershipTestCheckout_providerSessionId_key" ON "MembershipTestCheckout"("providerSessionId");
CREATE UNIQUE INDEX "MembershipTestCheckout_providerPaymentId_key" ON "MembershipTestCheckout"("providerPaymentId");
CREATE INDEX "MembershipTestCheckout_userId_accountHash_status_effectiveUntil_idx" ON "MembershipTestCheckout"("userId", "accountHash", "status", "effectiveUntil");
