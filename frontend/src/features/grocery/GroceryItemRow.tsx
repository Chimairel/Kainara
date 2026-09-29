'use client';

import React from 'react';
import { Archive, Check, CircleCheckBig } from 'lucide-react';
import type { GroceryItem } from './current-grocery';
import { formatGroceryItemDisplay } from './grocery-display';
import PurchaseAmountEditor from './PurchaseAmountEditor';

interface GroceryItemRowProps {
  item: GroceryItem;
  canCheckItems: boolean;
  onToggleItem: (itemId: string) => Promise<void>;
  onTogglePantry: (itemId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export default function GroceryItemRow({
  item,
  canCheckItems,
  onToggleItem,
  onTogglePantry,
  onRefresh,
}: GroceryItemRowProps) {
  const display = formatGroceryItemDisplay(item);

  return (
    <div
      className={`group flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 transition-all duration-150 ${
        item.isChecked
          ? 'border-brand-green/15 bg-brand-green/[0.035] text-brand-muted'
          : 'border-brand-border/65 bg-brand-surface text-brand-text hover:border-brand-green/30 hover:shadow-xs'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Large Ergonomic Checkbox */}
        <button
          type="button"
          onClick={() => onToggleItem(item.id)}
          disabled={!canCheckItems}
          aria-pressed={item.isChecked}
          aria-label={`${item.isChecked ? 'Reset purchased amount for' : 'Mark fully purchased:'} ${display.cleanName}`}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
            item.isChecked
              ? 'border-brand-green bg-brand-green text-white shadow-xs'
              : 'border-brand-border bg-brand-bgAlt group-hover:border-brand-green/50'
          }`}
        >
          {item.isChecked && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
        </button>

        {/* Ingredient Title & Details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`text-xs sm:text-sm font-bold leading-snug tracking-tight ${
                item.isChecked ? 'line-through opacity-60 decoration-brand-green/50' : 'text-brand-text'
              }`}
            >
              {display.cleanName}
            </span>

            {/* Prep Note Pill (e.g. minced, diced, grated) */}
            {display.prepNote && (
              <span className="rounded-md bg-brand-bgAlt px-1.5 py-0.5 text-[9px] font-semibold text-brand-muted">
                {display.prepNote}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {/* Sensible Quantity Badge */}
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                item.isChecked
                  ? 'bg-brand-bgAlt text-brand-muted/70'
                  : 'bg-brand-green/10 text-brand-green dark:bg-brand-green/20 dark:text-emerald-300'
              }`}
            >
              {display.displayQuantity}
            </span>

            {/* Recipe Usage Tag */}
            <span className="text-[10px] font-medium text-brand-muted">
              {display.recipeBadge}
            </span>

            {/* Partial Purchase Info */}
            {item.purchasedQuantity && item.purchasedQuantity > 0 && !item.isChecked ? (
              <span className="text-[10px] font-semibold text-brand-accent">
                · {item.purchasedQuantity} {item.unit || ''} bought
              </span>
            ) : null}
          </div>

          {/* Amount Editor for measured ingredients */}
          {item.quantity !== null && canCheckItems && (
            <div className="mt-1">
              <PurchaseAmountEditor item={item} onSaved={onRefresh} />
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onTogglePantry(item.id)}
          disabled={!canCheckItems}
          aria-pressed={item.isPantryStaple}
          title={item.isPantryStaple ? 'Marked as in pantry' : 'Mark as in pantry (have at home)'}
          className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            item.isPantryStaple
              ? 'bg-brand-green text-white shadow-xs'
              : 'bg-brand-bgAlt text-brand-muted hover:bg-brand-green/10 hover:text-brand-green'
          }`}
        >
          <Archive className="h-3 w-3" />
          <span className="hidden sm:inline">Pantry</span>
        </button>

        {item.isChecked && (
          <CircleCheckBig className="h-4 w-4 text-brand-green shrink-0" aria-label="Checked" />
        )}
      </div>
    </div>
  );
}
