'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import GrocerySkeleton from '@/features/grocery/GrocerySkeleton';
import GroceryTable, { type GrocerySortField, type GrocerySortOrder } from '@/features/grocery/GroceryTable';
import KainaraLogo from '@/components/shared/KainaraLogo';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import UnauthorizedState from '@/components/shared/UnauthorizedState';
import { getApiErrorMessage } from '@/lib/api-error';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { fetchGroceryWorkspace, type GroceryWorkspace } from '@/features/grocery/current-grocery';
import { AlertTriangle, ChevronDown, Download, Filter, RotateCcw, Search, X } from 'lucide-react';

type GroceryFilter = 'all' | 'remaining' | 'packed' | 'pantry';

const normalizeCategory = (category?: string) => category?.trim() || 'Other';

export default function GroceryListPage() {
  const { user } = useAuth();
  const ownerId = user?.userId;
  const cachedPage = readSessionResource<GroceryWorkspace>(ownerId, 'user-grocery-workspace');
  const [workspace, setWorkspace] = useState<GroceryWorkspace | null>(cachedPage ?? null);
  const [scope, setScope] = useState<'CURRENT' | 'UPCOMING'>('CURRENT');
  const [isLoading, setIsLoading] = useState(!cachedPage);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GroceryFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortField, setSortField] = useState<GrocerySortField>('status');
  const [sortOrder, setSortOrder] = useState<GrocerySortOrder>('asc');
  const projection = scope === 'CURRENT' ? (workspace?.current ?? null) : (workspace?.upcoming ?? null);
  const groceryList = projection?.groceryList ?? null;
  const pendingMealCount = projection?.coverage.unresolvedSlotCount ?? 0;
  const canCheckItems = Boolean(projection?.actionability.canCheckItems);

  const cachePage = useCallback(
    (nextWorkspace: GroceryWorkspace) => {
      writeSessionResource(ownerId, 'user-grocery-workspace', nextWorkspace);
    },
    [ownerId]
  );

  // Fetches current user grocery list
  const fetchGroceryList = useCallback(async () => {
    setError(null);
    try {
      const snapshot = await fetchGroceryWorkspace();
      setWorkspace(snapshot);
      cachePage(snapshot);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to retrieve grocery list.'));
    } finally {
      setIsLoading(false);
    }
  }, [cachePage]);

  useEffect(() => {
    if (user) {
      fetchGroceryList();
    }
  }, [user, fetchGroceryList]);

  const handleToggleItem = async (itemId: string) => {
    try {
      const response = await api.patch('/user/grocery/items/' + itemId + '/toggle');
      if (response.data?.success) await fetchGroceryList();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save purchase. Refresh the list and try again.'));
    }
  };

  const handleTogglePantry = async (itemId: string) => {
    if (!groceryList) return;
    try {
      await api.patch(`/user/grocery/items/${itemId}/pantry`);
      await fetchGroceryList();
    } catch {
      setError('Could not update the pantry item. Refresh and try again.');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      if (!projection) return;
      const response = await api.get('/user/grocery/pdf', {
        params: { cycleId: projection.cycle.id },
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `KAINARA_Grocery_List_${groceryList?.weekLabel || 'Current'}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('[Grocery] Failed to download PDF:', err);
      alert('Failed to generate PDF. Make sure you have an active grocery list.');
    }
  };

  const handleAcknowledgeIncomplete = async () => {
    if (!projection) return;
    try {
      await api.post(`/user/meals/cycles/${projection.cycle.id}/acknowledge-incomplete`);
      await fetchGroceryList();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not acknowledge this partial grocery list.'));
    }
  };

  const totalItems = groceryList?.groceryItems.length || 0;
  const shoppingItems = groceryList?.groceryItems.filter((item) => !item.isPantryStaple) || [];
  const pantryItems = totalItems - shoppingItems.length;
  const checkedItems = shoppingItems.filter((item) => item.isChecked).length;
  const remainingItems = shoppingItems.length - checkedItems;
  const normalizedQuery = query.trim().toLowerCase();

  const allCategories = useMemo(() => {
    if (!groceryList?.groceryItems) return [];
    const set = new Set<string>();
    groceryList.groceryItems.forEach((item) => {
      set.add(normalizeCategory(item.category));
    });
    return Array.from(set).sort();
  }, [groceryList]);

  const visibleItems = useMemo(() => {
    if (!groceryList?.groceryItems) return [];

    return groceryList.groceryItems
      .filter((item) => {
        const matchesQuery =
          !normalizedQuery ||
          item.ingredientName.toLowerCase().includes(normalizedQuery) ||
          (item.category || '').toLowerCase().includes(normalizedQuery);

        const matchesStatus =
          filter === 'all' ||
          (filter === 'remaining' && !item.isChecked && !item.isPantryStaple) ||
          (filter === 'packed' && item.isChecked && !item.isPantryStaple) ||
          (filter === 'pantry' && item.isPantryStaple);

        const matchesCategory =
          selectedCategory === 'ALL' || normalizeCategory(item.category) === selectedCategory;

        return matchesQuery && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'name') {
          diff = a.ingredientName.localeCompare(b.ingredientName);
        } else if (sortField === 'category') {
          diff = (a.category || '').localeCompare(b.category || '');
        } else if (sortField === 'quantity') {
          diff = (a.quantity ?? 0) - (b.quantity ?? 0);
        } else if (sortField === 'status') {
          diff = Number(a.isChecked) - Number(b.isChecked) || a.ingredientName.localeCompare(b.ingredientName);
        }

        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [groceryList, normalizedQuery, filter, selectedCategory, sortField, sortOrder]);

  const categoryCounts = useMemo(() => {
    if (!groceryList?.groceryItems) return {};
    const counts: Record<string, number> = {};
    groceryList.groceryItems.forEach((item) => {
      const cat = normalizeCategory(item.category);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [groceryList]);

  const isFiltered = query.trim() !== '' || filter !== 'all' || selectedCategory !== 'ALL';

  const handleResetFilters = () => {
    setQuery('');
    setFilter('all');
    setSelectedCategory('ALL');
  };

  const handleSort = (field: GrocerySortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const allVisibleChecked = visibleItems.length > 0 && visibleItems.every((item) => item.isChecked);

  const handleToggleAllVisible = async () => {
    if (!canCheckItems || visibleItems.length === 0) return;
    const targetState = !allVisibleChecked;
    const itemsToUpdate = visibleItems.filter((item) => item.isChecked !== targetState);

    try {
      await Promise.all(
        itemsToUpdate.map((item) => api.patch(`/user/grocery/items/${item.id}/toggle`))
      );
      await fetchGroceryList();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update visible items.'));
    }
  };

  const isReportPending = Boolean(
    (user?.onboardingDone && user?.tosAccepted && !user?.reportAcknowledged) ||
    (error && error.toLowerCase().includes('nutrition report'))
  );

  return (
    <div className="portal-page max-w-5xl text-brand-text">
      {/* HEADER SECTION */}
      <PortalPageHeader
        title="Groceries"
        description="Shopping-cycle totals with purchased amounts and what remains to buy."
        className="mb-6"
        actions={
          groceryList && projection?.actionability.canExportPdf ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 text-xs font-semibold py-2"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {!isLoading && workspace ? (
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-brand-border/70 bg-brand-surface/80 p-1.5">
          {(['CURRENT', 'UPCOMING'] as const).map((value) => {
            const available = value === 'CURRENT' ? workspace.current : workspace.upcoming;
            return (
              <button
                key={value}
                type="button"
                disabled={!available}
                onClick={() => {
                  setScope(value);
                  setQuery('');
                  setFilter('all');
                  setSelectedCategory('ALL');
                }}
                className={`rounded-xl px-4 py-3 text-xs font-bold transition ${
                  scope === value
                    ? 'bg-brand-green text-white shadow-sm'
                    : 'text-brand-muted hover:bg-brand-bgAlt hover:text-brand-text'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {value === 'CURRENT' ? 'Current week' : 'Next week'}
              </button>
            );
          })}
        </div>
      ) : null}

      {error && !error.toLowerCase().includes('nutrition report') ? (
        <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left mb-6">
          <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* GROCERY CONTENT */}
      {isLoading ? (
        <GrocerySkeleton />
      ) : isReportPending ? (
        <UnauthorizedState
          eyebrow="Action Required"
          title="Nutrition Report Pending"
          description="Please review and acknowledge your personalized nutrition report before grocery checklists can be generated."
          action={{
            label: 'View Nutrition Report',
            href: '/profile/nutrition-report',
          }}
        />
      ) : !projection ? (
        <UnauthorizedState
          imageSrc="/logo/verifying.svg"
          imageAlt="Plan preparation"
          eyebrow={scope === 'UPCOMING' ? 'Preparation opens soon' : 'No active cycle'}
          title={scope === 'UPCOMING' ? 'Next Week Is Not Preparing Yet' : 'No Current Grocery Cycle'}
          description={
            scope === 'UPCOMING'
              ? 'The next grocery preview appears automatically when advance meal preparation opens.'
              : 'Your current grocery list will appear when an active meal-plan cycle is available.'
          }
          action={{ label: 'View Meal Plan', href: '/meals' }}
        />
      ) : !groceryList ? (
        <UnauthorizedState
          imageSrc="/logo/verifying.svg"
          imageAlt="Verifying Meals"
          eyebrow={pendingMealCount > 0 ? 'Review in progress' : 'Plan preparation'}
          title={scope === 'UPCOMING' ? 'Next-week Preview Pending' : 'Grocery Checklist Pending'}
          description={
            projection.cycle.status === 'REVALIDATION_REQUIRED'
              ? projection.actionability.message
              : pendingMealCount > 0
                ? `${pendingMealCount} meal slot${pendingMealCount === 1 ? '' : 's'} remain unresolved. Ingredients appear only after each slot clears review.`
                : 'Your checklist will appear automatically when cleared meal ingredients are available.'
          }
          action={{
            label: 'View Meal Plan',
            href: '/meals',
          }}
        />
      ) : (
        <div className="flex flex-col gap-5 text-left">
          {/* REIMAGINED SHOPPING PROGRESS HERO (WITH RETRO WAVE STRIPES & MODERN FEEL) */}
          <section
            className="relative overflow-hidden rounded-[28px] sm:rounded-[32px] border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] text-[#0d2820] dark:text-slate-100 shadow-md p-6 sm:p-7"
          >
            {/* Retro Wave Organic Corner Accent (Top Left) */}
            <div className="pointer-events-none absolute -top-0.5 -left-0.5 h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-tl-[28px] sm:rounded-tl-[32px] z-0">
              <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
                <path d="M0,0 L160,0 C140,40 105,95 40,135 C20,147 0,155 0,155 Z" fill="#eb6a38" />
                <path d="M0,0 L120,0 C105,30 80,72 30,105 C15,115 0,120 0,120 Z" fill="#f09e6c" />
                <path d="M0,0 L78,0 C68,20 50,48 18,70 C8,76 0,80 0,80 Z" className="fill-[#1b4e41] dark:fill-[#164639]" />
              </svg>
            </div>

            {/* Bottom Right Decorative Watermark */}
            <div className="pointer-events-none absolute -bottom-8 -right-8 flex items-center justify-center opacity-10 dark:opacity-15 z-0">
              <KainaraLogo size={140} variant="multicolor" />
            </div>

            {/* Main Content inside Card */}
            <div className="relative z-10 pl-14 sm:pl-24 pr-1 sm:pr-2">
              {/* Header Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a746a] dark:text-[#8ea79d]">
                    {scope === 'CURRENT' ? 'Current cycle' : 'Next cycle'} ·{' '}
                    {projection.cycle.status.replaceAll('_', ' ')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 dark:border-[#1a5c48] bg-emerald-100/70 dark:bg-[#0e352b] px-3 py-1 text-[10px] font-bold text-emerald-800 dark:text-[#38c172] shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-[#38c172]" />
                    {projection.coverage.clearedSlotCount} of {projection.coverage.expectedSlotCount} meals ready
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {projection.actionability.requiresIncompleteAcknowledgment && (
                    <Button variant="secondary" onClick={handleAcknowledgeIncomplete} className="text-xs">
                      Use confirmed subset
                    </Button>
                  )}
                  {groceryList && projection?.actionability.canExportPdf && (
                    <Button
                      variant="outline"
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-1.5 text-xs font-semibold py-2 px-3.5 bg-white/80 dark:bg-black/40 backdrop-blur-sm border-brand-border/60 hover:bg-brand-surface"
                    >
                      <Download className="w-3.5 h-3.5 text-brand-green dark:text-brand-accent" />
                      <span>Download PDF</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Headline & Stats */}
              <div className="mt-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-3">
                    <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0d2820] dark:text-white">
                      {checkedItems} of {shoppingItems.length} items bought
                    </h2>
                    <span className="font-mono text-sm sm:text-base font-extrabold text-brand-accent">
                      {shoppingItems.length > 0 ? Math.round((checkedItems / shoppingItems.length) * 100) : 0}%
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-[#5a746a] dark:text-[#8ea79d]">
                    {remainingItems === 0 ? 'All purchases complete' : `${remainingItems} remaining to buy`}
                  </span>
                </div>

                {/* Modern Gradient Progress Bar with Subtle Shadow */}
                <div className="mt-3.5 h-3 w-full overflow-hidden rounded-full bg-emerald-950/10 dark:bg-black/40 p-0.5 border border-brand-border/30">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#eb6a38] via-[#f09e6c] to-[#08705b] transition-all duration-300 shadow-sm"
                    style={{
                      width: `${shoppingItems.length > 0 ? Math.round((checkedItems / shoppingItems.length) * 100) : 0}%`,
                    }}
                  />
                </div>

                {pendingMealCount > 0 && (
                  <p className="mt-3 text-xs text-status-pending-text font-medium">
                    {pendingMealCount} unresolved meal slot{pendingMealCount === 1 ? '' : 's'} · {projection.actionability.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* SEARCH & FILTERS TOOLBAR */}
          <section className="rounded-[24px] border border-brand-border/70 bg-brand-surface/90 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex flex-col gap-3">
              {/* Top Row: Search Input & Category Dropdown */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Search Bar with Clear Icon */}
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search ingredients, category..."
                    className="h-10 w-full rounded-xl border border-brand-border/70 bg-brand-bgAlt/60 pl-10 pr-9 text-xs font-semibold text-brand-text outline-none transition placeholder:text-brand-muted/70 focus:border-brand-green/40 focus:ring-2 focus:ring-brand-green/15 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-brand-muted hover:text-brand-text transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Dropdown */}
                <div className="relative shrink-0 sm:w-56">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted">
                    <Filter className="h-3.5 w-3.5" />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    aria-label="Filter by department category"
                    className="h-10 w-full appearance-none rounded-xl border border-brand-border/70 bg-brand-bgAlt/60 pl-10 pr-8 text-xs font-bold text-brand-text outline-none transition focus:border-brand-green/40 focus:ring-2 focus:ring-brand-green/15 cursor-pointer"
                  >
                    <option value="ALL">All Departments ({totalItems})</option>
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat} ({categoryCounts[cat] || 0})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>

              {/* Bottom Row: Status Filter Pills & Summary Counter / Reset */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-brand-border/40">
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  aria-label="Filter grocery items by status"
                >
                  {(
                    [
                      ['all', 'All Items', totalItems],
                      ['remaining', 'To Buy', remainingItems],
                      ['packed', 'Bought', checkedItems],
                      ['pantry', 'In Pantry', pantryItems],
                    ] as const
                  ).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      aria-pressed={filter === value}
                      className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition ${
                        filter === value
                          ? 'bg-brand-green text-white shadow-2xs'
                          : 'bg-brand-bgAlt/60 text-brand-muted hover:text-brand-text hover:bg-brand-bgAlt'
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 font-mono text-[9px] ${
                          filter === value
                            ? 'bg-white/20 text-white'
                            : 'bg-brand-border/50 text-brand-muted'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-brand-muted font-medium">
                  <span>
                    Showing <strong className="text-brand-text font-bold">{visibleItems.length}</strong> of{' '}
                    {totalItems} items
                  </span>

                  {isFiltered && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-brand-accent hover:bg-brand-accent/10 transition"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SPREADSHEET DATAGRID TABLE */}
          {visibleItems.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-[24px] border border-dashed border-brand-border bg-brand-surface/45 px-6 text-center">
              <Search className="h-7 w-7 text-brand-muted/60" />
              <p className="mt-3 text-sm font-bold text-brand-text">No ingredients found</p>
              <p className="mt-1 text-xs text-brand-muted max-w-sm">
                No items match your current search query or active filter settings.
              </p>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-green/10 px-4 py-2 text-[11px] font-bold text-brand-green transition hover:bg-brand-green/15"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset all filters</span>
                </button>
              )}
            </div>
          ) : (
            <GroceryTable
              items={visibleItems}
              canCheckItems={canCheckItems}
              onToggleItem={handleToggleItem}
              onTogglePantry={handleTogglePantry}
              onRefresh={fetchGroceryList}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              onToggleAllVisible={handleToggleAllVisible}
              allVisibleChecked={allVisibleChecked}
            />
          )}
        </div>
      )}
    </div>
  );
}
