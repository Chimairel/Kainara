-- A verified membership credit can cover the full price without a provider charge.
-- Preserve existing positive payment records and prohibit negative amounts.
ALTER TABLE "MembershipTestCheckout" DROP CONSTRAINT "MembershipTestCheckout_amountCentavos_check";
ALTER TABLE "MembershipTestCheckout" ADD CONSTRAINT "MembershipTestCheckout_amountCentavos_check" CHECK ("amountCentavos" >= 0);
