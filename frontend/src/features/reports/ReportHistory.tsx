'use client';

import React from 'react';
import type { NutritionReport } from '@/types';
import { formatManilaDate } from '@/lib/manila-date';
import { Play } from 'lucide-react';

export interface ReportVersion {
  id: string;
  version: number;
  generatedAt: string;
  content: NutritionReport;
}

export interface ReportHistoryProps {
  history: ReportVersion[];
  currentVersion?: number;
  selectedVersionNumber?: number;
  onSelectVersion?: (version: ReportVersion) => void;
  borderless?: boolean;
}

export default function ReportHistory({
  history,
  currentVersion,
  selectedVersionNumber,
  onSelectVersion,
  borderless = false,
}: ReportHistoryProps) {
  if (borderless) {
    return (
      <nav aria-label="Nutrition report history" className="w-full text-left">
        <h2 className="font-display text-base sm:text-lg font-bold text-foreground tracking-tight">
          Nutrition report history
        </h2>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Saved guidance reflects your information at the time it was generated.
        </p>

        {!history.length ? (
          <p className="mt-4 text-xs text-muted-foreground italic">No saved reports yet.</p>
        ) : (
          <div className="mt-4 space-y-1.5">
            {history.map((entry) => {
              const isSelected = selectedVersionNumber === entry.version;
              const isCurrent = currentVersion !== undefined && entry.version === currentVersion;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectVersion?.(entry)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
                    isSelected
                      ? 'bg-slate-200/80 dark:bg-brand-surface font-semibold text-foreground shadow-sm ring-1 ring-slate-300 dark:ring-brand-border/40'
                      : 'hover:bg-slate-100/90 dark:hover:bg-brand-surface/40 text-foreground/80 font-normal'
                  }`}
                  aria-current={isSelected ? 'true' : undefined}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Play
                      className={`w-2.5 h-2.5 shrink-0 fill-current transition-transform duration-150 ${
                        isSelected
                          ? 'text-brand-accent scale-110'
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-xs sm:text-sm truncate">
                      Version {entry.version} ·{' '}
                      {formatManilaDate(entry.generatedAt, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {isCurrent && (
                    <span className="shrink-0 ml-2 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-accent/20 text-brand-accent">
                      Current
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </nav>
    );
  }

  return (
    <section className="mx-auto my-8 w-full max-w-5xl border-t border-slate-300 dark:border-brand-border/40 pt-5 text-left text-slate-900 dark:text-slate-100">
      <h2 className="font-display text-lg font-bold">Nutrition report history</h2>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        Saved guidance reflects your information at the time it was generated. Older versions may no longer match your
        current needs.
      </p>
      {!history.length && <p className="mt-3 text-sm text-slate-500">No saved reports yet.</p>}
      {history.map((entry) => (
        <details key={entry.id} className="mt-3 border-t border-slate-200 dark:border-brand-border/20 pt-3">
          <summary className="cursor-pointer text-sm font-semibold hover:text-brand-accent transition-colors">
            Version {entry.version} ·{' '}
            {formatManilaDate(entry.generatedAt, { year: 'numeric', month: 'short', day: 'numeric' })}
          </summary>
          <p className="mt-3 text-sm">{entry.content.generalSummary}</p>
          {entry.content.referenceItems?.map((item, index) => (
            <p key={`${item.sourceCode}-${index}`} className="mt-2 text-sm">
              <strong>{item.heading}: {item.value}.</strong> {item.explanation}{' '}
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Source
              </a>
            </p>
          ))}
          {(['foodsToAvoid', 'foodsToLimit', 'foodsRecommended', 'drinksGuidance'] as const).map((key) => (
            <div key={key} className="mt-3 text-sm">
              <p className="font-semibold">
                {
                  {
                    foodsToAvoid: 'Foods to avoid',
                    foodsToLimit: 'Foods to limit',
                    foodsRecommended: 'Recommended foods',
                    drinksGuidance: 'Drinks guidance',
                  }[key]
                }
              </p>
              <ul className="ml-5 list-disc">
                {Array.isArray(entry.content[key]) &&
                  (entry.content[key] as string[]).map((text, index) => <li key={index}>{text}</li>)}
              </ul>
            </div>
          ))}
        </details>
      ))}
    </section>
  );
}
