'use client';

import CardDecoration from '@/components/ui/CardDecoration';
import Button from '@/components/ui/Button';
import { Download, Loader2 } from 'lucide-react';
import type { useGroceryWorkspace } from './useGroceryWorkspace';

type Props = {
  model: Pick<
    ReturnType<typeof useGroceryWorkspace>,
    | 'scope'
    | 'projection'
    | 'handleAcknowledgeIncomplete'
    | 'groceryList'
    | 'handleDownloadPDF'
    | 'isDownloadingPdf'
    | 'checkedItems'
    | 'totalItems'
    | 'remainingItems'
    | 'pendingMealCount'
    | 'canCheckItems'
  >;
};
export default function GroceryProgressSection({ model }: Props) {
  const {
    scope,
    projection,
    handleAcknowledgeIncomplete,
    groceryList,
    handleDownloadPDF,
    isDownloadingPdf,
    checkedItems,
    totalItems,
    remainingItems,
    pendingMealCount,
    canCheckItems,
  } = model;
  if (!projection) return null;
  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] sm:rounded-[32px] border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] text-[#0d2820] dark:text-slate-100 shadow-md p-6 sm:p-7">
        {/* Retro Wave Organic Corner Accent (Top Left) */}
        <CardDecoration variant="grocery" />

        {/* Bottom Right Decorative Watermark */}

        {/* Main Content inside Card */}
        <div className="relative z-10 pl-14 sm:pl-24 pr-1 sm:pr-2">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a746a] dark:text-[#8ea79d]">
                {scope === 'CURRENT' ? 'Current cycle' : 'Next cycle'} · {projection.cycle.status.replaceAll('_', ' ')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 dark:border-[#1a5c48] bg-emerald-100/70 dark:bg-[#0e352b] px-3 py-1 text-[10px] font-bold text-emerald-800 dark:text-[#38c172] shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-[#38c172]" />
                {projection.coverage.clearedSlotCount} of {projection.coverage.expectedSlotCount} meal slots included
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
                  variant="secondary"
                  onClick={handleDownloadPDF}
                  disabled={isDownloadingPdf}
                  aria-busy={isDownloadingPdf}
                  className="flex items-center gap-1.5 text-xs font-semibold py-2 px-3.5 bg-white/80 dark:bg-black/40 backdrop-blur-sm border-brand-border/60 hover:bg-brand-surface"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-green dark:text-brand-accent" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-brand-green dark:text-brand-accent" />
                  )}
                  <span>{isDownloadingPdf ? 'Preparing PDF...' : 'Download PDF'}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Progress Headline & Stats */}
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0d2820] dark:text-white">
                  {checkedItems} of {totalItems} items ready
                </h2>
                <span className="font-mono text-sm sm:text-base font-extrabold text-brand-accent">
                  {totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0}%
                </span>
              </div>

              <span className="text-xs font-semibold text-[#5a746a] dark:text-[#8ea79d]">
                {remainingItems === 0 ? 'All ingredients ready' : `${remainingItems} remaining to buy`}
              </span>
            </div>

            {/* Modern Gradient Progress Bar with Subtle Shadow */}
            <div className="mt-3.5 h-3 w-full overflow-hidden rounded-full bg-emerald-950/10 dark:bg-black/40 p-0.5 border border-brand-border/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#eb6a38] via-[#f09e6c] to-[#08705b] transition-all duration-300 shadow-sm"
                style={{
                  width: `${totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0}%`,
                }}
              />
            </div>

            {pendingMealCount > 0 && canCheckItems && (
              <p className="mt-3 text-xs text-status-pending-text font-medium">
                {pendingMealCount} meal slot{pendingMealCount === 1 ? '' : 's'} not yet included ·{' '}
                {projection.actionability.message}
              </p>
            )}
            {!canCheckItems && (
              <p className="mt-3 text-xs text-status-pending-text font-medium">{projection.actionability.message}</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
