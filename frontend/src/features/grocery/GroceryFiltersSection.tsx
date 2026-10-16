'use client';

import Dropdown from '@/components/ui/Dropdown';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
import { RotateCcw, Search, X } from '@/components/ui/icons';
import type { useGroceryWorkspace } from './useGroceryWorkspace';

type Props = {
  model: Pick<
    ReturnType<typeof useGroceryWorkspace>,
    | 'query'
    | 'setQuery'
    | 'selectedCategory'
    | 'setSelectedCategory'
    | 'totalItems'
    | 'allCategories'
    | 'categoryCounts'
    | 'filter'
    | 'setFilter'
    | 'remainingItems'
    | 'checkedItems'
    | 'visibleItems'
    | 'isFiltered'
    | 'handleResetFilters'
    | 'selectedDay' | 'setSelectedDay' | 'days' | 'dayView' | 'selectedDayData'
  >;
};
export default function GroceryFiltersSection({ model }: Props) {
  const {
    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    totalItems,
    allCategories,
    categoryCounts,
    filter,
    setFilter,
    remainingItems,
    checkedItems,
    visibleItems,
    isFiltered,
    handleResetFilters,
    selectedDay, setSelectedDay, days, dayView, selectedDayData,
  } = model;

  return (
    <>
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
              <Dropdown
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e)}
                aria-label="Filter by department category"
                className="h-10 w-full appearance-none rounded-xl border border-brand-border/70 bg-brand-bgAlt/60 px-3 text-xs font-bold text-brand-text outline-none transition focus:border-brand-green/40 focus:ring-2 focus:ring-brand-green/15 cursor-pointer"
              >
                <option value="ALL">All Departments ({dayView ? selectedDayData?.items.length ?? 0 : totalItems})</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat} ({categoryCounts[cat] || 0})
                  </option>
                ))}
              </Dropdown>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label htmlFor="grocery-day" className="shrink-0 text-sm font-semibold">Ingredients by day</label>
            <Dropdown id="grocery-day" value={selectedDay} onChange={value => {
              setSelectedDay(value); setFilter('all'); setSelectedCategory('ALL');
            }} className="w-full sm:w-56">
              <option value="ALL">All days · shopping checklist</option>
              {selectedDay !== 'ALL' && !days.some(day => day.date === selectedDay) ? <option value={selectedDay}>{selectedDay} · unavailable</option> : null}
              {days.map(day => <option key={day.date} value={day.date}>{new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${day.date}T00:00:00+08:00`))}</option>)}
            </Dropdown>
          </div>
          {dayView ? <p className="text-sm leading-6 text-brand-muted">
            {selectedDayData ? `${selectedDayData.clearedMealCount} cleared planned meal${selectedDayData.clearedMealCount === 1 ? '' : 's'}. ` : 'This date is not available in the selected cycle. '}
            Day quantities include recorded rice. Pending meals are excluded. Check your pantry before buying; purchase checkmarks and PDF export apply to All days.
          </p> : null}

          {/* Bottom Row: Status Filter Pills & Summary Counter / Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-brand-border/40">
            {!dayView ? <div className="w-full sm:w-auto">
              <WorkspaceTabs
                value={filter}
                onChange={setFilter}
                label="Filter grocery items by status"
                level="secondary"
                items={[
                  { value: 'all', label: 'All Items', count: totalItems },
                  { value: 'remaining', label: 'To Buy', count: remainingItems },
                  { value: 'available', label: 'Have it', count: checkedItems },
                ]}
              />
            </div> : null}

            <div className="flex items-center gap-3 text-[11px] text-brand-muted font-medium">
              <span>
                Showing <strong className="text-brand-text font-bold">{visibleItems.length}</strong>{dayView ? '' : ` of ${totalItems}`}{' '}
                items
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
    </>
  );
}
