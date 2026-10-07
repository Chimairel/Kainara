ALTER TABLE "MealReminderSettings"
ADD COLUMN "prepareMinutesBefore" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "MealReminderSettings"
ADD CONSTRAINT "MealReminderSettings_prepareMinutesBefore_check"
CHECK ("prepareMinutesBefore" BETWEEN 0 AND 180);
