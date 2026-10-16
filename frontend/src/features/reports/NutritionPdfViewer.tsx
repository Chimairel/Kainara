'use client';

import React, { useSyncExternalStore } from 'react';
import { Check, Loader2 } from '@/components/ui/icons';
import type { NutritionReport } from '@/types';
import ReviewCanvas from '@/features/nutritionist-reviews/ReviewCanvas';
import Button from '@/components/ui/Button';
import type { ReportVersion } from './ReportHistory';
import NutritionGuidancePaper, { type GuidanceProfileSnapshot } from './NutritionGuidancePaper';

interface Props {
  report: NutritionReport;
  profile: GuidanceProfileSnapshot;
  selectedVersion: ReportVersion | null;
  currentVersion: number;
  isAcknowledged: boolean;
  isAcknowledging: boolean;
  onAcknowledge: () => void;
  onDownload?: () => void;
  isDownloadingPdf?: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSetAsCurrent?: (version: ReportVersion) => void;
}

const phoneQuery = '(max-width: 639px)';
function subscribePhone(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(phoneQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const isPhone = () => typeof window.matchMedia === 'function' && window.matchMedia(phoneQuery).matches;
const serverPhone = () => false;

/** Member report adapter for the same contained canvas used by RND review. */
export default function NutritionPdfViewer({
  report,
  profile,
  selectedVersion,
  currentVersion,
  isAcknowledged,
  isAcknowledging,
  onAcknowledge,
  onDownload,
  isDownloadingPdf,
  expanded,
  onExpandedChange,
  onSetAsCurrent,
}: Props) {
  const phone = useSyncExternalStore(subscribePhone, isPhone, serverPhone);
  const archived = Boolean(selectedVersion && selectedVersion.version !== currentVersion);
  const actionClass =
    'inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-green/25 bg-brand-green/10 px-3 text-xs font-semibold text-brand-green hover:bg-brand-green/15 focus-visible:outline focus-visible:outline-brand-green disabled:cursor-default';
  const actions = archived ? (
    onSetAsCurrent && (
      <button
        type="button"
        className={actionClass}
        disabled={isAcknowledging}
        onClick={() => {
          onExpandedChange(false);
          if (selectedVersion) onSetAsCurrent(selectedVersion);
        }}
      >
        {isAcknowledging && <Loader2 className="h-4 w-4 animate-spin" />}Set as current
      </button>
    )
  ) : isAcknowledged ? (
    <Button variant="primary" disabled aria-label="Acknowledged" className="disabled:!opacity-100">
      <Check className="h-4 w-4" />
      Acknowledged
    </Button>
  ) : (
    <button
      type="button"
      className={actionClass}
      disabled={isAcknowledging}
      aria-label="Use this report for meal planning"
      onClick={() => {
        onExpandedChange(false);
        onAcknowledge();
      }}
    >
      {isAcknowledging ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Acknowledging…
        </>
      ) : (
        'Acknowledge'
      )}
    </button>
  );
  if (phone && report.foodGuidance?.formatVersion === 1) {
    return (
      <section aria-label={`Nutrition report · Version ${report.version}`} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-text-muted">Version {report.version}</span>
          <div className="flex flex-wrap items-center gap-2">
            {onDownload && (
              <Button variant="secondary" size="sm" onClick={onDownload} isLoading={isDownloadingPdf}>
                Download PDF
              </Button>
            )}
            {actions}
          </div>
        </div>
        <div className="bg-white px-5 py-6 text-slate-800">
          <NutritionGuidancePaper report={report} profile={profile} presentation="inline" />
        </div>
      </section>
    );
  }
  return (
    <ReviewCanvas
      title={`Nutrition report · Version ${report.version}`}
      ariaLabel="Nutrition report canvas"
      contentKey={`${report.id ?? 'report'}:${report.version}`}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      readOnly
      hideDecisionDock
      stackOnMobile
      focusSheet={{ title: 'Nutrition report', request: report.version }}
      actions={
        <>
          {onDownload && (
            <Button variant="secondary" size="sm" onClick={onDownload} isLoading={isDownloadingPdf}>
              Download PDF
            </Button>
          )}
          {actions}
        </>
      }
    >
      <NutritionGuidancePaper title="Nutrition report" report={report} profile={profile} />
    </ReviewCanvas>
  );
}
