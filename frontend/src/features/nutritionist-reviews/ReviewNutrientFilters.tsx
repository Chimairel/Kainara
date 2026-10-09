'use client';
import Button from '@/components/ui/Button';
export const REVIEW_NUTRIENT_FIELDS = [
  ['calories', 'Energy', 'kcal'], ['proteinG', 'Protein', 'g'], ['carbsG', 'Carbohydrates', 'g'], ['fatG', 'Fat', 'g'],
  ['sodiumMg', 'Sodium', 'mg'], ['sugarG', 'Sugar', 'g'], ['fiberG', 'Fiber', 'g'], ['potassiumMg', 'Potassium', 'mg'],
  ['phosphorusMg', 'Phosphorus', 'mg'], ['saturatedFatG', 'Saturated fat', 'g'],
] as const;
export type NutrientKey = typeof REVIEW_NUTRIENT_FIELDS[number][0];
export type NutrientFilters = Partial<Record<NutrientKey, { min?: number; max?: number }>>;
export type FilterDraft = Partial<Record<NutrientKey, { min?: string; max?: string }>>;
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
    if (range.min !== undefined && range.max !== undefined && range.min > range.max) return null;
    if (Object.keys(range).length) filters[key] = range;
  }
  return filters;
}
export default function ReviewNutrientFilters({ draft, onChange, apply, busy }: {
  draft: FilterDraft; onChange: (value: FilterDraft) => void; apply: () => void; busy: boolean;
}) {
  const valid = parseFilterDraft(draft) !== null;
  return <details className="my-4 rounded-xl border border-brand-border bg-brand-bg p-4">
    <summary className="cursor-pointer text-sm font-bold">Filter complete-plate nutrients</summary>
    <p className="my-3 text-xs text-brand-muted">Limits apply to one serving including rice. Missing required values are excluded. Leave a field empty for no limit.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {REVIEW_NUTRIENT_FIELDS.map(([key, label, unit]) => <fieldset key={key} className="rounded-lg border border-brand-border p-2">
        <legend className="text-xs font-bold">{label} ({unit})</legend>
        <div className="flex gap-2">{(['min', 'max'] as const).map(bound => <label key={bound} className="min-w-0 flex-1 text-xs text-brand-muted">
          {bound === 'min' ? 'Minimum' : 'Maximum'}
          <input aria-label={`${label} ${bound === 'min' ? 'minimum' : 'maximum'} (${unit})`} type="number" min="0" max="1000000" step="any"
            disabled={busy} value={draft[key]?.[bound] ?? ''} onChange={event => onChange({ ...draft, [key]: { ...draft[key], [bound]: event.target.value } })}
            className="mt-1 w-full rounded-lg border border-brand-border bg-brand-surface p-2 text-brand-text" />
        </label>)}</div>
      </fieldset>)}
    </div>
    {!valid && <p role="alert" className="mt-3 text-xs text-red-500">Use nonnegative numbers and keep each minimum at or below its maximum.</p>}
    <div className="mt-3 flex gap-2"><Button size="sm" disabled={busy || !valid} onClick={apply}>Apply filters</Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => onChange({})}>Clear limits</Button></div>
  </details>;
}
