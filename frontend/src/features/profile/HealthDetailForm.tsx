import type { FormEvent } from 'react';
import Button from '@/components/ui/Button';
import { ProfileSectionHeader } from '@/components/user/ProfileSettingsSection';
import { healthAreaLabel } from './health-inbox-items';

export type HealthAnswers = {
  conditionDetails: string;
  medications: string;
  dietaryAdvice: string;
  recentSymptoms: string;
  measurements: string;
};
export const emptyHealthAnswers: HealthAnswers = {
  conditionDetails: '',
  medications: '',
  dietaryAdvice: '',
  recentSymptoms: '',
  measurements: '',
};
export const healthDetailFields: Array<[keyof HealthAnswers, string]> = [
  ['conditionDetails', 'Condition or restriction details'],
  ['medications', 'Current medication or supplements'],
  ['dietaryAdvice', 'Dietary advice you have received'],
  ['recentSymptoms', 'Recent symptoms or episodes'],
  ['measurements', 'Recent measurements or lab values (optional)'],
];
const allergyLabels: Partial<Record<keyof HealthAnswers, string>> = {
  conditionDetails: 'Food allergies, intolerances or avoided foods and their reactions',
  medications: 'Medication or supplements used for these restrictions',
  dietaryAdvice: 'Dietary advice for these allergies or restrictions',
  recentSymptoms: 'Recent allergic reactions or food-related symptoms',
};

export default function HealthDetailForm({
  area,
  areas,
  answers,
  busy,
  profileChanged,
  embedded = false,
  onSelect,
  onChange,
  onSave,
  requirement,
}: {
  area: string;
  areas: string[];
  answers: HealthAnswers;
  busy: boolean;
  profileChanged: boolean;
  embedded?: boolean;
  onSelect: (area: string) => void;
  onChange: (field: keyof HealthAnswers, value: string) => void;
  onSave: (event: FormEvent) => void;
  requirement?: { state: string; message: string };
}) {
  return (
    <form
      onSubmit={onSave}
      className={
        embedded ? 'space-y-5 sm:space-y-6' : 'space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-5'
      }
    >
      {embedded ? (
        <header className="border-b border-brand-border pb-4 sm:pb-5">
          <ProfileSectionHeader
            level={3}
            title={healthAreaLabel(area)}
            description="Your answers are shared with an RND for review. Use “none” or “unknown” where appropriate."
          />
          {requirement && <p className="mt-3 text-xs text-brand-muted">{requirement.message}</p>}
        </header>
      ) : (
        <fieldset disabled={busy || profileChanged}>
          <legend className="text-sm font-semibold">Choose details to complete</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {areas.map((value) => (
              <Button
                key={value}
                type="button"
                variant={area === value ? 'primary' : 'secondary'}
                disabled={busy || profileChanged}
                aria-pressed={area === value}
                onClick={() => onSelect(value)}
              >
                {healthAreaLabel(value)}
              </Button>
            ))}
          </div>
        </fieldset>
      )}
      {area === 'FOOD_ALLERGY' && !embedded && (
        <p className="max-w-prose text-sm leading-relaxed text-brand-muted">
          Describe your declared food allergies, intolerances and avoided foods, including triggers and reactions. These
          answers are saved separately from your condition details.
        </p>
      )}
      <fieldset disabled={busy || profileChanged} className="space-y-5">
        {healthDetailFields.map(([field, label]) => (
          <label key={field} className="block text-sm font-semibold leading-relaxed">
            {area === 'FOOD_ALLERGY' ? (allergyLabels[field] ?? label) : label}
            <textarea
              required={field !== 'measurements'}
              minLength={field === 'conditionDetails' ? 10 : field === 'measurements' ? undefined : 2}
              maxLength={field === 'measurements' ? 1000 : 2000}
              rows={3}
              value={answers[field]}
              onChange={(event) => onChange(field, event.target.value)}
              className="mt-2 block w-full rounded-xl border border-brand-border bg-brand-bgAlt/30 p-3 text-base font-normal leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:opacity-70 sm:text-sm"
            />
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 border-t border-brand-border pt-5">
        <Button type="submit" disabled={busy || profileChanged} isLoading={busy} className="w-full sm:w-auto">
          {busy ? 'Saving…' : 'Save health details'}
        </Button>
        <p className="text-xs text-brand-muted">Saving details does not approve a meal.</p>
      </div>
    </form>
  );
}
