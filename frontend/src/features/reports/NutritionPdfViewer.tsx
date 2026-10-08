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
    'inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20 focus-visible:outline disabled:opacity-50';
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
