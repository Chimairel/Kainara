'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { Select } from '@/components/ui/Select';
import { X } from '@/components/ui/icons';
export const REVIEW_NUTRIENT_FIELDS = [
  ['calories', 'Energy', 'kcal'],
  ['proteinG', 'Protein', 'g'],
  ['carbsG', 'Carbohydrates', 'g'],
  ['fatG', 'Fat', 'g'],
  ['sodiumMg', 'Sodium', 'mg'],
  ['sugarG', 'Sugar', 'g'],
  ['fiberG', 'Fiber', 'g'],
  ['potassiumMg', 'Potassium', 'mg'],
  ['phosphorusMg', 'Phosphorus', 'mg'],
  ['saturatedFatG', 'Saturated fat', 'g'],
] as const;
export type NutrientKey = (typeof REVIEW_NUTRIENT_FIELDS)[number][0];
export type NutrientFilters = Partial<Record<NutrientKey, { min?: number; max?: number; minExclusive?: boolean; maxExclusive?: boolean }>>;
export function nutrientFilterLabels(filters: NutrientFilters) {
  return REVIEW_NUTRIENT_FIELDS.flatMap(([key, label, unit]) => {
    const range = filters[key];
    if (range?.min !== undefined && range.min === range.max && !range.minExclusive && !range.maxExclusive) return [`${label} = ${range.min} ${unit}`];
    return !range ? [] : [
      ...(range.min !== undefined ? [`${label} ${range.minExclusive ? '>' : '≥'} ${range.min} ${unit}`] : []),
      ...(range.max !== undefined ? [`${label} ${range.maxExclusive ? '<' : '≤'} ${range.max} ${unit}`] : []),
    ];
  });
}
export type FilterDraft = Partial<Record<NutrientKey, { min?: string; max?: string; mode?: 'min' | 'max' | 'exact' | 'between' }>>;
export function parseFilterDraft(draft: FilterDraft): NutrientFilters | null {
  const filters: NutrientFilters = {};
  for (const [key] of REVIEW_NUTRIENT_FIELDS) {
    const range: { min?: number; max?: number } = {};
    for (const bound of ['min', 'max'] as const) {
      const text = draft[key]?.[bound]?.trim();
      if (!text) continue;
      const value = Number(text);
      if (!Number.isFinite(value) || value < 0 || value > 1000000) return null;
      range[bound] = value;
    }
    if (draft[key]?.mode && (!Object.keys(range).length || (draft[key]?.mode === 'between' && (range.min === undefined || range.max === undefined)))) return null;
    if (draft[key]?.mode === 'exact' && range.min !== undefined) range.max = range.min;
    if (range.min !== undefined && range.max !== undefined && range.min > range.max) return null;
    if (Object.keys(range).length) filters[key] = range;
  }
  return filters;
}
/** Add only the limits needed for this search; all rules apply together. */
export default function ReviewNutrientFilters({ draft, onChange, busy }: {
  draft: FilterDraft; onChange: (value: FilterDraft) => void; busy: boolean;
}) {
  return <div className="space-y-3">
    <p className="text-xs leading-5 text-brand-muted">All limits apply together to one meal, including rice. Meals missing a required value are excluded.</p>
    {Object.values(draft).some(range => range?.mode === 'exact') && <p className="text-xs leading-5 text-brand-muted">Exactly matches the values shown to one decimal place. Entering more decimal places uses the stored precision.</p>}
    <div className="max-h-40 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
      {REVIEW_NUTRIENT_FIELDS.filter(([key]) => draft[key]).map(([key, label, unit]) => {
        const range = draft[key]!;
        const mode = range.mode ?? (range.min !== undefined ? (range.max !== undefined ? 'between' : 'min') : 'max');
        const update = (value: typeof range) => onChange({ ...draft, [key]: value });
        return <fieldset key={key} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 sm:grid-cols-[8rem_9rem_minmax(0,1fr)_2.5rem]">
          <legend className="sr-only">{label} filter</legend>
          <span className="text-sm font-semibold">{label} <span className="font-normal text-brand-muted">({unit})</span></span>
          <button type="button" disabled={busy} aria-label={`Remove ${label} filter`}
            className="col-start-2 row-start-1 flex h-10 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-green/10 focus-visible:ring-2 focus-visible:ring-brand-green disabled:opacity-50 sm:col-start-4"
            onClick={() => { const next = { ...draft }; delete next[key]; onChange(next); }}><X aria-hidden="true" className="h-4 w-4" /></button>
          <Select aria-label={`${label} comparison`} value={mode} disabled={busy}
            onChange={value => update({ mode: value as typeof mode, ...(value === 'max' ? { max: range.max ?? range.min ?? '' } : { min: range.min ?? range.max ?? '' }), ...(value === 'between' ? { max: range.max ?? '' } : {}) })}
            options={[{ value: 'max', label: 'At most ≤' }, { value: 'min', label: 'At least ≥' }, { value: 'exact', label: 'Exactly =' }, { value: 'between', label: 'Between' }]}
            triggerClassName="!min-h-10 !text-sm" className="col-span-2 sm:col-span-1" />
          <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
            {(mode === 'between' ? ['min', 'max'] as const : [mode === 'max' ? 'max' : 'min'] as const).map(bound => <label key={bound} className="min-w-0 flex-1">
              <span className="sr-only">{`${label} ${mode === 'exact' ? 'exact amount' : bound === 'min' ? 'minimum' : 'maximum'} (${unit})`}</span>
              <input type="number" min="0" max="1000000" step="any" disabled={busy} value={range[bound] ?? ''} placeholder={mode === 'between' ? (bound === 'min' ? 'Minimum' : 'Maximum') : 'Amount'}
                onChange={event => update({ ...range, [bound]: event.target.value })}
                className="h-10 w-full rounded-lg border border-brand-border bg-brand-surface px-3 text-sm tabular-nums outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 disabled:opacity-50" />
            </label>)}
          </div>
        </fieldset>;
      })}
    </div>
    <Select aria-label="Add nutrient filter" value="" placeholder="Add a nutrient limit" disabled={busy || Object.keys(draft).length === REVIEW_NUTRIENT_FIELDS.length}
      onChange={key => onChange({ ...draft, [key]: { mode: 'max', max: '' } })}
      options={REVIEW_NUTRIENT_FIELDS.map(([key, label, unit]) => ({ value: key, label: `${label} (${unit})`, disabled: Boolean(draft[key]) }))}
      className="max-w-64" triggerClassName="!min-h-10 !text-sm" />
    {parseFilterDraft(draft) === null && <FeedbackNotice variant="inline">Use nonnegative amounts and keep each minimum at or below its maximum.</FeedbackNotice>}
  </div>;
}
