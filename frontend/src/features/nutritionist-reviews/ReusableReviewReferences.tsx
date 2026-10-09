'use client';
import { formatManilaDate } from '@/lib/manila-date';
import type { DetailData } from './useNutritionistReviews';

/** Saved anonymous facts support a current decision; private source cases are never linked here. */
export default function ReusableReviewReferences({
  references,
}: {
  references: NonNullable<DetailData['reviewReferences']>;
}) {
  return (
    <section className="space-y-3 border-t border-brand-border pt-4" aria-label="Prior review references">
      <h3 className="text-sm font-bold">Prior review references</h3>
      <p className="text-xs text-brand-muted">
        Exact recorded inputs and recipe serving. Review the current case before making a separate decision.
      </p>
      {!references.length && <p className="text-xs text-brand-muted">No matching prior review is available.</p>}
      {references.map((item, index) => (
        <details key={`${item.reviewedAt}-${index}`} className="rounded-xl border border-brand-border p-3">
          <summary className="cursor-pointer text-xs font-bold">
            Approved by {item.reviewerName ? `${item.reviewerName}, RND` : 'an RND with a recorded decision'} ·{' '}
            {formatManilaDate(item.reviewedAt, { dateStyle: 'medium' })}
          </summary>
          {item.plateFacts && (
            <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
              {(
                [
                  ['Energy', item.plateFacts.calories, 'kcal'],
                  ['Protein', item.plateFacts.proteinG, 'g'],
                  ['Carbs', item.plateFacts.carbsG, 'g'],
                  ['Fat', item.plateFacts.fatG, 'g'],
                ] as const
              ).map(([label, value, unit]) => (
                <div key={label}>
                  <dt className="text-brand-muted">{label}</dt>
                  <dd>
                    {value} {unit}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 text-xs text-brand-muted">{item.use}</p>
        </details>
      ))}
    </section>
  );
}
