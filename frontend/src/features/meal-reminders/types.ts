export interface MealReminderSettings {
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  timeZone: string;
  remindersEnabled: boolean;
  prepareEnabled: boolean;
  prepareMinutesBefore?: number;
  logEnabled: boolean;
}
export const suggestedMealTimes: MealReminderSettings = {
  breakfastTime: '07:00',
  lunchTime: '12:00',
  dinnerTime: '18:00',
  timeZone: 'Asia/Manila',
  remindersEnabled: false,
  prepareEnabled: true,
  prepareMinutesBefore: 60,
  logEnabled: true,
};
export function mealSchedulePayload(settings: MealReminderSettings): MealReminderSettings {
  const { breakfastTime, lunchTime, dinnerTime, timeZone, remindersEnabled, prepareEnabled, logEnabled } = settings;
  return {
    breakfastTime,
    lunchTime,
    dinnerTime,
    timeZone,
    remindersEnabled,
    prepareEnabled,
    logEnabled,
    prepareMinutesBefore: settings.prepareMinutesBefore ?? 60,
  };
}
