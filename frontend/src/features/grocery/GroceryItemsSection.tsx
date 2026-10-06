'use client';

import GroceryTable from '@/features/grocery/GroceryTable';
import { RotateCcw, Search } from 'lucide-react';
import type { useGroceryWorkspace } from './useGroceryWorkspace';

type Props = {
  model: Pick<
    ReturnType<typeof useGroceryWorkspace>,
    | 'visibleItems'
    | 'isFiltered'
    | 'handleResetFilters'
    | 'canCheckItems'
    | 'pendingIds'
    | 'bulkBusy'
    | 'handleToggleItem'
    | 'sortField'
    | 'sortOrder'
    | 'handleSort'
    | 'handleToggleAllVisible'
    | 'allVisibleChecked'
  >;
};
export default function GroceryItemsSection({ model }: Props) {
  const {
    visibleItems,
    isFiltered,
    handleResetFilters,
    canCheckItems,
    pendingIds,
    bulkBusy,
    handleToggleItem,
    sortField,
    sortOrder,
    handleSort,
    handleToggleAllVisible,
    allVisibleChecked,
  } = model;

  return (
    <>
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
          pendingIds={pendingIds}
          bulkBusy={bulkBusy}
          onToggleItem={handleToggleItem}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          onToggleAllVisible={handleToggleAllVisible}
          allVisibleChecked={allVisibleChecked}
        />
      )}
    </>
  );
}
