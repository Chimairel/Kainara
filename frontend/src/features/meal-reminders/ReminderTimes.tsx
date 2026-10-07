import type { MealReminderSettings } from './types';
import { mealTimeRanges, reminderTimeLabel } from './meal-time-presentation';

export default function ReminderTimes({ settings, kind }: { settings: MealReminderSettings; kind: 'prepare' | 'log' }) {
  const lead = settings.prepareMinutesBefore ?? 60;
  const offset = kind === 'log' ? 60 : lead >= 0 && lead <= 180 ? -lead : NaN;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-brand-muted">
      {(Object.keys(mealTimeRanges) as Array<keyof typeof mealTimeRanges>).map((field) => (
        <span key={field}>
          {mealTimeRanges[field].label}: {reminderTimeLabel(settings[field], offset) ?? 'Set a valid time'}
        </span>
      ))}
    </span>
  );
}
