'use client';
import { useId } from 'react';
import Input from '@/components/ui/Input';
import type { MealReminderSettings } from './types';

export default function MealTimesFields({
  value,
  onChange,
  disabled = false,
}: {
  value: MealReminderSettings;
  onChange: (value: MealReminderSettings) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-3 font-display text-sm font-bold text-brand-text">When do you usually eat?</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(['breakfastTime', 'lunchTime', 'dinnerTime'] as const).map((field, index) => (
          <Input
            key={field}
            id={`${id}-${field}`}
            label={['Breakfast', 'Lunch', 'Dinner'][index]}
            type="time"
            required
            value={value[field]}
            onChange={(event) => onChange({ ...value, [field]: event.target.value })}
          />
        ))}
      </div>
      <Input
        id={`${id}-timezone`}
        label="Timezone"
        required
        value={value.timeZone}
        placeholder="Asia/Manila"
        list={`${id}-zones`}
        onChange={(event) => onChange({ ...value, timeZone: event.target.value })}
      />
      <datalist id={`${id}-zones`}>
        {[
          'Asia/Manila',
          'Asia/Singapore',
          'Asia/Tokyo',
          'Australia/Sydney',
          'Europe/London',
          'America/New_York',
          'America/Los_Angeles',
        ].map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
      <p className="text-xs leading-relaxed text-brand-muted">
        Default: Philippine time (UTC+8). You can change meal times later without a new nutrition report.
      </p>
    </fieldset>
  );
}
