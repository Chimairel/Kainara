import FeedbackNotice from '@/components/shared/FeedbackNotice';
import OutsideReviewRequestButton from '@/features/membership/OutsideReviewRequestButton';
import { formatMealTitle } from '@/lib/meal-title';
import Button from '@/components/ui/Button';
import type { OutsideMealWarning } from './model';
import type { OutsideMealModalProps as Props } from './outside-meal-modal.types';

const sourceLabels: Record<OutsideMealWarning['items'][number]['source'], string> = {
  VERIFIED_LIBRARY: 'Saved library serving',
  FNRI: 'FNRI composition',
  USER_REPORTED: 'Your entered values',
  USER_ADJUSTED_LIBRARY: 'Library values edited by you',
  GEMINI_ESTIMATED: 'Gemini estimate · no cited source',
  NUTRITIONIST_REVIEWED: 'RND-reviewed estimate',
  UNRESOLVED: 'Nutrition unavailable',
};
const sourceNotes: Record<OutsideMealWarning['items'][number]['source'], string> = {
  VERIFIED_LIBRARY: 'Uses the saved library nutrition for this recipe serving. Your preparation may differ.',
  FNRI: 'Uses a saved FNRI food-composition record, scaled from per-100 g values to the entered grams.',
  USER_REPORTED: 'Recorded as supplied by you. These values have not been independently checked.',
  USER_ADJUSTED_LIBRARY: 'Your edits replace the library values for this log; they do not inherit recipe verification.',
  GEMINI_ESTIMATED: 'Generated from the food name and any portion or notes provided. Gemini did not search the web or return source citations.',
  NUTRITIONIST_REVIEWED: 'An RND has reviewed these nutrition values. They remain an estimate, not personal medical clearance.',
  UNRESOLVED: 'No nutrition values were resolved for this food. It is excluded from the total.',
};

export default function PreviewConfirmation(props: Props & { warning: OutsideMealWarning }) {
  const { estimate, items, summary } = props.warning;
  const hasAi = items.some((item) => item.source === 'GEMINI_ESTIMATED');
  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-brand-bgAlt p-4 sm:p-5" aria-labelledby="food-preview-total">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="food-preview-total" className="font-display text-base font-bold text-brand-text">{summary.unresolvedItemCount > 0 ? 'Partial nutrition total' : 'Nutrition total'}</h3>
          <span className="text-xs text-brand-muted">For the portions below</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
          <MacroEstimate label="Calories" value={Math.round(estimate.calories)} unit="kcal" />
          <MacroEstimate label="Protein" value={Math.round(estimate.proteinG)} unit="g" />
          <MacroEstimate label="Carbs" value={Math.round(estimate.carbsG)} unit="g" />
          <MacroEstimate label="Fat" value={Math.round(estimate.fatG)} unit="g" />
        </dl>
        {summary.provisionalItemCount > 0 && <p className="mt-4 border-t border-brand-border pt-3 text-xs leading-relaxed text-brand-muted">
          {Math.round(summary.provisionalCalories)} kcal remains provisional. Saving does not request RND feedback.
        </p>}
        {summary.unresolvedItemCount > 0 && <p className="mt-3 text-xs text-status-pending-text">
          {summary.unresolvedItemCount} unresolved item(s) are excluded from this partial total.
        </p>}
      </section>

      <section aria-labelledby="food-preview-basis">
        <h3 id="food-preview-basis" className="font-display text-base font-bold text-brand-text">Where the values come from</h3>
        {hasAi && <p className="mt-1 text-sm leading-relaxed text-brand-muted">AI values are estimates, not a cited nutrition lookup.</p>}
        <ul className="mt-2 divide-y divide-brand-border">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="space-y-2 py-4" data-nutrition-source={item.source}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="break-words text-sm font-bold text-brand-text">{formatMealTitle(item.name)}</h4>
                  <p className={`mt-1 text-xs font-semibold ${item.source === 'GEMINI_ESTIMATED' ? 'text-status-pending-text' : 'text-brand-muted'}`}>{sourceLabels[item.source]}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-text">{item.includedInTotals ? `${Math.round(item.calories)} kcal` : 'Not counted'}</span>
              </div>
              <p className="text-xs leading-relaxed text-brand-muted">{sourceNotes[item.source]}</p>
              {item.portionGrams != null && item.portionGrams > 0 ? <p className="text-xs text-brand-muted">Entered portion: {item.portionGrams} g</p>
                : item.servingDescription ? <p className="text-xs text-brand-muted">Serving: {item.servingDescription}</p>
                : item.source === 'GEMINI_ESTIMATED' && <p className="text-xs text-brand-muted">No measured grams provided; a typical serving was assumed.</p>}
              {item.includedInTotals && <p className="text-xs tabular-nums text-brand-muted">Protein {Math.round(item.proteinG)}g · Carbs {Math.round(item.carbsG)}g · Fat {Math.round(item.fatG)}g</p>}
              {item.calorieLow !== null && item.calorieHigh !== null && <p className="text-xs tabular-nums text-brand-muted">Estimated range: {Math.round(item.calorieLow)}–{Math.round(item.calorieHigh)} kcal</p>}
            </li>
          ))}
        </ul>
      </section>

      {props.warning.reasons.length > 0 && <FeedbackNotice tone="warning">
        <h3 className="font-display text-sm font-bold">Before you save</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed">
          {[...new Set(props.warning.reasons)].map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </FeedbackNotice>}

      <div className="space-y-4 border-t border-brand-border pt-5">
        <p className="text-sm leading-relaxed text-brand-muted">Save these values for tracking. A nutrition estimate does not establish whether a food is suitable for your condition or allergies.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" className="min-h-11 flex-1 text-sm" onClick={props.onWarningCancel} disabled={props.isLoading}>Edit food</Button>
          <Button variant="primary" className="min-h-11 flex-1 text-sm" onClick={() => props.onSubmit(true)} isLoading={props.isLoading}>Save food</Button>
        </div>
        <OutsideReviewRequestButton busy={props.isLoading} onRequest={() => props.onSubmit(true, undefined, true)} />
      </div>
    </div>
  );
}

function MacroEstimate({ label, value, unit }: { label: string; value: number; unit: string }) {
  return <div><dt className="text-xs text-brand-muted">{label}</dt><dd className="mt-1 font-display text-xl font-bold tabular-nums text-brand-text">{value}<span className="ml-1 text-xs font-medium text-brand-muted">{unit}</span></dd></div>;
}
