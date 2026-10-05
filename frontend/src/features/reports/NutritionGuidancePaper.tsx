'use client';

import React from 'react';
import type { NutritionReport } from '@/types';
import { formatManilaDate } from '@/lib/manila-date';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Droplet,
  ExternalLink,
  Flame,
  Info,
  ShieldCheck,
  User,
  Utensils,
  XCircle,
} from 'lucide-react';

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

/** The modern guidance card styled with the KAINARA Health membership card aesthetic. */
export default function NutritionGuidancePaper({
  report,
  profile,
  activePlanningVersion = report.planningContext?.activeVersion,
}: {
  report: NutritionReport;
  profile: GuidanceProfileSnapshot;
  activePlanningVersion?: number | null;
}) {
  const prepared = report.generatedAt
    ? formatManilaDate(report.generatedAt, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently prepared';

  const isPreviouslySelected = Boolean(
    report.acknowledgedAt && activePlanningVersion && activePlanningVersion !== report.version
  );

  const statusText = report.acknowledgedAt
    ? isPreviouslySelected
      ? 'Previously selected for planning'
      : 'Selected for planning'
    : 'Not yet selected for planning';

  const recommendedList = parseList(report.foodsRecommended);
  const limitList = parseList(report.foodsToLimit);
  const avoidList = parseList(report.foodsToAvoid);
  const drinksList = parseList(report.drinksGuidance);

  return (
    <article
      aria-label="Nutrition guidance record"
      className="mx-auto w-full max-w-4xl rounded-[24px] sm:rounded-[32px] border border-[#dce4e0] dark:border-[#173e33] bg-white dark:bg-[#0a201a] p-4 sm:p-8 shadow-md sm:shadow-lg space-y-7 leading-relaxed [overflow-wrap:anywhere] text-[#0d2820] dark:text-white print:border-none print:shadow-none print:p-0 print:bg-white print:text-black transition-colors"
    >
      {/* Header Block */}
      <header className="border-b border-[#dce4e0]/80 dark:border-[#173e33] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-60 space-y-2 max-w-2xl">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-green">
              KAINARA · Personal record
            </span>
            <h1 className="font-display text-[28px] leading-tight sm:text-3xl font-black tracking-[-0.03em] text-[#0d2820] dark:text-white">
              Nutrition Guidance
            </h1>
            <p className="text-base leading-relaxed text-[#5a746a] dark:text-white/70">
              Reference summary for the recorded profile
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5 self-start print:hidden">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-[#0a201a] border border-[#dce4e0] dark:border-[#173e33] px-3.5 py-1.5 font-mono text-xs text-[#5a746a] dark:text-emerald-200/80 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-brand-green" />
              Prepared {prepared}
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm text-[#5a746a] dark:text-white/60">
          Version {report.version} · Prepared {prepared} · {statusText}
        </p>
      </header>

      {/* Profile Used for This Guidance */}
      <section className="rounded-2xl sm:rounded-3xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0c241d]/80 p-4 sm:p-6 shadow-xs backdrop-blur-sm space-y-4 print:border-none print:shadow-none print:p-0">
        <div className="flex items-center justify-between border-b border-[#dce4e0]/70 dark:border-[#173e33] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-accent/15 text-brand-accent">
              <User className="h-4 w-4" />
            </div>
            <h2 className="font-display text-lg font-bold text-[#0d2820] dark:text-white tracking-tight">
              Profile used for this guidance
            </h2>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#dce4e0]/80 dark:border-[#173e33]/80 bg-[#faf8f5]/80 dark:bg-[#071914]/80 p-3.5">
            <dt className="text-sm font-semibold text-[#5a746a] dark:text-white/70">Name</dt>
            <dd className="mt-1 text-base font-bold text-[#0d2820] dark:text-white">{profile.name}</dd>
          </div>
          <div className="rounded-2xl border border-[#dce4e0]/80 dark:border-[#173e33]/80 bg-[#faf8f5]/80 dark:bg-[#071914]/80 p-3.5">
            <dt className="text-sm font-semibold text-[#5a746a] dark:text-white/70">Goal</dt>
            <dd className="mt-1 text-base font-bold capitalize text-[#0d2820] dark:text-white">
              {profile.goal.replace(/_/g, ' ').toLowerCase()}
            </dd>
          </div>
          <div className="rounded-2xl border border-[#dce4e0]/80 dark:border-[#173e33]/80 bg-[#faf8f5]/80 dark:bg-[#071914]/80 p-3.5">
            <dt className="text-sm font-semibold text-[#5a746a] dark:text-white/70">Estimated energy target</dt>
            <dd className="mt-1 text-base font-bold text-[#0d2820] dark:text-white font-mono">
              {profile.dailyCalorieTarget === null
                ? 'Not recorded'
                : `${profile.dailyCalorieTarget.toLocaleString()} kcal/day`}
            </dd>
          </div>
          <div className="rounded-2xl border border-[#dce4e0]/80 dark:border-[#173e33]/80 bg-[#faf8f5]/80 dark:bg-[#071914]/80 p-3.5">
            <dt className="text-sm font-semibold text-[#5a746a] dark:text-white/70">Reported conditions</dt>
            <dd className="mt-1 text-base font-bold text-[#0d2820] dark:text-white">
              {profile.conditions.length ? profile.conditions.join(', ').replace(/_/g, ' ') : 'None reported'}
            </dd>
          </div>
          <div className="sm:col-span-2 rounded-2xl border border-[#dce4e0]/80 dark:border-[#173e33]/80 bg-[#faf8f5]/80 dark:bg-[#071914]/80 p-3.5">
            <dt className="text-sm font-semibold text-[#5a746a] dark:text-white/70">
              Reported allergies, intolerances and avoided foods
            </dt>
            <dd className="mt-1 text-base font-bold text-[#0d2820] dark:text-white">
              {profile.foodRestrictions.length
                ? profile.foodRestrictions.join(', ').replace(/_/g, ' ')
                : 'None reported'}
            </dd>
          </div>
        </dl>
      </section>

      {/* Daily Planning Estimates (Macro Cards) */}
      {report.planningTargets && (
        <section
          role="region"
          aria-label="Daily planning estimates"
          className="rounded-2xl sm:rounded-3xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0c241d]/80 p-4 sm:p-6 shadow-xs backdrop-blur-sm space-y-4 print:border-none print:shadow-none print:p-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce4e0]/70 dark:border-[#173e33] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green">
                <Flame className="h-4 w-4" />
              </div>
              <h2 className="font-display text-lg font-bold text-[#0d2820] dark:text-white tracking-tight">
                Daily planning estimates
              </h2>
            </div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-brand-green bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded-md">
              PDRI Aligned
            </span>
          </div>

          <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3">
            <div className="rounded-2xl border border-[#dce4e0]/80 dark:border-[#173e33]/80 bg-[#faf8f5]/80 dark:bg-[#071914]/80 p-4 text-center">
              <dt className="text-sm font-semibold text-[#5a746a] dark:text-white/70">Energy</dt>
              <dd className="mt-1 font-display text-xl font-black text-[#0d2820] dark:text-white font-mono">
                {Math.round(report.planningTargets.calories)}{' '}
                <span className="text-sm font-normal text-[#5a746a] dark:text-white/70">kcal</span>
              </dd>
            </div>
            <div className="rounded-2xl border border-[#08705b]/25 bg-[#08705b]/10 p-4 text-center dark:border-[#10b981]/30 dark:bg-[#10b981]/15">
              <dt className="text-sm font-semibold text-[#08705b] dark:text-[#34d399]">Protein</dt>
              <dd className="mt-1 font-display text-xl font-black text-[#08705b] dark:text-[#34d399] font-mono">
                {Math.round(report.planningTargets.proteinG)} <span className="text-sm font-normal">g</span>
              </dd>
            </div>
            <div className="rounded-2xl border border-[#18b9d2]/25 bg-[#18b9d2]/10 p-4 text-center dark:border-[#38bdf8]/30 dark:bg-[#38bdf8]/15">
              <dt className="text-sm font-semibold text-[#0b7788] dark:text-[#38bdf8]">Carbs</dt>
              <dd className="mt-1 font-display text-xl font-black text-[#0b7788] dark:text-[#38bdf8] font-mono">
                {Math.round(report.planningTargets.carbsG)} <span className="text-sm font-normal">g</span>
              </dd>
            </div>
            <div className="rounded-2xl border border-[#eb6a38]/25 bg-[#eb6a38]/10 p-4 text-center dark:border-[#eb6a38]/30 dark:bg-[#eb6a38]/15">
              <dt className="text-sm font-semibold text-[#c74614] dark:text-[#f09e6c]">Fat</dt>
              <dd className="mt-1 font-display text-xl font-black text-[#c74614] dark:text-[#f09e6c] font-mono">
                {Math.round(report.planningTargets.fatG)} <span className="text-sm font-normal">g</span>
              </dd>
            </div>
          </dl>

          {report.planningTargets.explanation && (
            <p className="text-base text-[#5a746a] dark:text-white/70 leading-relaxed">
              {report.planningTargets.explanation}
            </p>
          )}

          <div className="rounded-2xl border border-[#dce4e0]/80 dark:border-[#173e33]/80 bg-[#faf8f5]/80 dark:bg-[#071914]/80 p-3.5 text-base text-[#5a746a] dark:text-white/70 leading-relaxed flex items-start gap-2.5">
            <Info className="w-4 h-4 text-brand-green shrink-0 mt-0.5" />
            <p>
              Selecting this report supplies these estimates to meal planning and swap comparisons. Actual meal totals
              are shown separately.
            </p>
          </div>
        </section>
      )}

      {/* Dietary Guidance & Food Selection (when available) */}
      {(recommendedList.length > 0 || limitList.length > 0 || avoidList.length > 0 || drinksList.length > 0) && (
        <section className="rounded-2xl sm:rounded-3xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0c241d]/80 p-4 sm:p-6 shadow-xs backdrop-blur-sm space-y-4 print:border-none print:shadow-none print:p-0">
          <div className="flex items-center justify-between border-b border-[#dce4e0]/70 dark:border-[#173e33] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green">
                <Utensils className="h-4 w-4" />
              </div>
              <h2 className="font-display text-lg font-bold text-[#0d2820] dark:text-white tracking-tight">
                Dietary guidance &amp; food selection
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {recommendedList.length > 0 && (
              <div className="rounded-2xl border border-brand-green/30 bg-brand-green/[0.04] p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-green">
                  <CheckCircle2 className="w-4 h-4" />
                  Foods recommended
                </div>
                <ul className="text-base text-[#0d2820] dark:text-white/90 space-y-1.5 list-disc list-inside">
                  {recommendedList.map((item, i) => (
                    <li key={i} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {limitList.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  Foods to limit
                </div>
                <ul className="text-base text-[#0d2820] dark:text-white/90 space-y-1.5 list-disc list-inside">
                  {limitList.map((item, i) => (
                    <li key={i} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {avoidList.length > 0 && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.04] p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <XCircle className="w-4 h-4" />
                  Foods to avoid
                </div>
                <ul className="text-base text-[#0d2820] dark:text-white/90 space-y-1.5 list-disc list-inside">
                  {avoidList.map((item, i) => (
                    <li key={i} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {drinksList.length > 0 && (
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.04] p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0b7788] dark:text-[#38bdf8]">
                  <Droplet className="w-4 h-4" />
                  Hydration &amp; drinks guidance
                </div>
                <ul className="text-base text-[#0d2820] dark:text-white/90 space-y-1.5 list-disc list-inside">
                  {drinksList.map((item, i) => (
                    <li key={i} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* What these numbers mean */}
      <section className="rounded-2xl sm:rounded-3xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0c241d]/80 p-4 sm:p-6 shadow-xs backdrop-blur-sm space-y-3 print:border-none print:shadow-none print:p-0">
        <h2 className="font-display text-lg font-bold text-[#0d2820] dark:text-white tracking-tight">
          What these numbers mean
        </h2>
        <p className="text-base leading-relaxed text-[#0d2820] dark:text-white">{report.generalSummary}</p>
        <p className="text-base leading-relaxed text-[#5a746a] dark:text-white/70">
          The energy target is a planning estimate based on the saved details. Population references below are
          calculated from that target. Conditions that need more clinical information are marked for individual review;
          the report does not assign an unsupported personal limit.
        </p>
      </section>

      {/* Calculated references and review notes */}
      <section className="rounded-2xl sm:rounded-3xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0c241d]/80 p-4 sm:p-6 shadow-xs backdrop-blur-sm space-y-4 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dce4e0]/70 dark:border-[#173e33] pb-3">
          <h2 className="font-display text-lg font-bold text-[#0d2820] dark:text-white tracking-tight">
            Calculated references and review notes
          </h2>
          <span className="text-sm font-semibold text-[#5a746a] dark:text-white/70">
            {(report.referenceItems ?? []).length} references
          </span>
        </div>

        <ol className="divide-y divide-[#dce4e0]/70 dark:border-[#173e33]">
          {(report.referenceItems ?? []).map((item, index) => (
            <li key={`${item.sourceCode}-${item.heading}-${index}`} className="py-4 first:pt-1 last:pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold text-[#0d2820] dark:text-white text-sm">{item.heading}</h3>
                <strong className="text-xs font-bold text-brand-green font-mono px-2.5 py-0.5 rounded-full bg-brand-green/10 border border-brand-green/20">
                  {item.value}
                </strong>
              </div>
              <p className="mt-1 text-base text-[#5a746a] dark:text-white/70 leading-relaxed">{item.explanation}</p>
              <p className="mt-2 text-sm text-[#5a746a]/80 dark:text-white/60">
                {item.classification === 'REQUIRES_INDIVIDUAL_REVIEW'
                  ? 'Individual review'
                  : item.classification === 'CALCULATED_REFERENCE'
                    ? 'Calculated population reference'
                    : 'General reference'}{' '}
                · Source:{' '}
                {item.sourceUrl?.startsWith('https://') ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand-accent hover:underline"
                  >
                    {item.sourceTitle}
                    <ExternalLink className="w-3 h-3 inline" />
                  </a>
                ) : (
                  item.sourceTitle
                )}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Meal planning status */}
      <section className="rounded-2xl sm:rounded-3xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0c241d]/80 p-4 sm:p-6 shadow-xs backdrop-blur-sm space-y-3 print:border-none print:shadow-none print:p-0">
        <h2 className="font-display text-lg font-bold text-[#0d2820] dark:text-white tracking-tight">
          Meal planning status
        </h2>
        <p className="text-base text-[#5a746a] dark:text-white/70 leading-relaxed">
          Acknowledging this document records that the member reviewed it. Meal eligibility and Registered
          Nutritionist-Dietitian review are separate checks. Acknowledgment does not itself clear a meal or a medical
          condition.
        </p>
      </section>

      {/* Official Clinical & Educational Advisory */}
      <footer className="rounded-2xl sm:rounded-3xl border border-[#dce4e0]/80 dark:border-[#173e33] bg-white/60 dark:bg-[#0a201a]/60 p-4 sm:p-6 text-base text-[#5a746a] dark:text-white/70 space-y-3 print:border-none print:p-0">
        <div className="flex items-center gap-2 font-bold text-[#0d2820] dark:text-white uppercase tracking-wider text-xs">
          <ShieldCheck className="w-4 h-4 text-brand-green" />
          Clinical &amp; Educational Advisory
        </div>
        <p className="leading-relaxed">
          This report is prepared for educational guidance and baseline meal planning referencing DOST-FNRI Philippine
          Dietary Reference Intakes (PDRI) standards. It does not replace individualized medical advice, clinical
          diagnosis, or medical nutrition therapy from a licensed physician or Registered Nutritionist-Dietitian (RND).
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#dce4e0]/60 dark:border-[#173e33]/60 font-mono text-xs text-[#5a746a]/80 dark:text-white/60">
          <span>
            RECORD REF: KN-PR-{report.version}-{report.id ? report.id.slice(-6).toUpperCase() : 'AUTH'}
          </span>
          <span>DOST-FNRI PDRI 2015 (REV. 2018)</span>
          <span>VERIFIED PLATFORM RECORD</span>
        </div>
      </footer>
    </article>
  );
}
