'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import MealImage from '@/components/user/MealImage';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import { NutritionistCredentialCard } from '@/components/user/NutritionistCredentialCard';
import type { PublicVerifier } from '@/types';
import type { DetailData } from './useNutritionistReviews';
import type { useReviewSwap } from './useReviewSwap';
import IngredientEvidenceTable from './IngredientEvidenceTable';
import ReviewNutrientFilters, { nutrientFilterLabels } from './ReviewNutrientFilters';
import ReviewSwapNutrition from './ReviewSwapNutrition';
import ReviewSwapCandidates from './ReviewSwapCandidates';
import { Search, RefreshCw } from '@/components/ui/icons';
import { formatMealTitle } from '@/lib/meal-title';

/** RND selection and evidence share one workspace; claim/submit state stays in its adapter. */
export default function ReviewSwapDialog({ swap, meal, onNoSuitable, onFindReplacement }: {
  swap: ReturnType<typeof useReviewSwap>; meal: DetailData['mealPlan'];
  onNoSuitable?: () => void; onFindReplacement?: () => void;
}) {
  const [verifier, setVerifier] = useState<PublicVerifier | null>(null);
  const [sort, setSort] = useState<'best_match' | 'kcal_match'>('best_match');
  useEffect(() => setVerifier(null), [meal.id, swap.open, swap.data]);
  const options = swap.data?.options ?? [];
  const hasRanking = options.some(option => option.nutritionFitScore !== undefined);
  const activeSort = hasRanking ? sort : 'kcal_match';
  const selected = swap.selected;
  const busy = swap.loading || swap.interpreting || swap.saving;
  const ordered = activeSort === 'best_match' ? options : [...options].sort(
    (a, b) => Math.abs(a.calories - meal.calories) - Math.abs(b.calories - meal.calories)
  );
  const selectionSummary = (plate: { mealName: string; image?: DetailData['mealPlan']['image']; mealType: string }, label: string) =>
    <div className="flex min-w-0 items-start gap-3">
      <MealImage image={plate.image} mealName={plate.mealName} mealType={plate.mealType} variant="thumbnail"
        className="!h-12 !w-12 shrink-0 !rounded-xl object-cover" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-brand-muted">{label}</p>
        <h3 className="mt-1 break-words font-display text-base font-semibold leading-5">{formatMealTitle(plate.mealName)}</h3>
      </div>
    </div>;
  return <>
    <Modal isOpen={swap.open} onClose={swap.close} layer="canvas" size="4xl" title="Swap meal"
      description="Choose a replacement and compare its nutrients. The meal stays pending for your decision."
      contentClassName="!overflow-hidden !py-0 !pr-0"
      footer={<div className="flex w-full flex-wrap items-end gap-4">
        <label className="min-w-0 flex-1 basis-80 text-xs font-semibold">
          Replacement rationale <span className="font-normal text-brand-muted">· 10 characters minimum</span>
          <textarea value={swap.note} onChange={event => swap.setNote(event.target.value)} disabled={swap.saving}
            rows={2} maxLength={1000} placeholder="Why is this replacement a better fit?"
            className="mt-2 block w-full resize-none rounded-xl border border-brand-border bg-brand-bg p-3 text-sm font-normal outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20" />
        </label>
        <div className="flex shrink-0 gap-3 pb-1">
          <Button variant="secondary" disabled={swap.saving} onClick={swap.close}>Cancel</Button>
          <Button disabled={swap.saving || !selected || swap.note.trim().length < 10}
            isLoading={swap.saving} onClick={() => void swap.submit()}>Confirm swap</Button>
        </div>
      </div>}>
      <div className="grid h-[calc(90dvh-17rem)] min-h-64 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.6fr)] lg:overflow-hidden">
        <section aria-label="Find a replacement" className="min-w-0 space-y-4 pb-5 pr-4 lg:overflow-y-auto lg:border-r lg:border-brand-border/70 custom-scrollbar">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold">Candidates</h3>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void swap.load()} aria-label="Refresh options" title="Refresh options">
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
          {swap.filtersEnabled && <>
            <form className="space-y-2" onSubmit={event => { event.preventDefault(); void swap.interpretAndSearch(); }}>
              <label htmlFor="review-swap-search" className="block text-xs font-semibold">Filter candidates with AI</label>
              <div className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-surface p-2 focus-within:ring-2 focus-within:ring-brand-green">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-muted" />
                <input id="review-swap-search" value={swap.filterText} onChange={event => swap.setFilterText(event.target.value)}
                  maxLength={500} disabled={swap.saving || swap.interpreting} placeholder="e.g. sodium under 500 mg"
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-brand-muted" />
                <Button type="submit" size="sm" disabled={busy || !swap.filterText?.trim()} isLoading={swap.interpreting}>Filter</Button>
              </div>
            </form>
            {!!Object.keys(swap.data?.filters ?? {}).length && <ul aria-label="Applied nutrient limits" className="flex flex-wrap gap-2 text-xs text-brand-green">
              {nutrientFilterLabels(swap.data!.filters!).map(label => <li key={label}>{label}</li>)}
            </ul>}
            <ReviewNutrientFilters draft={swap.filterDraft} onChange={swap.setFilterDraft} apply={() => void swap.load()} busy={busy} />
          </>}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted">
            <p aria-live="polite">{swap.data?.summary ? `${options.length} of ${swap.data.summary.matchedCount} available` : `${options.length} available`}</p>
            <Dropdown aria-label="Sort candidates" value={activeSort} onChange={value => setSort(value as typeof sort)} className="!w-auto !min-h-9 !text-xs">
              {hasRanking && <option value="best_match">Nutrition match</option>}
              <option value="kcal_match">Calorie match</option>
            </Dropdown>
          </div>
          {swap.data?.summary && swap.data.summary.unknownExcludedCount > 0 && <p className="text-xs text-brand-muted">
            {swap.data.summary.unknownExcludedCount} excluded for missing required nutrients.
          </p>}
          {busy && !swap.saving ? <p role="status" className="py-8 text-sm text-brand-muted">Finding replacements…</p>
            : swap.error ? <FeedbackNotice variant="inline">{swap.error}</FeedbackNotice>
            : swap.data && !options.length ? <div className="space-y-3 py-6 text-sm">
              <p className="font-semibold">No replacements match this search.</p>
              <p className="text-brand-muted">Adjust the limits or prepare another candidate for review.</p>
              {onFindReplacement && <Button variant="secondary" disabled={swap.saving} onClick={onFindReplacement}>Reject and find replacement</Button>}
            </div> : <ReviewSwapCandidates options={ordered} selectedId={selected?.id} busy={busy}
              onSelect={swap.setSelectedId} onVerifier={setVerifier} />}
          {swap.data?.nextCursor && <Button size="sm" variant="secondary" disabled={busy}
            onClick={() => void swap.load(swap.data!.nextCursor!)}>Next candidates</Button>}
          {swap.data?.searchReceipt && onNoSuitable && <details className="border-t border-brand-border/60 pt-3 text-xs text-brand-muted">
            <summary className="cursor-pointer">No suitable replacement?</summary>
            <p className="my-3">Record a rejection and stop automatic replacement. A reason is required.</p>
            <Button size="sm" variant="secondary" disabled={busy} onClick={onNoSuitable}>Reject and leave unavailable</Button>
          </details>}
        </section>
        <section aria-label="Selected replacement review" className="min-w-0 space-y-5 pb-5 lg:overflow-y-auto lg:pl-6 custom-scrollbar">
          <div className="grid grid-cols-1 gap-4 border-b border-brand-border/70 pb-4 sm:grid-cols-2">
            {selectionSummary(meal, 'Current meal')}
            {selected ? <div className="space-y-2">
              {selectionSummary(selected, 'Replacement')}
              <button type="button" disabled={swap.saving} onClick={() => swap.setSelectedId('')}
                className="ml-16 min-h-8 text-xs font-semibold text-brand-green underline underline-offset-4">Change selection</button>
            </div> : <p className="self-center text-sm text-brand-muted">Select a candidate to compare.</p>}
          </div>
          {selected ? <>
            <ReviewSwapNutrition before={{ ...meal.nutrients, calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG }}
              after={{ ...selected.nutrients, calories: selected.calories, proteinG: selected.proteinG, carbsG: selected.carbsG, fatG: selected.fatG }}
              targets={meal.nutritionTargets} filters={swap.data?.filters} />
            <details className="border-t border-brand-border/60 pt-3 text-sm">
              <summary className="cursor-pointer font-semibold">Replacement ingredients</summary>
              <div className="mt-3"><IngredientEvidenceTable ingredients={selected.ingredients} /></div>
            </details>
          </> : <div className="py-8 text-sm leading-6 text-brand-muted">
            <p>Compare calories, macros and recorded nutrient targets before choosing a replacement.</p>
            <p className="mt-2">Search limits apply to one meal, including any paired rice.</p>
          </div>}
        </section>
      </div>
    </Modal>
    <Modal isOpen={Boolean(verifier) && swap.open} onClose={() => setVerifier(null)} layer="canvas" size="lg" title="Recorded RND credentials">
      {verifier && <NutritionistCredentialCard verifier={verifier} />}
    </Modal>
  </>;
}
