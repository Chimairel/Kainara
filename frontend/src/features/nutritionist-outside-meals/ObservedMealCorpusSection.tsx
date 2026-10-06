'use client';
import Dropdown from '@/components/ui/Dropdown';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

import Skeleton from '@/components/ui/Skeleton';

import type { useOutsideMealReviewsPanelModel } from './useOutsideMealReviewsPanelModel';
type Model = Extract<ReturnType<typeof useOutsideMealReviewsPanelModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'isLoading'
    | 'submissions'
    | 'selectObserved'
    | 'observed'
    | 'observedKind'
    | 'setObservedKind'
    | 'canonicalName'
    | 'setCanonicalName'
    | 'ingredientLines'
    | 'setIngredientLines'
    | 'preparation'
    | 'setPreparation'
    | 'applicableTypes'
    | 'setApplicableTypes'
    | 'busy'
    | 'admitObserved'
  >;
};
export default function ObservedMealCorpusSection({ model }: SectionProps) {
  const {
    isLoading,
    submissions,
    selectObserved,
    observed,
    observedKind,
    setObservedKind,
    canonicalName,
    setCanonicalName,
    ingredientLines,
    setIngredientLines,
    preparation,
    setPreparation,
    applicableTypes,
    setApplicableTypes,
    busy,
    admitObserved,
  } = model;

  return (
    <>
      <section className="space-y-4 pt-6 border-t border-brand-border/60" aria-label="Observed food admissions">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-green">
            Clinical knowledge base
          </span>
          <h2 className="font-display text-xl font-black text-brand-text">Consented food observations</h2>
          <p className="mt-1 text-xs text-brand-muted max-w-2xl">
            Only current, confirmed estimates with explicit member permission appear here. Admission creates a reference
            or an unverified recipe candidate; it never certifies a meal.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <Card className="space-y-3 p-5 rounded-2xl border border-brand-border/70 shadow-xs">
            <h3 className="font-display text-sm font-bold text-brand-text mb-2">
              Observations awaiting classification
            </h3>
            {isLoading ? (
              <div className="space-y-2.5">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-brand-border/60 p-3 space-y-1.5">
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                ))}
              </div>
            ) : submissions.length === 0 ? (
              <p className="text-xs text-brand-muted italic py-4">No observations awaiting classification.</p>
            ) : (
              submissions.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => selectObserved(row)}
                  className={`block w-full rounded-xl border p-3.5 text-left text-xs transition-all ${
                    observed?.id === row.id
                      ? 'border-brand-green bg-brand-green/10 shadow-xs'
                      : 'border-brand-border/80 bg-brand-surface hover:border-brand-green/40 hover:bg-brand-bgAlt/50'
                  }`}
                >
                  <strong className="block text-brand-text">
                    {row.sourceOutsideMealItem?.name ?? 'Source no longer available'}
                  </strong>
                  <span className="mt-1 block text-brand-muted">
                    {row.sourceOutsideMealItem?.portionGrams ?? 'Unknown'} g · revision {row.sourceRevision}
                  </span>
                </button>
              ))
            )}
          </Card>

          <Card className="space-y-4 p-5 rounded-2xl border border-brand-border/70 shadow-xs">
            <h3 className="font-display text-sm font-bold text-brand-text">Classification details</h3>
            {!observed ? (
              <p className="text-xs text-brand-muted italic py-4">Select a consented observation above to classify.</p>
            ) : (
              <>
                <div className="rounded-xl border border-brand-border/70 bg-brand-bgAlt/60 p-3 text-xs text-brand-muted">
                  <span className="font-bold text-brand-text">{observed.sourceOutsideMealItem?.calories} kcal</span> · P{' '}
                  {observed.sourceOutsideMealItem?.proteinG}g · C {observed.sourceOutsideMealItem?.carbsG}g · F{' '}
                  {observed.sourceOutsideMealItem?.fatG}g.
                  <p className="mt-1 text-[11px]">Source identity and private notes are excluded.</p>
                </div>
                <label className="block text-xs font-bold text-brand-text">
                  Outcome
                  <Dropdown
                    value={observedKind}
                    onChange={(event) => setObservedKind(event as typeof observedKind)}
                    className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-xs text-brand-text focus:border-brand-green focus:outline-none"
                  >
                    <option value="FOOD_REFERENCE">Observed food reference</option>
                    <option value="RECIPE_CANDIDATE">Reproducible recipe candidate</option>
                  </Dropdown>
                </label>
                <label className="block text-xs font-bold text-brand-text">
                  Deidentified canonical name
                  <input
                    value={canonicalName}
                    onChange={(event) => setCanonicalName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-xs text-brand-text focus:border-brand-green focus:outline-none"
                  />
                </label>
                {observedKind === 'RECIPE_CANDIDATE' && (
                  <>
                    <label className="block text-xs font-bold text-brand-text">
                      Ingredients, one per line: name | quantity | unit
                      <textarea
                        value={ingredientLines}
                        onChange={(event) => setIngredientLines(event.target.value)}
                        className="mt-1 min-h-24 w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-xs text-brand-text focus:border-brand-green focus:outline-none"
                      />
                    </label>
                    <label className="block text-xs font-bold text-brand-text">
                      Preparation method
                      <textarea
                        value={preparation}
                        onChange={(event) => setPreparation(event.target.value)}
                        className="mt-1 min-h-24 w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-xs text-brand-text focus:border-brand-green focus:outline-none"
                      />
                    </label>
                    <div className="flex gap-4">
                      {['BREAKFAST', 'LUNCH', 'DINNER'].map((type) => (
                        <label key={type} className="flex items-center gap-1.5 text-xs font-medium text-brand-text">
                          <input
                            type="checkbox"
                            checked={applicableTypes.includes(type)}
                            onChange={(event) =>
                              setApplicableTypes((previous) =>
                                event.target.checked ? [...previous, type] : previous.filter((value) => value !== type)
                              )
                            }
                            className="rounded border-brand-border text-brand-green focus:ring-brand-green"
                          />
                          {type.toLowerCase()}
                        </label>
                      ))}
                    </div>
                  </>
                )}
                <Button
                  disabled={canonicalName.trim().length < 2 || busy}
                  isLoading={busy}
                  onClick={() => void admitObserved()}
                  className="w-full sm:w-auto"
                >
                  Admit deidentified {observedKind === 'FOOD_REFERENCE' ? 'reference' : 'candidate'}
                </Button>
              </>
            )}
          </Card>
        </div>
      </section>
    </>
  );
}
