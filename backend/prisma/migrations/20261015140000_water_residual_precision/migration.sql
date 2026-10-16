-- API additions still require 50–2000 mL. A subtraction can leave any positive
-- integer remainder; retaining it avoids silently discarding recorded intake.
ALTER TABLE "WaterLog"
  DROP CONSTRAINT "WaterLog_amount_range",
  ADD CONSTRAINT "WaterLog_amount_range" CHECK ("amountMl" >= 1 AND "amountMl" <= 2000);
