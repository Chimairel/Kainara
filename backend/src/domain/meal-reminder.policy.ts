export const REMINDER_WINDOW_MS = 10 * 60_000;
export const PREPARE_MINUTES = 60;
export const LOG_MINUTES = 60;
export type ReminderKind = 'PREPARE' | 'LOG';
export type ReminderMealType = 'BREAKFAST' | 'LUNCH' | 'DINNER';
export interface MealSchedule {
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  timeZone: string;
  remindersEnabled: boolean;
  prepareEnabled: boolean;
  prepareMinutesBefore?: number;
  logEnabled: boolean;
}

export function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export function validMealTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { day: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** Resolve a local wall time without storing a fixed UTC offset across DST changes. */
export function mealTimeInstant(day: string, time: string, timeZone: string): Date | null {
  const desired = Date.parse(`${day}T${time}:00Z`);
  let guess = desired;
  for (let iteration = 0; iteration < 4; iteration++) {
    const parts = localParts(new Date(guess), timeZone);
    const difference = desired - Date.parse(`${parts.day}T${parts.time}:00Z`);
    if (difference === 0) return new Date(guess);
    guess += difference;
  }
  // Nonexistent spring-forward times are skipped, never silently shifted.
  return null;
}

export function dueMealReminders(schedule: MealSchedule, now: Date) {
  if (!schedule.remindersEnabled || !validTimeZone(schedule.timeZone)) return [];
  const preparationLead = schedule.prepareMinutesBefore ?? PREPARE_MINUTES;
  if (!Number.isInteger(preparationLead) || preparationLead < 0 || preparationLead > 180) return [];
  const localDay = localParts(now, schedule.timeZone).day;
  const dayBase = Date.parse(`${localDay}T12:00:00Z`);
  const result: Array<{ day: string; mealType: ReminderMealType; kind: ReminderKind; dueAt: Date; expiresAt: Date }> =
    [];
  const meals: Array<[ReminderMealType, string]> = [
    ['BREAKFAST', schedule.breakfastTime],
    ['LUNCH', schedule.lunchTime],
    ['DINNER', schedule.dinnerTime],
  ];
  for (const dayOffset of [-1, 0, 1]) {
    const day = new Date(dayBase + dayOffset * 86_400_000).toISOString().slice(0, 10);
    for (const [mealType, time] of meals) {
      if (!validMealTime(time)) continue;
      const mealAt = mealTimeInstant(day, time, schedule.timeZone);
      if (!mealAt) continue;
      for (const kind of ['PREPARE', 'LOG'] as const) {
        if (kind === 'PREPARE' ? !schedule.prepareEnabled : !schedule.logEnabled) continue;
        const dueAt = new Date(mealAt.getTime() + (kind === 'PREPARE' ? -preparationLead : LOG_MINUTES) * 60_000);
        const expiresAt = new Date(dueAt.getTime() + REMINDER_WINDOW_MS);
        if (now >= dueAt && now < expiresAt) result.push({ day, mealType, kind, dueAt, expiresAt });
      }
    }
  }
  return result;
}

// Push endpoints are untrusted user input. Send only to known public provider hosts.
export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      (['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) ||
        url.hostname.endsWith('.notify.windows.com'))
    );
  } catch {
    return false;
  }
}
