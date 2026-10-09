'use client';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import NutritionGuidancePaper from '@/features/reports/NutritionGuidancePaper';
import RndQueueDocument, { ReviewDocumentPage } from '@/features/nutritionist-reviews/RndQueueDocument';
import RndClarifications, { useRndClarificationDraft } from '@/features/clinical-clarification/RndClarifications';
import RndProfileProposals, { useProfileProposalDraft } from '@/features/clinical-clarification/RndProfileProposals';
import ProfileClinicalReview from './ProfileClinicalReview';
import ProfileDocumentReview from './ProfileDocumentReview';
import ProfileReportNavigation from './ProfileReportNavigation';
import { savedProfile } from './ProfileWorkPanel.shared';
import type { useProfileWorkPanelModel } from './useProfileWorkPanelModel';

export default function ProfileWorkCanvas({ model }: { model: ReturnType<typeof useProfileWorkPanelModel> }) {
  const { detail, expanded, setExpanded, clearSelection, claimProfile, busy, selectedReport, selectedDocument } = model;
  const [decisionOpen, setDecisionOpen] = useState(false);
  const caseKey = `${detail?.userId}:${detail?.profileReview?.profileRevision}:${detail?.profileReview?.scopeKey}`;
  const clarificationDraft = useRndClarificationDraft(caseKey);
  const proposalDraft = useProfileProposalDraft(caseKey);
  useEffect(() => {
    setDecisionOpen(false);
  }, [caseKey, detail?.profileReview?.claim?.mine]);
  if (!detail) return null;
  const review = detail.profileReview;
  return (
    <>
      <RndQueueDocument
        title={`Profile review · ${detail.name}`}
        contentKey={detail.userId}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onBack={clearSelection}
        actions={
          review && (
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                disabled={busy || (!!review.claim?.active && !review.claim.mine)}
                onClick={() => void claimProfile(!!review.claim?.mine)}
              >
                {review.claim?.mine ? 'Release profile' : 'Claim profile'}
              </Button>
              <span className="text-xs text-brand-muted">
                {review.claim?.mine
                  ? 'Claimed by you for 30 minutes.'
                  : review.claim?.active
                    ? 'Claimed by another RND.'
                    : 'Claim before recording a decision.'}
              </span>
            </div>
          )
        }
        decision={
          review?.claim?.mine ? (
            <Button size="sm" disabled={busy} onClick={() => setDecisionOpen(true)}>
              Profile decision
            </Button>
          ) : undefined
        }
      >
        <ReviewDocumentPage
          page={1}
          title="Current member profile"
          subtitle={`${detail.name} · Revision ${detail.currentProfile.revision ?? 'not recorded'}`}
        >
          <p className="text-sm">
            Conditions: {detail.currentProfile.conditions.filter((v) => v !== 'NONE').join(', ') || 'None declared'} ·
            Allergies: {detail.currentProfile.allergies.filter((v) => v !== 'NONE').join(', ') || 'None declared'}
          </p>
          <p className="text-sm">
            Age: {detail.currentProfile.age ?? 'Not recorded'} · Goal: {detail.currentProfile.goal ?? 'Not recorded'} ·
            Daily target: {detail.currentProfile.dailyCalorieTarget ?? 'Not recorded'}
          </p>
          <p className="text-xs text-brand-muted">
            {detail.activePlanningReportVersion
              ? `Planning uses report version ${detail.activePlanningReportVersion}. Compare its recorded profile with the current health declarations.`
              : 'No report is selected for planning yet.'}
          </p>
          <ProfileClinicalReview model={model} section="evidence" />
        </ReviewDocumentPage>
        <ReviewDocumentPage
          page={2}
          title="Saved guidance and evidence"
          subtitle="Report versions retain the profile recorded when prepared."
        >
          <ProfileReportNavigation model={model} />
          {selectedReport && (
            <p className="text-xs text-brand-muted">
              <strong>Recorded profile:</strong> revision {selectedReport.profileRevision}.{' '}
              {selectedReport.isPlanningReport
                ? 'Selected for planning.'
                : 'Not selected for planning; compare with current health declarations.'}
            </p>
          )}
          {selectedReport && (
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
          )}
          <ProfileDocumentReview model={model} />
          {!selectedReport && !selectedDocument && (
            <p className="text-sm text-brand-muted">
              Select a guidance version or document to inspect its recorded evidence.
            </p>
          )}
        </ReviewDocumentPage>
        {review?.clarifications?.enabled && (
          <ReviewDocumentPage
            page={3}
            title="Profile clarification forms"
            subtitle="Questions and responses stay with this member across claim handoffs."
          >
            <RndClarifications
              userId={detail.userId}
              profileRevision={review.profileRevision}
              scopeKey={review.scopeKey}
              workspace={review.clarifications}
              canWrite={!busy && !!review.claim?.mine}
              onUpdated={model.reloadDetail}
              draft={clarificationDraft}
              showForms={false}
            />
          </ReviewDocumentPage>
        )}
        {review?.clarifications?.enabled &&
          review.clarifications.forms.map((form, index) => (
            <ReviewDocumentPage
              key={form.id}
              page={4 + index}
              title={form.title}
              subtitle={`Clarification · ${form.status.replace(/_/g, ' ')}`}
            >
              <RndClarifications
                userId={detail.userId}
                profileRevision={review.profileRevision}
                scopeKey={review.scopeKey}
                workspace={{ enabled: true, forms: [form] }}
                canWrite={!busy && !!review.claim?.mine}
                onUpdated={model.reloadDetail}
                showComposer={false}
              />
            </ReviewDocumentPage>
          ))}
        {review?.profileProposals?.enabled && (
          <ReviewDocumentPage
            page={4 + (review.clarifications?.forms.length ?? 0)}
            title="Profile corrections"
            subtitle="Propose reviewed changes for the member to acknowledge or request correction."
          >
            <RndProfileProposals
              userId={detail.userId}
              profileRevision={review.profileRevision}
              scopeKey={review.scopeKey}
              workspace={review.profileProposals}
              clarifications={review.clarifications}
              healthDetails={review.healthDetails ?? []}
              availableAreas={detail.availableAreas}
              canWrite={!busy && !!review.claim?.mine}
              onUpdated={model.reloadDetail}
              draft={proposalDraft}
            />
          </ReviewDocumentPage>
        )}
      </RndQueueDocument>
      <Modal
        isOpen={decisionOpen}
        onClose={() => {
          if (!busy) setDecisionOpen(false);
        }}
        layer="canvas"
        size="lg"
        title="Record profile decision"
        description="Confirm the current profile for planning, request correction, or ask for more details."
      >
        <ProfileClinicalReview model={model} section="decision" />
      </Modal>
    </>
  );
}
