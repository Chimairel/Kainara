'use client';

import React, { useEffect, useState } from 'react';
import type { NutritionReport } from '@/types';
import { formatManilaDate } from '@/lib/manila-date';
import { Check, Download, FileText, Loader2, MoreVertical, ShieldCheck } from 'lucide-react';

export interface ReportVersion {
  id: string;
  version: number;
  generatedAt: string;
  content: NutritionReport;
  policyVersion?: string | null;
  acknowledgedAt?: string | null;
  profileSnapshot?: {
    profile?: { goal?: string; dailyCalorieTarget?: number };
    conditions?: string[];
    allergens?: string[];
    otherConditions?: string[] | string;
    otherAllergies?: string[] | string;
  };
}

export interface ReportHistoryProps {
  history: ReportVersion[];
  currentVersion?: number;
  selectedVersionNumber?: number;
  onSelectVersion?: (version: ReportVersion) => void;
  onDownloadVersion?: (version: ReportVersion) => void;
  onSetAsCurrent?: (version: ReportVersion) => void;
  isDownloadingPdf?: boolean;
  downloadingVersion?: number | null;
  borderless?: boolean;
}

export default function ReportHistory({
  history,
  currentVersion,
  selectedVersionNumber,
  onSelectVersion,
  onDownloadVersion,
  onSetAsCurrent,
  isDownloadingPdf = false,
  downloadingVersion = null,
  borderless = false,
}: ReportHistoryProps) {
  const [openMenuVersion, setOpenMenuVersion] = useState<number | null>(null);

  useEffect(() => {
    if (openMenuVersion === null) return;
    const handleClickOutside = () => setOpenMenuVersion(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuVersion(null);
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuVersion]);

  if (borderless) {
    return (
      <nav aria-label="Nutrition report history" className="flex h-full w-full min-w-0 flex-col">
        {/* Queue-style header card matching nutritionist review workspace */}
        <div className="shrink-0 mb-3 rounded-2xl border border-brand-border/80 bg-brand-surface/90 p-4 sm:p-5 text-brand-text shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-green">
              Saved guidance
            </span>
            <span className="rounded-md border border-brand-border/80 bg-brand-bgAlt/60 px-2 py-0.5 text-[10px] font-semibold text-brand-muted">
              {history.length} {history.length === 1 ? 'version' : 'versions'}
            </span>
          </div>
          <div className="mt-2">
            <h2 className="font-display text-lg font-black tracking-tight text-brand-text">Report history</h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-brand-muted">
            Select a version to inspect guidance. Older versions reflect saved health records.
          </p>
        </div>

        {/* History list */}
        {!history.length ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 rounded-2xl border border-dashed border-brand-border/80 bg-brand-surface/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent/10 text-brand-accent shadow-inner">
              <FileText className="w-6 h-6 stroke-[2]" />
            </div>
            <div className="space-y-1">
              <p className="font-display text-sm font-extrabold text-brand-text">No saved reports</p>
              <p className="text-xs text-brand-muted max-w-xs leading-relaxed">
                No previous reports saved in your history.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
            {history.map((entry) => {
              const isSelected = selectedVersionNumber === entry.version;
              const isCurrent = currentVersion !== undefined && entry.version === currentVersion;
              const isMenuOpen = openMenuVersion === entry.version;
              const isDownloadingThis = Boolean(isDownloadingPdf && downloadingVersion === entry.version);

              const targets = entry.content?.planningTargets;
              const calTarget = targets?.calories ?? entry.profileSnapshot?.profile?.dailyCalorieTarget;
              const goal = targets?.goal ?? entry.profileSnapshot?.profile?.goal;

              return (
                <div
                  key={entry.id}
                  className={`group relative flex flex-col rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-150 ${
                    isSelected
                      ? 'border-brand-green/60 bg-brand-green/[0.05] shadow-md ring-1 ring-brand-green/30 dark:border-brand-green/50 dark:bg-brand-green/[0.08]'
                      : 'border-brand-border/70 bg-brand-surface/85 hover:border-brand-border hover:bg-brand-surface'
                  }`}
                >
                  {/* Top Row: Icon, Title, Current Badge, Date, and 3-dots button */}
                  <div className="flex items-start justify-between gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => onSelectVersion?.(entry)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded-xl"
                      aria-current={isSelected ? 'true' : undefined}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                          isSelected
                            ? 'border-brand-green/40 bg-brand-green/10 text-brand-green'
                            : isCurrent
                              ? 'border-brand-green/30 bg-brand-green/10 text-brand-green'
                              : 'border-brand-border/60 bg-brand-bgAlt/80 text-brand-muted group-hover:border-brand-accent/40 group-hover:text-brand-accent'
                        }`}
                      >
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-extrabold tracking-tight text-brand-text">
                            Version {entry.version}
                          </span>
                          {isCurrent && (
                            <span className="rounded-md border border-brand-green/35 bg-brand-green/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-green">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-brand-muted truncate">
                          {formatManilaDate(entry.generatedAt, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </button>

                    {/* 3 vertical dots menu */}
                    <div className="relative shrink-0 ml-1">
                      <button
                        type="button"
                        aria-label={`Options for version ${entry.version}`}
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuVersion(isMenuOpen ? null : entry.version);
                        }}
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-brand-muted transition hover:border-brand-border hover:bg-brand-bgAlt hover:text-brand-text focus-visible:ring-2 focus-visible:ring-brand-accent ${
                          isMenuOpen ? 'border-brand-border bg-brand-bgAlt text-brand-text' : ''
                        }`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {isMenuOpen && (
                        <div
                          role="menu"
                          aria-orientation="vertical"
                          className="absolute right-0 top-full mt-1.5 z-40 w-44 rounded-2xl border border-brand-border/80 bg-brand-surface p-1.5 text-xs shadow-xl backdrop-blur-xl animate-in fade-in-50 zoom-in-95"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            disabled={isDownloadingThis}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuVersion(null);
                              onDownloadVersion?.(entry);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 font-semibold text-brand-text transition hover:bg-brand-bgAlt hover:text-brand-accent disabled:opacity-50"
                          >
                            {isDownloadingThis ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-muted" />
                            ) : (
                              <Download className="h-3.5 w-3.5 text-brand-muted" />
                            )}
                            <span>{isDownloadingThis ? 'Downloading...' : 'Download PDF'}</span>
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            disabled={isCurrent}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuVersion(null);
                              onSetAsCurrent?.(entry);
                            }}
                            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 font-semibold transition ${
                              isCurrent
                                ? 'cursor-not-allowed text-brand-muted opacity-60'
                                : 'text-brand-text hover:bg-brand-bgAlt hover:text-brand-accent'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5 text-brand-green" />
                            <span>{isCurrent ? 'Current version' : 'Set as current'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Macro pills and goal summary */}
                  <div
                    onClick={() => onSelectVersion?.(entry)}
                    className="cursor-pointer"
                  >
                    {calTarget != null && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2 py-0.5 text-[9px] font-bold text-brand-text dark:border-white/10 dark:bg-white/[0.06]">
                          🔥 {Math.round(calTarget)} kcal
                        </span>
                        {targets?.proteinG != null && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#08705b]/20 bg-[#08705b]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#08705b] dark:border-[#10b981]/30 dark:bg-[#10b981]/15 dark:text-[#34d399]">
                            {Math.round(targets.proteinG)}g P
                          </span>
                        )}
                        {targets?.carbsG != null && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#18b9d2]/20 bg-[#18b9d2]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#0b7788] dark:border-[#38bdf8]/30 dark:bg-[#38bdf8]/15 dark:text-[#38bdf8]">
                            {Math.round(targets.carbsG)}g C
                          </span>
                        )}
                        {targets?.fatG != null && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#eb6a38]/20 bg-[#eb6a38]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#c74614] dark:border-[#eb6a38]/30 dark:bg-[#eb6a38]/15 dark:text-[#f09e6c]">
                            {Math.round(targets.fatG)}g F
                          </span>
                        )}
                      </div>
                    )}

                    {goal && (
                      <p className="mt-1.5 text-[10px] font-semibold text-brand-muted capitalize truncate">
                        Goal: {goal.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Explanatory helper tile */}
            <div className="mt-3 rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 p-3.5 text-xs text-brand-muted space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-brand-text text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-green" />
                Immutable Health Records
              </div>
              <p className="text-[10px] leading-relaxed">
                Each guidance revision preserves your targets and dietary evidence at that point in time. Historical records remain locked for clinical safety.
              </p>
            </div>
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
              <strong>
                {item.heading}: {item.value}.
              </strong>{' '}
              {item.explanation}{' '}
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
