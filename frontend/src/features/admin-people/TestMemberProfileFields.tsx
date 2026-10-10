'use client';

import { useId } from 'react';
import Input from '@/components/ui/Input';
import NativeSelect from '@/components/ui/NativeSelect';
import {
  ACTIVITY_OPTIONS,
  BIOLOGICAL_SEX_OPTIONS,
  DIETARY_OPTIONS,
  GOAL_OPTIONS,
  RICE_OPTIONS,
  SHOPPING_DAY_OPTIONS,
} from '@/features/progress/profile-options';
import type { TestMemberProfileOptions } from './test-member-profile';

export default function TestMemberProfileFields({
  profile,
  onChange,
  disabled,
  pregnant,
}: {
  profile: TestMemberProfileOptions;
  onChange: (patch: Partial<TestMemberProfileOptions>) => void;
  disabled: boolean;
  pregnant: boolean;
}) {
  const id = useId();
  const selects = [
    { key: 'biologicalSex', label: 'Biological sex', options: BIOLOGICAL_SEX_OPTIONS },
    { key: 'goal', label: 'Goal', options: GOAL_OPTIONS },
    { key: 'activityLevel', label: 'Activity level', options: ACTIVITY_OPTIONS },
    { key: 'dietaryPreference', label: 'Dietary preference', options: DIETARY_OPTIONS },
    { key: 'ricePreference', label: 'Rice preference', options: RICE_OPTIONS },
    { key: 'shoppingDayOfWeek', label: 'Shopping day', options: SHOPPING_DAY_OPTIONS },
  ] as const;
  return (
    <fieldset disabled={disabled} className="space-y-4 rounded-2xl border border-brand-border p-4">
      <legend className="px-1 text-xs font-bold">Member profile</legend>
      <p className="text-xs text-brand-muted">
        New members in this group share these settings. Calorie targets are calculated automatically.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { key: 'age', label: 'Age', min: 18, max: 100, step: 1 },
          { key: 'heightCm', label: 'Height (cm)', min: 100, max: 250, step: 0.1 },
          { key: 'weightKg', label: 'Current weight (kg)', min: 30, max: 300, step: 0.1 },
          { key: 'targetWeightKg', label: 'Target weight (kg)', min: 30, max: 300, step: 0.1 },
        ].map(({ key, label, min, max, step }) => (
          <Input
            key={key}
            label={label}
            type="number"
            min={min}
            max={max}
            step={step}
            value={profile[key as 'age' | 'heightCm' | 'weightKg' | 'targetWeightKg'] || ''}
            disabled={disabled || (key === 'targetWeightKg' && profile.goal === 'MAINTAIN')}
            helperText={
              key === 'targetWeightKg' && profile.goal === 'MAINTAIN'
                ? 'Matches current weight for Maintain.'
                : undefined
            }
            onChange={(event) => onChange({ [key]: Number(event.target.value) })}
          />
        ))}
        {selects.map(({ key, label, options }) => (
          <div key={key} className="space-y-2">
            <label htmlFor={`${id}-${key}`} className="block text-xs font-bold">
              {label}
            </label>
            <NativeSelect
              id={`${id}-${key}`}
              value={profile[key]}
              disabled={disabled || (pregnant && key === 'biologicalSex')}
              onChange={(event) =>
                onChange({ [key]: key === 'shoppingDayOfWeek' ? Number(event.target.value) : event.target.value })
              }
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ))}
        <Input
          label="Food culture"
          value={profile.foodCulture}
          maxLength={80}
          onChange={(event) => onChange({ foodCulture: event.target.value })}
        />
      </div>
    </fieldset>
  );
}
