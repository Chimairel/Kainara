ALTER TYPE "MembershipTestCheckoutStatus" ADD VALUE IF NOT EXISTS 'QUOTED';
ALTER TYPE "MembershipTestCheckoutStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "MembershipTestCheckoutStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TABLE "MembershipTestCheckout" ADD COLUMN "supersededAt" TIMESTAMP(3), ADD COLUMN "quote" JSONB;
CREATE TABLE "MembershipTestBalance" (
  "userId" TEXT NOT NULL,
  "accountHash" VARCHAR(64) NOT NULL,
  "amountCentavos" INTEGER NOT NULL DEFAULT 0 CHECK ("amountCentavos" >= 0),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MembershipTestBalance_pkey" PRIMARY KEY ("userId", "accountHash"),
  CONSTRAINT "MembershipTestBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
