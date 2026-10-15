'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Search, SlidersHorizontal, ChevronUp, X } from '@/components/ui/icons';
import ReviewNutrientFilters, { nutrientFilterLabels, parseFilterDraft, REVIEW_NUTRIENT_FIELDS, type FilterDraft } from './ReviewNutrientFilters';
import type { useReviewSwap } from './useReviewSwap';

/** Filter drafts leave the current results and comparison intact until applied. */
export default function ReviewSwapFilters({ swap }: { swap: ReturnType<typeof useReviewSwap> }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>(swap.filterDraft ?? {});
  const [search, setSearch] = useState(swap.searchText ?? '');
  const busy = swap.loading || swap.saving;
  const applied = swap.data?.filters ?? {};
  const count = Object.keys(applied).length;
  const valid = parseFilterDraft(draft) !== null;
  const apply = (nextDraft = draft, nextSearch = search) => {
    if (parseFilterDraft(nextDraft) === null) return;
    setExpanded(false);
    void swap.applyFilters(nextDraft, nextSearch);
  };
  const clear = () => { setDraft({}); setSearch(''); apply({}, ''); };
  return <div className="shrink-0 space-y-3 border-b border-brand-border pb-4 pr-6">
    <form className="flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); apply(); }}>
      <div className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-3 focus-within:ring-2 focus-within:ring-brand-green">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-muted" />
        <input aria-label="Search meals or ingredients" value={search} maxLength={100} disabled={busy} onChange={event => setSearch(event.target.value)}
          placeholder="Search meals or ingredients, e.g. pork" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-brand-muted" />
      </div>
      <Button type="button" variant="secondary" size="sm" disabled={busy} aria-expanded={expanded} aria-controls="review-swap-filters"
        onClick={() => setExpanded(previous => !previous)}><SlidersHorizontal aria-hidden="true" className="h-4 w-4" />Filters{count > 0 && ` (${count})`}{expanded && <ChevronUp aria-hidden="true" className="h-4 w-4" />}</Button>
      <Button type="submit" size="sm" disabled={busy || !valid}>Search</Button>
    </form>
    {expanded && <section id="review-swap-filters" aria-label="Replacement filters" className="space-y-3 rounded-xl bg-brand-bgAlt p-4">
      <ReviewNutrientFilters draft={draft} onChange={setDraft} busy={busy} />
      <div className="flex items-center justify-between gap-3">
        <Button size="sm" variant="ghost" disabled={busy} onClick={clear}>Clear all</Button>
        <Button size="sm" disabled={busy || !valid} onClick={() => apply()}>Apply filters</Button>
      </div>
    </section>}
    {(count > 0 || swap.data?.search) && <div className="flex flex-wrap items-center gap-2">
      <ul aria-label="Applied replacement filters" className="flex flex-wrap gap-2">
        {swap.data?.search && <li><button type="button" disabled={busy} aria-label="Remove meal search" onClick={() => { setSearch(''); apply(swap.filterDraft, ''); }} className="flex min-h-8 items-center gap-2 rounded-full bg-brand-green/10 px-3 text-xs text-brand-text disabled:opacity-50">{swap.data.search}<X aria-hidden="true" className="h-3 w-3" /></button></li>}
        {REVIEW_NUTRIENT_FIELDS.filter(([key]) => applied[key]).map(([key, label]) => <li key={key}><button type="button" disabled={busy} aria-label={`Remove applied ${label} filter`}
          onClick={() => { const next = { ...swap.filterDraft }; delete next[key]; setDraft(next); apply(next, swap.searchText); }}
          className="flex min-h-8 items-center gap-2 rounded-full bg-brand-green/10 px-3 text-xs text-brand-text disabled:opacity-50">{nutrientFilterLabels({ [key]: applied[key] }).join(' · ')}<X aria-hidden="true" className="h-3 w-3" /></button></li>)}
      </ul>
      <button type="button" disabled={busy} onClick={clear} className="min-h-8 px-2 text-xs font-semibold text-brand-green underline underline-offset-4 disabled:opacity-50">Clear all</button>
    </div>}
  </div>;
}
