export const mealTimeRanges = {
  breakfastTime: { label: 'Breakfast', min: '05:00', max: '10:00', range: '5:00–10:00 AM' },
  lunchTime: { label: 'Lunch', min: '11:00', max: '15:00', range: '11:00 AM–3:00 PM' },
  dinnerTime: { label: 'Dinner', min: '17:00', max: '23:00', range: '5:00–11:00 PM' },
} as const;

export function reminderTimeLabel(time: string, offsetMinutes: number): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isInteger(offsetMinutes)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  const total = hours * 60 + minutes + offsetMinutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  const day = total < 0 ? ' (previous day)' : total >= 1440 ? ' (next day)' : '';
  return `${hour % 12 || 12}:${String(wrapped % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}${day}`;
}
