'use client';

import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { NutritionReport } from '@/types';
import DocumentViewer from '@/components/shared/DocumentViewer';
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

/** Nutrition adapter; all reader behavior lives in the reusable DocumentViewer. */
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
  ) : (
    <button
      type="button"
      className={actionClass}
      disabled={isAcknowledged || isAcknowledging}
      aria-label={isAcknowledged ? 'Acknowledged' : 'Use this report for meal planning'}
      onClick={() => {
        onExpandedChange(false);
        onAcknowledge();
      }}
    >
      {isAcknowledged ? (
        <>
          <Check className="h-4 w-4" />
          Acknowledged
        </>
      ) : isAcknowledging ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Acknowledging…
        </>
      ) : (
        'Acknowledge'
      )}
    </button>
  );
  return (
    <DocumentViewer
      title={`Nutrition report · Version ${report.version}`}
      contentKey={`${report.id ?? 'report'}:${report.version}`}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      onDownload={onDownload}
      downloading={isDownloadingPdf}
      actions={actions}
    >
      <NutritionGuidancePaper report={report} profile={profile} />
    </DocumentViewer>
  );
}
