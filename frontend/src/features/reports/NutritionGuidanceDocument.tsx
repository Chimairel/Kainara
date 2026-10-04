'use client';

import { WorkspaceListPane } from '@/components/shared/SplitWorkspace';
import SplitWorkspace from '@/components/shared/SplitWorkspace';
import React, { useMemo, useState } from 'react';
import type { NutritionReport } from '@/types';
import ReportHistory, { type ReportVersion } from './ReportHistory';
import Button from '@/components/ui/Button';
import NutritionGuidancePaper from './NutritionGuidancePaper';
import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import CardDecoration from '@/components/ui/CardDecoration';
import { FileText, ShieldAlert } from 'lucide-react';

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
  downloadingVersion = null,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mobileView, setMobileView] = useState<'document' | 'history'>('document');

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
      acknowledgedAt: selectedVersion.acknowledgedAt ?? content.acknowledgedAt ?? null,
      referenceItems: content.referenceItems || [],
      generalSummary: content.generalSummary || 'No summary recorded for this version.',
      reportPolicyVersion: selectedVersion.policyVersion || content.reportPolicyVersion || content.policyVersion,
      planningTargets: content.planningTargets ?? null,
    };
  }, [selectedVersion, report]);

  const isViewingArchived = Boolean(selectedVersion && selectedVersion.version !== report.version);
  const recordedProfile = (selectedVersion ?? history.find((entry) => entry.version === report.version))
    ?.profileSnapshot;

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
    } else if (onDownload) {
      onDownload();
    }
  };

  const handleSetReportAsCurrent = (v: ReportVersion) => {
    if (onSetAsCurrent) {
      onSetAsCurrent(v);
    } else {
      onAcknowledge();
    }
  };

  const headerLeftContent = (
    <div className="flex items-center gap-2">
      <span className="rounded-xl border border-brand-border/80 bg-brand-surface/90 px-2.5 py-1 text-xs font-extrabold text-brand-text shadow-xs">
        Version {displayedReport.version}
      </span>
      {isViewingArchived ? (
        <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          Archived record
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-brand-green/10 px-2.5 py-0.5 text-xs font-bold text-brand-green border border-brand-green/25">
          Active guidance
        </span>
      )}
      {isViewingArchived && (
        <button
          type="button"
          onClick={() => setSelectedVersion(null)}
          className="ml-2 text-xs font-semibold text-brand-accent hover:underline transition-colors"
        >
          ← Return to current
        </button>
      )}
    </div>
  );

  return (
    <div className="portal-page space-y-5 pb-20 text-brand-text">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <PortalPageHeader
          icon={FileText}
          eyebrow="Health guidance"
          title="Nutrition report"
          description="Review your evidence-based nutrition targets, dietary guidance, and report history."
        />

        {/* The main workspace card holding both left side (list) and right side (nutrition guide) */}
        <SplitWorkspace
          aria-label="Nutrition workspace"
          className="relative overflow-hidden flex md:h-[calc(100vh-210px)] md:min-h-[680px] flex-col rounded-[28px] sm:rounded-[36px] border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#071914] text-[#0d2820] dark:text-white shadow-xl md:flex-row"
        >
          <CardDecoration style="varied" seed="nutrition-reports" />

          {/* Left Column: Report History Queue */}
          <WorkspaceListPane visible={mobileView === 'history'} className={expanded ? '!hidden' : ''}>
            <ReportHistory
              history={allVersions}
              currentVersion={report.planningContext?.activeVersion ?? report.version}
              selectedVersionNumber={displayedReport.version}
              onSelectVersion={(v) => {
                setSelectedVersion(v.version === report.version ? null : v);
                setMobileView('document');
              }}
              onDownloadVersion={handleDownloadReportVersion}
              onSetAsCurrent={handleSetReportAsCurrent}
              isDownloadingPdf={isDownloadingPdf}
              downloadingVersion={downloadingVersion}
              borderless
            />
          </WorkspaceListPane>

          {/* Right Column: Expandable Nutrition Guidance Document Pane */}
          <ExpandableCasePanel
            expanded={expanded}
            onExpandedChange={setExpanded}
            canExpand={true}
            expandTitle="Full screen nutrition guidance"
            expandAriaLabel="Expanded nutrition guidance"
            backLabel="Back to history"
            onBack={() => setMobileView('history')}
            headerLeft={headerLeftContent}
            headerClassName="border-b border-[#dce4e0]/80 dark:border-[#173e33] bg-white/60 dark:bg-[#071914]/60 backdrop-blur-md"
            className={`${mobileView === 'document' ? 'flex' : 'hidden md:flex'} relative z-10 h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent`}
            contentClassName="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar sm:p-6 lg:p-8"
          >
            {/* Error Message */}
            {error && (
              <div
                role="alert"
                className="mx-auto w-full max-w-3xl mb-4 border-l-4 border-red-600 bg-red-50 dark:bg-red-950/40 p-3.5 text-sm text-red-800 dark:text-red-200 rounded-r-lg print:hidden"
              >
                {error}
              </div>
            )}

            {/* Unchanged Check-in Confirmation Notice */}
            {report.confirmationKind === 'UNCHANGED_CHECKIN' && (
              <p className="mx-auto max-w-3xl mb-4 text-xs text-brand-muted">
                Profile confirmed unchanged on{' '}
                {new Date(report.generatedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}. This dated
                report does not represent a new nutritionist review.
              </p>
            )}

            {/* Acknowledgment Banner (only when viewing current report and not yet acknowledged) */}
            {!isViewingArchived && !report.acknowledgedAt && (
              <div className="mx-auto w-full max-w-3xl mb-6 rounded-2xl border border-amber-300/80 bg-amber-50/90 dark:border-amber-500/30 dark:bg-amber-950/40 p-4 sm:p-5 shadow-sm backdrop-blur-sm print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                        Choose your planning report
                      </h3>
                      <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90 leading-relaxed max-w-xl">
                        This report supplies the profile, targets and restrictions used for meal planning and shared
                        with your nutritionist. Check that your details are correct before using it. This is educational
                        guidance and does not replace your doctor or Registered Nutritionist-Dietitian.
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
                    Use this report for meal planning
                  </Button>
                </div>
              </div>
            )}

            {/* Continue Button (when report is acknowledged and retry/activation is needed) */}
            {showContinue && (
              <div className="mx-auto w-full max-w-3xl mb-4 flex items-center justify-start print:hidden">
                <Button onClick={onAcknowledge} isLoading={isAcknowledging} className="font-bold shadow-md">
                  Continue
                </Button>
              </div>
            )}

            {/* Floating Paper Document */}
            <div className="flex justify-center">
              <NutritionGuidancePaper
                report={displayedReport}
                profile={{
                  name,
                  goal: recordedProfile?.profile?.goal ?? (isViewingArchived ? 'Not recorded' : goal),
                  dailyCalorieTarget:
                    recordedProfile?.profile?.dailyCalorieTarget ?? (isViewingArchived ? null : dailyCalorieTarget),
                  conditions: recordedProfile
                    ? [
                        ...(recordedProfile.conditions ?? []),
                        ...recordedDeclarations(recordedProfile.otherConditions),
                      ].filter((item) => item !== 'NONE')
                    : isViewingArchived
                      ? recordedDeclarations(displayedReport.basedOnConditions)
                      : conditions,
                  foodRestrictions: recordedProfile
                    ? [
                        ...(recordedProfile.allergens ?? []),
                        ...recordedDeclarations(recordedProfile.otherAllergies),
                      ].filter((item) => item !== 'NONE')
                    : isViewingArchived
                      ? recordedDeclarations(displayedReport.basedOnAllergies)
                      : foodRestrictions,
                }}
              />
            </div>
          </ExpandableCasePanel>
        </SplitWorkspace>
      </div>
    </div>
  );
}
