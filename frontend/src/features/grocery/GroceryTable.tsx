'use client';

import WorkspaceTable, { type WorkspaceTableColumn } from '@/components/shared/WorkspaceTable';
import { ArrowDown, ArrowUp, ArrowUpDown, CircleCheckBig } from 'lucide-react';
import { isGroceryItemAvailable, type GroceryItem } from './current-grocery';
import { formatGroceryItemDisplay, getCategoryStyle, normalizeGroceryCategory } from './grocery-display';
import { CircularCheckbox } from '@/components/watermelon/checkbox-14';

export type GrocerySortField = 'name' | 'category' | 'quantity' | 'status';
export type GrocerySortOrder = 'asc' | 'desc';

interface GroceryTableProps {
  items: GroceryItem[];
  canCheckItems: boolean;
  onToggleItem: (itemId: string) => Promise<void>;
  sortField: GrocerySortField;
  sortOrder: GrocerySortOrder;
  onSort: (field: GrocerySortField) => void;
  onToggleAllVisible?: () => void;
  allVisibleChecked?: boolean;
  pendingIds?: ReadonlySet<string>;
  bulkBusy?: boolean;
}

export default function GroceryTable({
  items,
  canCheckItems,
  onToggleItem,
  sortField,
  sortOrder,
  onSort,
  onToggleAllVisible,
  allVisibleChecked = false,
  pendingIds = new Set(),
  bulkBusy = false,
}: GroceryTableProps) {
  const renderSortIndicator = (field: GrocerySortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 text-brand-green dark:text-brand-accent stroke-[2.5]" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 text-brand-green dark:text-brand-accent stroke-[2.5]" />
    );
  };

  const sortHeader = (field: GrocerySortField, label: string) => (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="group flex items-center font-bold text-brand-text hover:text-brand-green transition-colors"
    >
      <span>{label}</span>
      {renderSortIndicator(field)}
    </button>
  );
  const columns: WorkspaceTableColumn<GroceryItem>[] = [
    {
      key: 'availability',
      headerClassName: 'w-12 text-center',
      cellClassName: 'text-center',
      header: onToggleAllVisible ? (
        <CircularCheckbox
          checked={allVisibleChecked}
          onCheckedChange={() => onToggleAllVisible()}
          disabled={!canCheckItems || items.length === 0 || bulkBusy || pendingIds.size > 0}
          aria-label={allVisibleChecked ? 'Mark all visible items as needed' : 'Mark all visible items as available'}
          title={allVisibleChecked ? 'Mark all visible as needed' : 'Mark all visible as available'}
          className="mx-auto"
        />
      ) : null,
      cell: (item) => (
        <CircularCheckbox
          checked={isGroceryItemAvailable(item)}
          onCheckedChange={() => onToggleItem(item.id)}
          disabled={!canCheckItems || bulkBusy || pendingIds.has(item.id)}
          aria-label={
            (isGroceryItemAvailable(item) ? 'Mark as needed: ' : 'Mark as available: ') +
            formatGroceryItemDisplay(item).cleanName
          }
          className="mx-auto"
        />
      ),
    },
    {
      key: 'name',
      header: sortHeader('name', 'Ingredient'),
      headerClassName: 'min-w-[200px] !px-4',
      cellClassName: '!px-4',
      cell: (item) => {
        const display = formatGroceryItemDisplay(item),
          available = isGroceryItemAvailable(item);
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={
                'text-xs sm:text-[13px] font-bold tracking-tight transition-opacity ' +
                (available ? 'line-through opacity-60 decoration-brand-green/50 text-brand-muted' : 'text-brand-text')
              }
            >
              {display.cleanName}
            </span>
            {display.prepNote && (
              <span className="rounded-md bg-brand-bgAlt px-1.5 py-0.5 font-sans text-[9px] font-semibold text-brand-muted">
                {display.prepNote}
              </span>
            )}
            {available && <CircleCheckBig className="inline h-3.5 w-3.5 text-brand-green shrink-0 ml-1" />}
          </div>
        );
      },
    },
    {
      key: 'category',
      header: sortHeader('category', 'Category'),
      headerClassName: 'w-40 sm:w-48',
      cell: (item) => (
        <span
          className={
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ' +
            getCategoryStyle(normalizeGroceryCategory(item.category)).badgeBg
          }
        >
          {normalizeGroceryCategory(item.category)}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: sortHeader('quantity', 'Quantity'),
      headerClassName: 'w-32',
      cell: (item) => (
        <span
          className={
            'inline-flex rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ' +
            (isGroceryItemAvailable(item)
              ? 'bg-brand-bgAlt text-brand-muted/70'
              : 'bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-emerald-300')
          }
        >
          {formatGroceryItemDisplay(item).displayQuantity}
        </span>
      ),
    },
    {
      key: 'usage',
      header: 'Usage',
      headerClassName: 'w-28 text-center',
      cellClassName: 'text-center',
      cell: (item) => (
        <span className="text-[10px] font-medium text-brand-muted whitespace-nowrap">
          {item.sourceMealCount === 1 ? '1 meal' : item.sourceMealCount + ' meals'}
        </span>
      ),
    },
  ];
  const sortableColumns = columns.map((column) => ({
    ...column,
    sortDirection:
      column.key === sortField ? (sortOrder === 'asc' ? ('ascending' as const) : ('descending' as const)) : undefined,
  }));
  return (
    <WorkspaceTable
      label="Grocery items"
      rows={items}
      columns={sortableColumns}
      rowKey={(item) => item.id}
      rowClassName={(item, index) =>
        isGroceryItemAvailable(item)
          ? 'bg-brand-green/[0.025] dark:bg-brand-green/[0.04] text-brand-muted'
          : index % 2 === 0
            ? 'bg-brand-surface hover:bg-brand-green/[0.035] dark:hover:bg-white/[0.025]'
            : 'bg-brand-bgAlt/25 hover:bg-brand-green/[0.035] dark:hover:bg-white/[0.025]'
      }
      footer={
        <>
          <span>
            Showing <strong className="text-brand-text">{items.length}</strong> items
          </span>
          <span className="font-mono text-[10px]">
            {items.filter(isGroceryItemAvailable).length} ready ·{' '}
            {items.filter((item) => !isGroceryItemAvailable(item)).length} to buy
          </span>
        </>
      }
    />
  );
}
