'use client';
import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { type FilterValues, membershipNames, defaultFilters } from './meal-log.types';

export default function MealLogFilters({
  value,
  onApply,
  popularity = false,
}: {
  value: FilterValues;
  onApply: (value: FilterValues) => void;
  popularity?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const set = (key: keyof FilterValues, next: string) => setDraft((v) => ({ ...v, [key]: next }));
  const selects: [keyof FilterValues, string, { value: string; label: string }[]][] = [
    [
      'source',
      'Meal source',
      [
        { value: '', label: 'All sources' },
        { value: 'PLANNED', label: 'Planned meals' },
        { value: 'OUTSIDE', label: 'Outside meals' },
      ],
    ],
    [
      'mealType',
      'Meal type',
      [
        { value: '', label: 'All meal types' },
        ...['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'].map((value) => ({
          value,
          label: value.charAt(0) + value.slice(1).toLowerCase(),
        })),
      ],
    ],
    [
      'ageGroup',
      'Recorded age group',
      [
        { value: '', label: 'All ages' },
        ...['18-24', '25-34', '35-44', '45+', 'UNKNOWN'].map((value) => ({
          value,
          label: value === 'UNKNOWN' ? 'Not recorded' : value,
        })),
      ],
    ],
    [
      'membership',
      'Recorded membership',
      [
        { value: '', label: 'All memberships' },
        ...Object.entries(membershipNames).map(([value, label]) => ({ value, label })),
      ],
    ],
    popularity
      ? [
          'order',
          'Ranking order',
          [
            { value: 'MOST_EATEN', label: 'Most eaten first' },
            { value: 'LEAST_EATEN', label: 'Least eaten first' },
          ],
        ]
      : [
          'status',
          'Meal status',
          [
            { value: '', label: 'All statuses' },
            { value: 'DONE', label: 'Eaten' },
            { value: 'SKIPPED', label: 'Skipped' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'REMOVED', label: 'Removed' },
          ],
        ],
  ];
  return (
    <Card className="p-4 sm:p-6">
      <form
        aria-label={popularity ? 'Popularity filters' : 'Meal log filters'}
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft);
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {!popularity && (
            <label className="space-y-2 text-xs font-semibold text-brand-muted">
              Member name or email
              <input
                aria-label="Member name or email"
                type="search"
                value={draft.member}
                maxLength={200}
                onChange={(e) => set('member', e.target.value)}
                className="min-h-11 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-brand-text"
              />
            </label>
          )}
          {(['from', 'to'] as const).map((key) => (
            <label key={key} className="space-y-2 text-xs font-semibold text-brand-muted">
              {key === 'from' ? 'From' : 'To'}
              <input
                aria-label={key === 'from' ? 'From' : 'To'}
                type="date"
                required
                value={draft[key]}
                onChange={(e) => set(key, e.target.value)}
                className="min-h-11 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-brand-text"
              />
            </label>
          ))}
          {selects.map(([key, label, options]) => (
            <div key={key} className="space-y-2">
              <p className="text-xs font-semibold text-brand-muted">{label}</p>
              <Select
                aria-label={label}
                value={draft[key]}
                options={options}
                onChange={(next) => set(key, next)}
                className="w-full"
              />
            </div>
          ))}
        </div>
        {!popularity && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.includeTests === 'true'}
              onChange={(e) => set('includeTests', String(e.target.checked))}
            />
            Include marked test accounts
          </label>
        )}
        {draft.recipeKey && (
          <p className="text-xs text-brand-muted">Showing logs linked to the selected ranked dish.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Apply filters</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const fresh = defaultFilters();
              setDraft(fresh);
              onApply(fresh);
            }}
          >
            Reset filters
          </Button>
        </div>
        <p className="text-xs text-brand-muted">
          Meal dates use Philippine time. Age and membership reflect the context recorded when the log was created.
          Maximum range: 366 days.
        </p>
      </form>
    </Card>
  );
}
