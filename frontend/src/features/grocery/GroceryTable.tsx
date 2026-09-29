'use client';

import React from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CircleCheckBig,
} from 'lucide-react';
import type { GroceryItem } from './current-grocery';
import { formatGroceryItemDisplay, getCategoryStyle } from './grocery-display';
import PurchaseAmountEditor from './PurchaseAmountEditor';

export type GrocerySortField = 'name' | 'category' | 'quantity' | 'status';
export type GrocerySortOrder = 'asc' | 'desc';

interface GroceryTableProps {
  items: GroceryItem[];
  canCheckItems: boolean;
  onToggleItem: (itemId: string) => Promise<void>;
  onTogglePantry: (itemId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  sortField: GrocerySortField;
  sortOrder: GrocerySortOrder;
  onSort: (field: GrocerySortField) => void;
  onToggleAllVisible?: () => void;
  allVisibleChecked?: boolean;
}

export default function GroceryTable({
  items,
  canCheckItems,
  onToggleItem,
  onTogglePantry,
  onRefresh,
  sortField,
  sortOrder,
  onSort,
  onToggleAllVisible,
  allVisibleChecked = false,
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

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border/70 bg-brand-surface shadow-xs">
      <div className="overflow-x-auto max-h-[720px] scrollbar-thin">
        <table className="w-full text-left text-xs border-collapse">
          {/* Sticky Table Header */}
          <thead className="sticky top-0 z-20 bg-brand-surface/95 dark:bg-[#0e271f]/95 backdrop-blur-md border-b border-brand-border/70 text-[11px] font-bold text-brand-muted select-none">
            <tr>
              {/* Checkbox / Status Column */}
              <th scope="col" className="w-12 px-3 py-3 text-center border-r border-brand-border/40">
                {onToggleAllVisible && (
                  <button
                    type="button"
                    onClick={onToggleAllVisible}
                    disabled={!canCheckItems || items.length === 0}
                    aria-label={allVisibleChecked ? 'Uncheck all visible items' : 'Mark all visible items purchased'}
                    title={allVisibleChecked ? 'Uncheck all visible' : 'Mark all visible as bought'}
                    className={`flex h-5 w-5 mx-auto items-center justify-center rounded-md border transition-all duration-150 disabled:opacity-30 ${
                      allVisibleChecked
                        ? 'border-brand-green bg-brand-green text-white shadow-2xs'
                        : 'border-brand-border bg-brand-bgAlt hover:border-brand-green/50'
                    }`}
                  >
                    {allVisibleChecked && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                  </button>
                )}
              </th>

              {/* Ingredient Name (Sortable) */}
              <th scope="col" className="min-w-[200px] px-4 py-3 border-r border-brand-border/40">
                <button
                  type="button"
                  onClick={() => onSort('name')}
                  className="group flex items-center font-bold text-brand-text hover:text-brand-green transition-colors"
                >
                  <span>Ingredient</span>
                  {renderSortIndicator('name')}
                </button>
              </th>

              {/* Category (Sortable) */}
              <th scope="col" className="w-40 sm:w-48 px-3 py-3 border-r border-brand-border/40">
                <button
                  type="button"
                  onClick={() => onSort('category')}
                  className="group flex items-center font-bold text-brand-text hover:text-brand-green transition-colors"
                >
                  <span>Category</span>
                  {renderSortIndicator('category')}
                </button>
              </th>

              {/* Quantity to Buy (Sortable) */}
              <th scope="col" className="w-32 px-3 py-3 border-r border-brand-border/40">
                <button
                  type="button"
                  onClick={() => onSort('quantity')}
                  className="group flex items-center font-bold text-brand-text hover:text-brand-green transition-colors"
                >
                  <span>Quantity</span>
                  {renderSortIndicator('quantity')}
                </button>
              </th>

              {/* Meal Usage */}
              <th scope="col" className="w-28 px-3 py-3 text-center border-r border-brand-border/40 font-bold text-brand-text">
                <span>Usage</span>
              </th>

              {/* Pantry Status */}
              <th scope="col" className="w-28 px-3 py-3 text-center border-r border-brand-border/40">
                <button
                  type="button"
                  onClick={() => onSort('status')}
                  className="group inline-flex items-center font-bold text-brand-text hover:text-brand-green transition-colors"
                >
                  <span>Pantry</span>
                  {renderSortIndicator('status')}
                </button>
              </th>

              {/* Action / Record Exact Amount */}
              <th scope="col" className="w-24 px-3 py-3 text-right font-bold text-brand-text">
                <span>Action</span>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-brand-border/40 font-medium">
            {items.map((item, idx) => {
              const display = formatGroceryItemDisplay(item);
              const catStyle = getCategoryStyle(item.category || 'Other');

              return (
                <tr
                  key={item.id}
                  className={`group transition-colors duration-100 ${
                    item.isChecked
                      ? 'bg-brand-green/[0.025] dark:bg-brand-green/[0.04] text-brand-muted'
                      : idx % 2 === 0
                        ? 'bg-brand-surface hover:bg-brand-green/[0.035] dark:hover:bg-white/[0.025]'
                        : 'bg-brand-bgAlt/25 hover:bg-brand-green/[0.035] dark:hover:bg-white/[0.025]'
                  }`}
                >
                  {/* Checkbox Column */}
                  <td className="px-3 py-2.5 text-center align-middle border-r border-brand-border/30">
                    <button
                      type="button"
                      onClick={() => onToggleItem(item.id)}
                      disabled={!canCheckItems}
                      aria-pressed={item.isChecked}
                      aria-label={`${item.isChecked ? 'Reset purchased amount for' : 'Mark fully purchased:'} ${display.cleanName}`}
                      className={`flex h-5 w-5 mx-auto items-center justify-center rounded-md border transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                        item.isChecked
                          ? 'border-brand-green bg-brand-green text-white shadow-2xs'
                          : 'border-brand-border bg-brand-bgAlt group-hover:border-brand-green/50'
                      }`}
                    >
                      {item.isChecked && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                    </button>
                  </td>

                  {/* Ingredient Name & Prep Note */}
                  <td className="px-4 py-2.5 align-middle border-r border-brand-border/30">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-xs sm:text-[13px] font-bold tracking-tight transition-opacity ${
                          item.isChecked
                            ? 'line-through opacity-60 decoration-brand-green/50 text-brand-muted'
                            : 'text-brand-text'
                        }`}
                      >
                        {display.cleanName}
                      </span>

                      {display.prepNote && (
                        <span className="rounded-md bg-brand-bgAlt px-1.5 py-0.5 font-sans text-[9px] font-semibold text-brand-muted">
                          {display.prepNote}
                        </span>
                      )}

                      {item.isChecked && (
                        <CircleCheckBig className="inline h-3.5 w-3.5 text-brand-green shrink-0 ml-1" />
                      )}
                    </div>
                  </td>

                  {/* Category Pill Tag */}
                  <td className="px-3 py-2.5 align-middle border-r border-brand-border/30">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${catStyle.badgeBg}`}
                    >
                      {item.category || 'Other'}
                    </span>
                  </td>

                  {/* Quantity to Buy */}
                  <td className="px-3 py-2.5 align-middle border-r border-brand-border/30">
                    <div className="flex flex-col">
                      <span
                        className={`inline-flex items-center self-start rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                          item.isChecked
                            ? 'bg-brand-bgAlt text-brand-muted/70'
                            : 'bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-emerald-300'
                        }`}
                      >
                        {display.displayQuantity}
                      </span>

                      {item.purchasedQuantity && item.purchasedQuantity > 0 && !item.isChecked ? (
                        <span className="mt-0.5 text-[9px] font-semibold text-brand-accent">
                          {item.purchasedQuantity} {item.unit || ''} bought
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Meal Usage */}
                  <td className="px-3 py-2.5 text-center align-middle border-r border-brand-border/30">
                    <span className="text-[10px] font-medium text-brand-muted whitespace-nowrap">
                      {item.sourceMealCount === 1 ? '1 meal' : `${item.sourceMealCount} meals`}
                    </span>
                  </td>

                  {/* Pantry Toggle Button */}
                  <td className="px-3 py-2.5 text-center align-middle border-r border-brand-border/30">
                    <button
                      type="button"
                      onClick={() => onTogglePantry(item.id)}
                      disabled={!canCheckItems}
                      aria-pressed={item.isPantryStaple}
                      aria-label={item.isPantryStaple ? `Mark ${display.cleanName} as need to buy` : `Mark ${display.cleanName} as in pantry`}
                      title={item.isPantryStaple ? 'In pantry (have at home)' : 'Mark as in pantry'}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        item.isPantryStaple
                          ? 'bg-brand-green text-white shadow-2xs'
                          : 'bg-brand-bgAlt text-brand-muted hover:bg-brand-green/10 hover:text-brand-green'
                      }`}
                    >
                      <Archive className="h-3 w-3" />
                      <span>{item.isPantryStaple ? 'Stocked' : 'Pantry'}</span>
                    </button>
                  </td>

                  {/* Record Exact Amount Action */}
                  <td className="px-3 py-2.5 text-right align-middle">
                    {item.quantity !== null && canCheckItems ? (
                      <PurchaseAmountEditor item={item} onSaved={onRefresh} />
                    ) : (
                      <span className="text-[10px] text-brand-muted/60">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer Summary */}
      <div className="flex items-center justify-between border-t border-brand-border/70 bg-brand-bgAlt/30 px-4 py-2.5 text-[11px] font-semibold text-brand-muted">
        <span>
          Showing <strong className="text-brand-text">{items.length}</strong> items
        </span>
        <span className="font-mono text-[10px]">
          {items.filter((i) => i.isChecked).length} bought · {items.filter((i) => !i.isChecked).length} to buy
        </span>
      </div>
    </div>
  );
}
