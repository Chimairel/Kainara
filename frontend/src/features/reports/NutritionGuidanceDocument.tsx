'use client';

import React, { useMemo, useState } from 'react';
import type { NutritionReport } from '@/types';
import type { ReportVersion } from './ReportHistory';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import NutritionPdfViewer from './NutritionPdfViewer';
import ReportVersionPicker from './ReportVersionPicker';
import Button from '@/components/ui/Button';
import { FileText } from 'lucide-react';

interface Props {
  report: NutritionReport;
  name: string;
  goal: string;
  dailyCalorieTarget: number;
  conditions: string[];
  foodRestrictions: string[];
  history: ReportVersion[];
  error: string | null;
  isAcknowledging: boolean;
  onAcknowledge: () => void;
  onDownload?: () => void;
  onDownloadVersion?: (version: ReportVersion) => void;
  onSetAsCurrent?: (version: ReportVersion) => void;
  isDownloadingPdf?: boolean;
  downloadingVersion?: number | null;
}

function recordedDeclarations(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' && value.trim() ? [value.trim()] : [];
  return values.filter((item): item is string => typeof item === 'string' && item !== 'NONE');
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
  onDownloadVersion,
  onSetAsCurrent,
  isDownloadingPdf = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);

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

  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  // Keep selection by identity; polling can replace the selected version's
  // acknowledgment or recorded snapshot without changing its version number.
  const selectedVersion =
    selectedVersionNumber !== report.version
      ? (allVersions.find((version) => version.version === selectedVersionNumber) ?? null)
      : null;

  const displayedReport = useMemo(() => {
    if (!selectedVersion) return report;
    const content = (selectedVersion.content || {}) as Partial<NutritionReport> & { policyVersion?: string };
    return {
      ...content,
      id: selectedVersion.id || report.id,
      version: selectedVersion.version ?? content.version ?? report.version,
      generatedAt: selectedVersion.generatedAt || content.generatedAt,
      acknowledgedAt: selectedVersion.acknowledgedAt ?? content.acknowledgedAt ?? null,
      referenceItems: content.referenceItems || [],
      generalSummary: content.generalSummary || 'No summary recorded for this version.',
      reportPolicyVersion: selectedVersion.policyVersion || content.reportPolicyVersion || content.policyVersion,
      planningTargets: content.planningTargets ?? null,
      planningContext: report.planningContext,
    } as NutritionReport;
  }, [selectedVersion, report]);

  const isViewingArchived = Boolean(selectedVersion && selectedVersion.version !== report.version);
  const recordedProfile = (selectedVersion ?? history.find((entry) => entry.version === report.version))
    ?.profileSnapshot;

  const isAcknowledged = Boolean(
    displayedReport.acknowledgedAt &&
    (!displayedReport.planningContext?.activeVersion ||
      displayedReport.planningContext.activeVersion === displayedReport.version)
  );

  const showContinue = useMemo(() => {
    if (isViewingArchived || !report.acknowledgedAt) return false;
    if (error) return true;
    if (report.planningContext?.activeVersion && report.planningContext.activeVersion !== report.version) {
      return true;
    }
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('next')) {
      return true;
    }
    return false;
  }, [isViewingArchived, report.acknowledgedAt, report.planningContext?.activeVersion, report.version, error]);

  const handleDownloadReportVersion = (v: ReportVersion) => {
    if (onDownloadVersion) {
      onDownloadVersion(v);
    } else if (onDownload && v.version === report.version) {
      onDownload();
    }
  };

  const handleSetReportAsCurrent = (v: ReportVersion) => {
    if (onSetAsCurrent) {
      onSetAsCurrent(v);
    }
  };

  const profileSnapshot = {
    name,
    goal: recordedProfile?.profile?.goal ?? (isViewingArchived ? 'Not recorded' : goal),
    dailyCalorieTarget: recordedProfile?.profile?.dailyCalorieTarget ?? (isViewingArchived ? null : dailyCalorieTarget),
    conditions: recordedProfile
      ? [...(recordedProfile.conditions ?? []), ...recordedDeclarations(recordedProfile.otherConditions)].filter(
          (item) => item !== 'NONE'
        )
      : isViewingArchived
        ? recordedDeclarations(displayedReport.basedOnConditions)
        : conditions,
    foodRestrictions: recordedProfile
      ? [...(recordedProfile.allergens ?? []), ...recordedDeclarations(recordedProfile.otherAllergies)].filter(
          (item) => item !== 'NONE'
        )
      : isViewingArchived
        ? recordedDeclarations(displayedReport.basedOnAllergies)
        : foodRestrictions,
  };

  // Remove duplicate display declarations without changing the saved clinical data.
  const uniqueLabels = (values: string[]) =>
    values.filter(
      (value, index) =>
        values.findIndex(
          (candidate) =>
            candidate.replace(/_/g, ' ').trim().toLowerCase() === value.replace(/_/g, ' ').trim().toLowerCase()
        ) === index
    );
  profileSnapshot.conditions = uniqueLabels(profileSnapshot.conditions);
  profileSnapshot.foodRestrictions = uniqueLabels(profileSnapshot.foodRestrictions);

  return (
    <div className="portal-page space-y-5 pb-20 text-brand-text">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <PortalPageHeader
          icon={FileText}
          eyebrow="Health guidance"
          title="Nutrition report"
          description="Review your evidence-based nutrition targets, dietary guidance, and report history."
        />

        {/* Error Message */}
        {error && (
          <div
            role="alert"
            className="mx-auto w-full max-w-4xl mb-2 border-l-4 border-red-600 bg-red-50 dark:bg-red-950/40 p-3.5 text-sm text-red-800 dark:text-red-200 rounded-r-lg print:hidden"
          >
            {error}
          </div>
        )}

        {/* Unchanged Check-in Confirmation Notice */}
        {report.confirmationKind === 'UNCHANGED_CHECKIN' && (
          <p className="mx-auto max-w-4xl text-xs text-brand-muted">
            Profile confirmed unchanged on{' '}
            {new Date(report.generatedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}. This dated report
            does not represent a new RND review.
          </p>
        )}

        {/* Continue Button (when report is acknowledged and retry/activation is needed) */}
        {showContinue && (
          <div className="mx-auto w-full max-w-4xl flex items-center justify-start print:hidden">
            <Button onClick={onAcknowledge} isLoading={isAcknowledging} className="font-bold shadow-md">
              Continue
            </Button>
          </div>
        )}

        {/* HTML report preview with the existing server PDF export. */}
        <ReportVersionPicker
          versions={allVersions}
          selectedVersion={displayedReport.version}
          currentVersion={report.planningContext?.activeVersion ?? report.version}
          onSelect={(version) => setSelectedVersionNumber(version.version === report.version ? null : version.version)}
        />
        <NutritionPdfViewer
          report={displayedReport}
          profile={profileSnapshot}
          selectedVersion={selectedVersion}
          currentVersion={report.version}
          isAcknowledged={isAcknowledged}
          isAcknowledging={isAcknowledging}
          onAcknowledge={onAcknowledge}
          onDownload={
            selectedVersion
              ? onDownloadVersion
                ? () => handleDownloadReportVersion(selectedVersion)
                : undefined
              : (onDownload ??
                (onDownloadVersion
                  ? () => handleDownloadReportVersion(allVersions.find((v) => v.version === report.version)!)
                  : undefined))
          }
          isDownloadingPdf={isDownloadingPdf}
          expanded={expanded}
          onExpandedChange={setExpanded}
          onSetAsCurrent={isViewingArchived && onSetAsCurrent ? handleSetReportAsCurrent : undefined}
        />
      </div>
    </div>
  );
}
