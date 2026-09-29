'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { NutritionReport } from '@/types';
import ReportHistory, { type ReportVersion } from './ReportHistory';
import Button from '@/components/ui/Button';
import { formatManilaDate } from '@/lib/manila-date';
import { Download, Printer, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface Props {
  report: NutritionReport;
  name: string;
  goal: string;
  dailyCalorieTarget: number;
  conditions: string[];
  foodRestrictions: string[];
  history: Array<{ id: string; version: number; generatedAt: string; content: NutritionReport }>;
  error: string | null;
  isAcknowledging: boolean;
  onAcknowledge: () => void;
  onDownload: () => void;
}

export default function NutritionGuidanceDocument({
  report,
  name,
  goal,
  dailyCalorieTarget,
  conditions,
  foodRestrictions,
  history,
  error,
  isAcknowledging,
  onAcknowledge,
  onDownload,
}: Props) {
  // Assemble complete descending version list
  const allVersions = useMemo(() => {
    const list: ReportVersion[] = [...history];
    if (report && !list.some((h) => h.version === report.version)) {
      list.unshift({
        id: report.id || `v-${report.version}`,
        version: report.version,
        generatedAt: report.generatedAt,
        content: report,
      });
    }
    return list.sort((a, b) => b.version - a.version);
  }, [history, report]);

  const [selectedVersion, setSelectedVersion] = useState<ReportVersion | null>(null);

  const displayedReport = useMemo(() => {
    if (!selectedVersion) return report;
    const content = (selectedVersion.content || {}) as Partial<NutritionReport> & { policyVersion?: string };
    return {
      ...report,
      ...content,
      id: selectedVersion.id || report.id,
      version: selectedVersion.version ?? content.version ?? report.version,
      generatedAt: selectedVersion.generatedAt || content.generatedAt || report.generatedAt,
      acknowledgedAt: content.acknowledgedAt ?? null,
      referenceItems: content.referenceItems || report.referenceItems,
      generalSummary: content.generalSummary || report.generalSummary,
      reportPolicyVersion: content.reportPolicyVersion || content.policyVersion || report.reportPolicyVersion,
    };
  }, [selectedVersion, report]);

  const isViewingArchived = Boolean(selectedVersion && selectedVersion.version !== report.version);
  const refs = displayedReport.referenceItems ?? [];

  const formattedPreparedDate = displayedReport.generatedAt
    ? formatManilaDate(displayedReport.generatedAt, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently prepared';

  return (
    <div className="w-full min-h-full py-6 px-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-start gap-8 xl:gap-12">
        {/* Left Column: Nutrition report history (clean, borderless) */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0 print:hidden">
          <ReportHistory
            history={allVersions}
            currentVersion={report.version}
            selectedVersionNumber={displayedReport.version}
            onSelectVersion={(v) => setSelectedVersion(v.version === report.version ? null : v)}
            borderless
          />
        </aside>

        {/* Right Column: Controls + Floating Paper Document */}
        <div className="flex-1 min-w-0 w-full flex flex-col items-center">
          {/* Top Document Toolbar (Outside the Paper) */}
          <div className="w-full max-w-3xl mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Link
                href="/profile"
                className="hover:text-foreground transition-colors font-medium underline underline-offset-4"
              >
                Profile
              </Link>
              <span className="text-muted-foreground/60">/</span>
              <span className="font-semibold text-foreground">Nutrition Guidance</span>
              {isViewingArchived && (
                <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Archived Version {displayedReport.version}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isViewingArchived && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedVersion(null)}
                  className="text-xs"
                >
                  ← Return to current
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={onDownload}
                className="gap-1.5 text-xs font-semibold bg-white/90 dark:bg-brand-surface border-slate-300 dark:border-brand-border hover:bg-slate-100 dark:hover:bg-brand-surface/80"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                className="hidden sm:inline-flex gap-1.5 text-xs font-semibold bg-white/90 dark:bg-brand-surface border-slate-300 dark:border-brand-border hover:bg-slate-100 dark:hover:bg-brand-surface/80"
                aria-label="Print guidance document"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </Button>
            </div>
          </div>

          {/* Error Message (Outside the Paper) */}
          {error && (
            <div
              role="alert"
              className="w-full max-w-3xl mb-4 border-l-4 border-red-600 bg-red-50 dark:bg-red-950/40 p-3.5 text-sm text-red-800 dark:text-red-200 rounded-r-lg print:hidden"
            >
              {error}
            </div>
          )}

          {/* Acknowledgment Banner (Outside the Paper, when not yet acknowledged on active report) */}
          {!isViewingArchived && !report.acknowledgedAt && (
            <div className="w-full max-w-3xl mb-6 rounded-xl border border-amber-300/80 bg-amber-50/90 dark:border-amber-500/30 dark:bg-amber-950/40 p-4 sm:p-5 shadow-sm backdrop-blur-sm print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                      Review & Acknowledgment Required
                    </h3>
                    <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90 leading-relaxed max-w-xl">
                      Please confirm that the profile below reflects what you entered and that you have read these references. This is educational guidance and does not replace your doctor or Registered Nutritionist-Dietitian.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={onAcknowledge}
                  isLoading={isAcknowledging}
                  className="shrink-0 font-bold shadow-md self-start sm:self-center"
                >
                  Acknowledge and Continue
                </Button>
              </div>
            </div>
          )}

          {/* Acknowledged Status Confirmation (Outside the Paper) */}
          {!isViewingArchived && report.acknowledgedAt && (
            <div className="w-full max-w-3xl mb-4 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-3.5 py-2 print:hidden">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                Acknowledged on {new Date(report.acknowledgedAt).toLocaleDateString()} · Active clinical reference for your meal planning
              </span>
            </div>
          )}

          {/* The Floating Paper Sheet (Pure White, All Text, Zero Buttons) */}
          <article className="w-full max-w-3xl bg-white text-slate-900 rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.04),0_20px_45px_-15px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.06)] p-6 sm:p-12 md:p-14 font-sans leading-relaxed print:shadow-none print:p-0 print:max-w-none transition-shadow">
            {/* Letterhead */}
            <div className="border-b-2 border-slate-900 pb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                KAINARA · Personal record
              </p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Nutrition Guidance
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Reference summary for your current profile
              </p>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Version {displayedReport.version} · Prepared {formattedPreparedDate} ·{' '}
              {displayedReport.acknowledgedAt
                ? 'Acknowledged'
                : 'Acknowledgment needed'}
            </p>

            {/* Profile Section */}
            <section className="mt-8 border-b border-slate-200 pb-6">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Profile used for this guidance
              </h2>
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3.5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-slate-900">Name</dt>
                  <dd className="text-slate-700 mt-0.5">{name}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Goal</dt>
                  <dd className="text-slate-700 mt-0.5">{goal.replace(/_/g, ' ').toLowerCase()}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Estimated energy target</dt>
                  <dd className="text-slate-700 mt-0.5">{dailyCalorieTarget.toLocaleString()} kcal/day</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Reported conditions</dt>
                  <dd className="text-slate-700 mt-0.5">
                    {conditions.length ? conditions.join(', ').replace(/_/g, ' ') : 'None reported'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-slate-900">
                    Reported allergies, intolerances and avoided foods
                  </dt>
                  <dd className="text-slate-700 mt-0.5">
                    {foodRestrictions.length
                      ? foodRestrictions.join(', ').replace(/_/g, ' ')
                      : 'None reported'}
                  </dd>
                </div>
              </dl>
            </section>

            {/* What These Numbers Mean */}
            <section className="mt-7 border-b border-slate-200 pb-6">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                What these numbers mean
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-800">
                {displayedReport.generalSummary}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                The energy target is a planning estimate based on your saved details. Population references below are calculated from that target. Conditions that need more clinical information are marked for individual review; the report does not assign an unsupported personal limit.
              </p>
            </section>

            {/* Calculated References */}
            <section className="mt-7 border-b border-slate-200 pb-6">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Calculated references and review notes
              </h2>
              <ol className="mt-3 divide-y divide-slate-200">
                {refs.map((item, index) => (
                  <li key={`${item.sourceCode}-${item.heading}-${index}`} className="py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 text-sm">{item.heading}</h3>
                      <strong className="text-sm font-bold text-slate-900 font-mono">{item.value}</strong>
                    </div>
                    <p className="mt-1 text-sm text-slate-700 leading-relaxed">{item.explanation}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.classification === 'REQUIRES_INDIVIDUAL_REVIEW'
                        ? 'Individual review'
                        : item.classification === 'CALCULATED_REFERENCE'
                          ? 'Calculated population reference'
                          : 'General reference'}{' '}
                      · Source:{' '}
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-slate-700 hover:text-slate-950 font-medium"
                      >
                        {item.sourceTitle}
                      </a>
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            {/* Meal Planning Status */}
            <section className="mt-7 border-b border-slate-200 pb-6 text-sm">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Meal planning status
              </h2>
              <p className="mt-2 text-slate-700 leading-relaxed">
                Acknowledging this document records that you reviewed it. Meal eligibility and Registered Nutritionist-Dietitian review are separate checks. Acknowledgment does not itself clear a meal or a medical condition.
              </p>
            </section>

            {/* Clinical Advisory & Authentication (All text, NO buttons) */}
            <section className="mt-6 pt-2 text-xs text-slate-500 leading-relaxed">
              <p className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Clinical & Educational Advisory
              </p>
              <p>
                This report is prepared for educational guidance and baseline meal planning referencing DOST-FNRI Philippine Dietary Reference Intakes (PDRI) standards. It does not replace individualized medical advice, clinical diagnosis, or medical nutrition therapy from a licensed physician or Registered Nutritionist-Dietitian (RND).
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 text-[11px] text-slate-400 font-mono">
                <span>
                  RECORD REF: KN-PR-{displayedReport.version}-
                  {displayedReport.id ? displayedReport.id.slice(-6).toUpperCase() : 'AUTH'}
                </span>
                <span>DOST-FNRI PDRI 2015 (REV. 2018)</span>
                <span>PAGE 1 OF 1</span>
              </div>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}
