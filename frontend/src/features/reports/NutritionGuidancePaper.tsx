'use client';

import React from 'react';
import type { NutritionReport } from '@/types';
import { formatManilaDate } from '@/lib/manila-date';

export type GuidanceProfileSnapshot = {
  name: string;
  goal: string;
  dailyCalorieTarget: number | null;
  conditions: string[];
  foodRestrictions: string[];
};

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) =>
        typeof v === 'string'
          ? v
          : typeof v === 'object' && v !== null
            ? (v as { name?: string; title?: string }).name || (v as { title?: string }).title || JSON.stringify(v)
            : String(v)
      )
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parseList(parsed);
    } catch {
      // not json, keep single value
    }
    return [value.trim()];
  }
  return [];
}

export interface NutritionGuidancePaperProps {
  report: NutritionReport;
  profile: GuidanceProfileSnapshot;
  activePlanningVersion?: number | null;
  className?: string;
}

/**
 * HTML preview of the saved guidance, arranged as paper sheets. Server PDF export remains separate.
 */
export default function NutritionGuidancePaper({
  report,
  profile,
  activePlanningVersion = report.planningContext?.activeVersion,
  className = '',
}: NutritionGuidancePaperProps) {
  const prepared = report.generatedAt
    ? formatManilaDate(report.generatedAt, {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not recorded';

  const isPreviouslySelected = Boolean(
    report.acknowledgedAt && activePlanningVersion && activePlanningVersion !== report.version
  );

  const statusText = report.acknowledgedAt
    ? isPreviouslySelected
      ? 'Previously selected for planning'
      : 'Selected for planning'
    : 'Not yet selected for planning';

  const isArchived = Boolean(activePlanningVersion && activePlanningVersion !== report.version);

  const referenceItems = Array.isArray(report.referenceItems) ? report.referenceItems : [];
  const recommendedList = parseList(report.foodsRecommended);
  const limitList = parseList(report.foodsToLimit);
  const avoidList = parseList(report.foodsToAvoid);
  const drinksList = parseList(report.drinksGuidance);

  const isPolicyReport = Boolean(report.reportPolicyVersion && referenceItems.length > 0);
  const totalPages =
    isPolicyReport && referenceItems.length <= 3 && !limitList.length && !avoidList.length && !drinksList.length
      ? 1
      : 2;

  const page1ReferenceItems = isPolicyReport
    ? referenceItems.length <= 3
      ? referenceItems
      : referenceItems.slice(0, 2)
    : [];
  const page2ReferenceItems = isPolicyReport && referenceItems.length > 3 ? referenceItems.slice(2) : [];

  return (
    <article
      aria-label="Nutrition guidance record"
      className={`w-full max-w-[794px] flex flex-col items-center gap-8 break-words [overflow-wrap:break-word] ${className}`}
    >
      {/* ──────────────── PAGE 1 ──────────────── */}
      <div
        data-document-page="1"
        className="relative bg-white text-slate-800 shadow-[0_4px_30px_rgba(0,0,0,0.35)] w-full min-h-[1123px] p-14 flex flex-col justify-between select-text break-words [overflow-wrap:break-word]"
        style={{ minHeight: '1123px' }}
      >
        <div className="space-y-4">
          {/* Header */}
          <header>
            <div className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.2em] text-[#1B4332] uppercase mb-1">
              KAINARA · Personal Record
            </div>
            <h1 className="text-xl sm:text-2xl md:text-[26px] font-bold text-[#1B4332] tracking-tight">
              Nutrition Guidance
            </h1>
            <p className="text-xs sm:text-[13px] text-slate-600 mt-1">
              Version {report.version} | Prepared {prepared} · {statusText}
            </p>
            {isArchived && (
              <p className="text-xs text-amber-700 dark:text-amber-600 mt-1 italic">
                Archived record. This document does not change your current planning guidance.
              </p>
            )}
          </header>

          <hr className="border-t border-[#D8F3DC] my-3 sm:my-4" />

          {/* Profile Details */}
          <section className="space-y-1.5 text-xs sm:text-[13px] text-slate-700">
            <p>
              <strong className="text-slate-900 font-semibold">Name:</strong> {profile.name}
            </p>
            <p>
              <strong className="text-slate-900 font-semibold">Estimated energy target:</strong>{' '}
              <span className="font-semibold text-slate-900">
                {profile.dailyCalorieTarget === null
                  ? 'Not recorded'
                  : `${Number(profile.dailyCalorieTarget).toLocaleString('en-US')} kcal/day`}
              </span>
            </p>
            <p>
              <strong className="text-slate-900 font-semibold">Reported conditions:</strong>{' '}
              <span>
                {profile.conditions.length ? profile.conditions.join(', ').replace(/_/g, ' ') : 'None reported'}
              </span>
            </p>
            <p>
              <strong className="text-slate-900 font-semibold">Reported food restrictions:</strong>{' '}
              <span>
                {profile.foodRestrictions.length
                  ? profile.foodRestrictions.join(', ').replace(/_/g, ' ')
                  : 'None reported'}
              </span>
            </p>
            <p>
              <strong className="text-slate-900 font-semibold">Goal:</strong> {profile.goal.replace(/_/g, ' ')}
            </p>
          </section>

          <hr className="border-t border-[#D8F3DC] my-3 sm:my-4" />

          {/* What these numbers mean */}
          <section className="space-y-1.5 my-3">
            <h2 className="text-sm sm:text-base font-bold text-[#2D6A4F]">What these numbers mean</h2>
            <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">
              {report.generalSummary || 'No summary recorded for this version.'}
            </p>
          </section>

          {/* Daily planning estimates (macro cards) */}
          {report.planningTargets && (
            <section
              role="region"
              aria-label="Daily planning estimates"
              className="my-3 p-3 sm:p-4 rounded-xl border border-[#D8F3DC] bg-[#f7fbf9] space-y-2.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#D8F3DC]">
                <span className="font-bold text-xs sm:text-sm text-[#1B4332]">Daily planning estimates</span>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#1B4332] bg-[#D8F3DC] px-2 py-0.5 rounded">
                  PDRI Aligned
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-white rounded-lg border border-[#D8F3DC]">
                  <div className="text-[10px] text-slate-500 font-medium">Energy</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                    {Math.round(report.planningTargets.calories)} kcal
                  </div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-[#08705b]/30">
                  <div className="text-[10px] text-[#08705b] font-medium">Protein</div>
                  <div className="text-xs sm:text-sm font-bold text-[#08705b] font-mono">
                    {Math.round(report.planningTargets.proteinG)} g
                  </div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-[#0b7788]/30">
                  <div className="text-[10px] text-[#0b7788] font-medium">Carbs</div>
                  <div className="text-xs sm:text-sm font-bold text-[#0b7788] font-mono">
                    {Math.round(report.planningTargets.carbsG)} g
                  </div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-[#c74614]/30">
                  <div className="text-[10px] text-[#c74614] font-medium">Fat</div>
                  <div className="text-xs sm:text-sm font-bold text-[#c74614] font-mono">
                    {Math.round(report.planningTargets.fatG)} g
                  </div>
                </div>
              </div>
              {report.planningTargets.explanation && (
                <p className="text-xs text-slate-600 leading-normal">{report.planningTargets.explanation}</p>
              )}
            </section>
          )}

          {/* Page 1 Reference Items */}
          {page1ReferenceItems.length > 0 && (
            <div className="space-y-4 my-3">
              {page1ReferenceItems.map((item, index) => (
                <div key={index} className="space-y-1">
                  <h3 className="text-sm sm:text-[15px] font-bold text-[#2D6A4F]">
                    {item.heading}: {item.value}
                  </h3>
                  <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">{item.explanation}</p>
                  <p className="text-[11px] sm:text-xs text-slate-600">
                    {item.classification === 'REQUIRES_INDIVIDUAL_REVIEW'
                      ? 'Individual review'
                      : item.classification === 'CALCULATED_REFERENCE'
                        ? 'Calculated population reference'
                        : 'General reference'}{' '}
                    · Source:{' '}
                    {item.sourceUrl?.startsWith('http') ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#2D6A4F] font-semibold hover:underline"
                      >
                        {item.sourceTitle}
                      </a>
                    ) : (
                      <span>{item.sourceTitle}</span>
                    )}
                  </p>
                  {item.sourceUrl?.startsWith('http') && (
                    <p className="text-[11px] sm:text-xs text-slate-500 break-all">
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-[#2D6A4F]"
                      >
                        {item.sourceUrl}
                      </a>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Legacy Food Lists on Page 1 if not policy report */}
          {recommendedList.length > 0 && (
            <div className="space-y-2 my-3">
              <h3 className="text-sm font-bold text-[#2D6A4F]">Recommended Foods</h3>
              <ul className="text-xs sm:text-[13px] text-slate-700 space-y-1 list-disc list-inside">
                {recommendedList.map((food, i) => (
                  <li key={i}>{food}</li>
                ))}
              </ul>
            </div>
          )}

          {/* If single page, render the acknowledgment note at the bottom of Page 1 */}
          {totalPages === 1 && (
            <div className="mt-6 pt-4 border-t border-[#D8F3DC]">
              <p className="text-xs sm:text-[12px] text-slate-600 leading-relaxed">
                Acknowledgment records review of this document. Meal eligibility and RND review are separate checks.
                This educational guidance does not replace individualized medical advice, clinical diagnosis, or medical
                nutrition therapy from a licensed physician or RND.
              </p>
            </div>
          )}
        </div>

        {/* Page 1 Bottom Bar / Footer */}
        {totalPages === 1 ? (
          <footer className="pt-6 mt-8 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono select-none">
            <span>KAINARA Personal Health Record</span>
            <span>Page 1 of 1</span>
          </footer>
        ) : (
          <div className="pt-6 mt-8 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono select-none">
            <span>KAINARA Personal Health Record</span>
            <span>Page 1 of {totalPages}</span>
          </div>
        )}
      </div>

      {/* ──────────────── PAGE 2 (if needed) ──────────────── */}
      {totalPages > 1 && (
        <div
          data-document-page="2"
          className="relative bg-white text-slate-800 shadow-[0_4px_30px_rgba(0,0,0,0.35)] w-full min-h-[1123px] p-14 flex flex-col justify-between select-text break-words [overflow-wrap:break-word]"
          style={{ minHeight: '1123px' }}
        >
          <div className="space-y-4">
            {/* Page 2 Header */}
            <header className="border-b border-[#D8F3DC] pb-3">
              <div className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.2em] text-[#1B4332] uppercase mb-1">
                KAINARA · Personal Record (Continued)
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#1B4332] tracking-tight">
                Nutrition Guidance · Version {report.version}
              </h2>
            </header>

            {/* Overflowing Reference Items on Page 2 */}
            {page2ReferenceItems.length > 0 && (
              <div className="space-y-4 my-4">
                {page2ReferenceItems.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <h3 className="text-sm sm:text-[15px] font-bold text-[#2D6A4F]">
                      {item.heading}: {item.value}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">{item.explanation}</p>
                    <p className="text-[11px] sm:text-xs text-slate-600">
                      {item.classification === 'REQUIRES_INDIVIDUAL_REVIEW'
                        ? 'Individual review'
                        : item.classification === 'CALCULATED_REFERENCE'
                          ? 'Calculated population reference'
                          : 'General reference'}{' '}
                      · Source:{' '}
                      {item.sourceUrl?.startsWith('http') ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2D6A4F] font-semibold hover:underline"
                        >
                          {item.sourceTitle}
                        </a>
                      ) : (
                        <span>{item.sourceTitle}</span>
                      )}
                    </p>
                    {item.sourceUrl?.startsWith('http') && (
                      <p className="text-[11px] sm:text-xs text-slate-500 break-all">
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline hover:text-[#2D6A4F]"
                        >
                          {item.sourceUrl}
                        </a>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Legacy Food Lists on Page 2 */}
            {
              <div className="space-y-4 my-4">
                {limitList.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-amber-700">Foods to Limit</h3>
                    <ul className="text-xs sm:text-[13px] text-slate-700 space-y-1 list-disc list-inside">
                      {limitList.map((food, i) => (
                        <li key={i}>{food}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {avoidList.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-rose-700">Foods to Strictly Avoid</h3>
                    <ul className="text-xs sm:text-[13px] text-slate-700 space-y-1 list-disc list-inside">
                      {avoidList.map((food, i) => (
                        <li key={i}>{food}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {drinksList.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[#0b7788]">Drinks & Hydration Guidance</h3>
                    <ul className="text-xs sm:text-[13px] text-slate-700 space-y-1 list-disc list-inside">
                      {drinksList.map((food, i) => (
                        <li key={i}>{food}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            }

            {/* Acknowledgment Notice at Bottom of Page 2 */}
            <div className="mt-8 pt-4 border-t border-[#D8F3DC]">
              <p className="text-xs sm:text-[12px] text-slate-600 leading-relaxed">
                Acknowledgment records review of this document. Meal eligibility and RND review are separate checks.
                This educational guidance does not replace individualized medical advice, clinical diagnosis, or medical
                nutrition therapy from a licensed physician or RND.
              </p>
            </div>
          </div>

          {/* Page 2 Footer */}
          <footer className="pt-6 mt-8 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono select-none">
            <span>KAINARA Personal Health Record</span>
            <span>Page 2 of {totalPages}</span>
          </footer>
        </div>
      )}
    </article>
  );
}
