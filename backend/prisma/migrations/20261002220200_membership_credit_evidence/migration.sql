-- Keep provider evidence mandatory for positive charges. Fully credit-funded
-- periods instead retain the reviewed quote and verified activation dates.
ALTER TABLE "MembershipTestCheckout" DROP CONSTRAINT "MembershipTestCheckout_check1";
ALTER TABLE "MembershipTestCheckout" ADD CONSTRAINT "MembershipTestCheckout_paid_evidence_check" CHECK (
  "status" <> 'PAID' OR (
    "verifiedAt" IS NOT NULL AND "paidAt" IS NOT NULL AND
    "effectiveFrom" IS NOT NULL AND "effectiveUntil" IS NOT NULL AND (
      "providerPaymentId" IS NOT NULL OR (
        "amountCentavos" = 0 AND "quote" IS NOT NULL AND
        COALESCE(("quote"->>'creditCentavos')::INTEGER > 0 AND
          ("quote"->>'creditCentavos')::INTEGER = ("quote"->>'listPriceCentavos')::INTEGER, FALSE)
      )
    )
  )
);
