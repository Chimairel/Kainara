'use client';

import React, { useState } from 'react';
import { Apple, ChevronDown, Coffee, Drumstick, Egg, Fish, Package, ShoppingBag, Wheat } from 'lucide-react';
import type { GroceryItem } from './current-grocery';
import { getCategoryStyle } from './grocery-display';
import GroceryItemRow from './GroceryItemRow';

interface GroceryCategoryCardProps {
  category: string;
  items: GroceryItem[];
  visibleItems: GroceryItem[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  canCheckItems: boolean;
  onToggleItem: (itemId: string) => Promise<void>;
  onTogglePantry: (itemId: string) => Promise<void>;
}

export default function GroceryCategoryCard({
  category,
  items,
  visibleItems,
  isExpanded,
  onToggleExpand,
  canCheckItems,
  onToggleItem,
  onTogglePantry,
}: GroceryCategoryCardProps) {
  const [showPurchased, setShowPurchased] = useState(false);
  const style = getCategoryStyle(category);
  const completedCount = items.filter((item) => item.isChecked).length;
  const progressPercent = items.length ? Math.round((completedCount / items.length) * 100) : 0;

  // Split visible items into unpurchased and purchased
  const unpurchasedItems = visibleItems.filter((item) => !item.isChecked);
  const purchasedItems = visibleItems.filter((item) => item.isChecked);

  const renderIcon = () => {
    switch (style.iconName) {
      case 'produce':
        return <Apple className="h-5 w-5" />;
      case 'meat':
        return <Drumstick className="h-5 w-5" />;
      case 'seafood':
        return <Fish className="h-5 w-5" />;
      case 'dairy':
        return <Egg className="h-5 w-5" />;
      case 'grains':
        return <Wheat className="h-5 w-5" />;
      case 'beverage':
        return <Coffee className="h-5 w-5" />;
      case 'pantry':
        return <Package className="h-5 w-5" />;
      default:
        return <ShoppingBag className="h-5 w-5" />;
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border/70 bg-brand-surface shadow-xs transition hover:border-brand-green/30">
      {/* Category Card Header */}
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-3 p-4 text-left outline-none transition hover:bg-brand-bgAlt/50 focus-visible:ring-2 focus-visible:ring-brand-green/30"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Department Icon Pill */}
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.badgeBg}`}>
            {renderIcon()}
          </div>

          {/* Department Title & Progress */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate font-display text-sm font-bold text-brand-text">
                {category} <span className="font-sans text-xs font-semibold text-brand-muted">({items.length})</span>
              </h3>
              <span className="shrink-0 font-mono text-[11px] font-bold text-brand-muted">
                {completedCount}/{items.length} bought
              </span>
            </div>

            {/* Completion Progress Bar */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-bgAlt">
              <div
                className="h-full rounded-full bg-brand-green transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Expand / Collapse Chevron */}
        <div className="flex shrink-0 items-center pl-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-bgAlt/60 text-brand-muted transition-colors hover:text-brand-text">
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </span>
        </div>
      </button>

      {/* Expanded Checklist Body */}
      {isExpanded && (
        <div className="border-t border-brand-border/50 bg-brand-bgAlt/20 p-3 sm:p-4 space-y-2.5">
          {/* Active / Unpurchased Items */}
          {unpurchasedItems.length > 0 ? (
            <div className="space-y-2">
              {unpurchasedItems.map((item) => (
                <GroceryItemRow
                  key={item.id}
                  item={item}
                  canCheckItems={canCheckItems}
                  onToggleItem={onToggleItem}
                  onTogglePantry={onTogglePantry}
                />
              ))}
            </div>
          ) : purchasedItems.length > 0 ? (
            <div className="flex items-center justify-center py-4 text-xs font-semibold text-brand-green">
              <span>All {items.length} items acquired in this category ✨</span>
            </div>
          ) : (
            <p className="py-2 text-center text-xs text-brand-muted">No items matching filter.</p>
          )}

          {/* Collapsible Purchased Items Drawer */}
          {purchasedItems.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowPurchased(!showPurchased)}
                className="flex w-full items-center justify-between rounded-xl bg-brand-bgAlt/50 px-3 py-2 text-xs font-bold text-brand-muted hover:text-brand-text transition"
              >
                <span>Purchased items ({purchasedItems.length})</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-150 ${showPurchased ? 'rotate-180' : ''}`}
                />
              </button>

              {showPurchased && (
                <div className="mt-2 space-y-2 border-l-2 border-brand-green/30 pl-2">
                  {purchasedItems.map((item) => (
                    <GroceryItemRow
                      key={item.id}
                      item={item}
                      canCheckItems={canCheckItems}
                      onToggleItem={onToggleItem}
                      onTogglePantry={onTogglePantry}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
