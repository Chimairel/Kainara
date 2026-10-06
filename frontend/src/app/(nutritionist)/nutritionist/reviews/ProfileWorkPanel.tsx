'use client';

import { UserCheck } from 'lucide-react';

import Button from '@/components/ui/Button';

import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';
import NutritionGuidancePaper from '@/features/reports/NutritionGuidancePaper';
import { savedProfile } from '@/features/nutritionist-profile-review/ProfileWorkPanel.shared';

import { useProfileWorkPanelModel } from '@/features/nutritionist-profile-review/useProfileWorkPanelModel';
import ProfileReviewQueue from '@/features/nutritionist-profile-review/ProfileReviewQueue';
import ProfileReportNavigation from '@/features/nutritionist-profile-review/ProfileReportNavigation';
import ProfileDocumentReview from '@/features/nutritionist-profile-review/ProfileDocumentReview';
import ProfileClinicalReview from '@/features/nutritionist-profile-review/ProfileClinicalReview';
export default function ProfileWorkPanel() {
  const model = useProfileWorkPanelModel();

  const { detail, expanded, busy, setExpanded, clearSelection, claimProfile, error, selectedReport, selectedDocument } =
    model;
  return (
    <div className="flex h-[calc(100vh-270px)] min-h-[640px] overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface shadow-sm">
      <ProfileReviewQueue model={model} />
      <ExpandableCasePanel
        expanded={expanded}
        onExpandedChange={setExpanded}
        canExpand={!!detail}
        onBack={clearSelection}
        headerLeft={
          detail?.profileReview && (
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                disabled={busy || (!!detail.profileReview.claim?.active && !detail.profileReview.claim?.mine)}
                onClick={() => void claimProfile(!!detail.profileReview?.claim?.mine)}
              >
                {detail.profileReview.claim?.mine ? 'Release profile' : 'Claim profile'}
              </Button>
              <span className="text-xs text-brand-muted">
                {detail.profileReview.claim?.mine
                  ? 'Claimed by you for 30 minutes.'
                  : detail.profileReview.claim?.active
                    ? 'Claimed by another nutritionist.'
                    : 'Claim before recording a decision.'}
              </span>
            </div>
          )
        }
        className={`${detail ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col overflow-hidden`}
        contentClassName="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar sm:p-6"
      >
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-red-500/30 p-3 text-sm text-red-500">
            {error}
          </p>
        )}
        {!detail ? (
          <div className="p-6 text-brand-muted">
            <UserCheck className="mb-3 h-8 w-8 text-brand-green" />
            <h2 className="font-display text-xl font-bold text-brand-text">Select a person</h2>
            <p className="mt-2 text-sm">Their saved guidance, uploaded documents, and review tasks appear here.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-black text-brand-text">{detail.name}</h2>
              <p className="text-xs text-brand-muted">
                Current profile revision {detail.currentProfile.revision ?? 'unknown'} · Conditions:{' '}
                {detail.currentProfile.conditions.filter((item) => item !== 'NONE').join(', ') || 'none'} · Allergies:{' '}
                {detail.currentProfile.allergies.filter((item) => item !== 'NONE').join(', ') || 'none'}
              </p>
              <p className="mt-2 text-xs text-brand-muted">
                {detail.activePlanningReportVersion
                  ? `Planning uses report version ${detail.activePlanningReportVersion}. Current health declarations above still apply to safety checks.`
                  : 'No report is selected for planning yet.'}
              </p>
            </div>
            <div className="grid gap-5 xl:grid-cols-[210px_minmax(0,1fr)]">
              <ProfileReportNavigation model={model} />
              <div className="min-w-0 space-y-5">
                {selectedReport && (
                  <>
                    <div className="rounded-xl border border-brand-border bg-brand-bgAlt/40 p-3 text-xs text-brand-muted">
                      <strong className="text-brand-text">Recorded profile:</strong> revision{' '}
                      {selectedReport.profileRevision} when this guidance was prepared.{' '}
                      {selectedReport.isPlanningReport
                        ? 'Selected as the planning baseline. Compare with the latest health declarations above.'
                        : selectedReport.isCurrent
                          ? 'Matches the current profile, but is not selected for planning.'
                          : 'Historical guidance; compare with the selected planning report and current health declarations.'}
                    </div>
                    <NutritionGuidancePaper
                      report={{
                        ...selectedReport.content,
                        id: selectedReport.id,
                        version: selectedReport.version,
                        generatedAt: selectedReport.generatedAt,
                        acknowledgedAt: selectedReport.acknowledgedAt ?? undefined,
                      }}
                      activePlanningVersion={detail.activePlanningReportVersion}
                      profile={savedProfile(selectedReport, detail.name)}
                    />
                  </>
                )}
                <ProfileDocumentReview model={model} />
                {!selectedReport && !selectedDocument && (
                  <p className="rounded-xl border border-dashed border-brand-border p-8 text-sm text-brand-muted">
                    Select a saved guidance version or a pending document.
                  </p>
                )}
                <ProfileClinicalReview model={model} />
              </div>
            </div>
          </div>
        )}
      </ExpandableCasePanel>
    </div>
  );
}
