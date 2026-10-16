'use client';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import NutritionGuidancePaper from '@/features/reports/NutritionGuidancePaper';
import RndQueueDocument, { ReviewDocumentPage } from '@/features/nutritionist-reviews/RndQueueDocument';
import RndClarifications, { useRndClarificationDraft } from '@/features/clinical-clarification/RndClarifications';
import ClarificationTool from '@/features/clinical-clarification/ClarificationTool';
import ProfileProposalCard from '@/features/clinical-clarification/ProfileProposalCard';
import CanvasToolButton from '@/features/nutritionist-reviews/CanvasToolButton';
import { ClipboardCheck, FileCheck, Pencil } from '@/components/ui/icons';
import RndProfileProposals, { useProfileProposalDraft } from '@/features/clinical-clarification/RndProfileProposals';
import ProfileClinicalReview, { ProfileDecisionActions } from './ProfileClinicalReview';
import ProfileDocumentReview from './ProfileDocumentReview';
import ProfileReportNavigation from './ProfileReportNavigation';
import { savedProfile } from './ProfileWorkPanel.shared';
import type { useProfileWorkPanelModel } from './useProfileWorkPanelModel';
import styles from './ProfileReviewDialogs.module.css';

export default function ProfileWorkCanvas({ model }: { model: ReturnType<typeof useProfileWorkPanelModel> }) {
  const { detail, expanded, setExpanded, clearSelection, claimProfile, busy, selectedReport, selectedDocument } = model;
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [tool, setTool] = useState<'corrections' | 'document' | null>(null);
  const [toolBusy, setToolBusy] = useState(false);
  const caseKey = `${detail?.userId}:${detail?.profileReview?.profileRevision}:${detail?.profileReview?.scopeKey}`;
  const clarificationDraft = useRndClarificationDraft(caseKey);
  const proposalDraft = useProfileProposalDraft(caseKey);
  useEffect(() => {
    setDecisionOpen(false);
    setTool(null);
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
        hideDecisionDock
        tools={<>
          {review?.clarifications?.enabled && <ClarificationTool
            dialogPresentation="workspace" dialogContentClassName={styles.body}
            dialogContext={<p className="mt-3 text-sm font-medium text-brand-text">{detail.name} · Profile revision {review.profileRevision}</p>}
            userId={detail.userId} profileRevision={review.profileRevision} scopeKey={review.scopeKey}
            workspace={{ ...review.clarifications, forms: review.clarifications.forms.filter(form => form.status === 'ANSWERED') }}
            canWrite={!busy && !!review.claim?.mine} onUpdated={model.reloadDetail} draft={clarificationDraft}
          />}
          {review?.profileProposals?.enabled && <CanvasToolButton
            aria-label="Profile corrections" title="Propose profile corrections" disabled={busy || !review.claim?.mine}
            onClick={() => setTool('corrections')}>
            <Pencil aria-hidden="true" className="h-5 w-5" />
          </CanvasToolButton>}
          {selectedDocument?.pending && <CanvasToolButton
            aria-label="Review document" title="Review clinical document" disabled={busy}
            onClick={() => setTool('document')}>
            <FileCheck aria-hidden="true" className="h-5 w-5" />
          </CanvasToolButton>}
          {review && <CanvasToolButton aria-label="Profile decision" title="Record profile decision"
            disabled={busy || !review.claim?.mine} aria-pressed={decisionOpen}
            onClick={() => setDecisionOpen(true)}>
            <ClipboardCheck aria-hidden="true" className="h-5 w-5" />
          </CanvasToolButton>}
        </>}
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
              presentation="inline"
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
          <ProfileDocumentReview model={model} section="evidence" />
          {!selectedReport && !selectedDocument && (
            <p className="text-sm text-brand-muted">
              Select a guidance version or document to inspect its recorded evidence.
            </p>
          )}
        </ReviewDocumentPage>
        {review?.clarifications?.enabled &&
          review.clarifications.forms.map((form, index) => (
            <ReviewDocumentPage
              key={form.id}
              page={3 + index}
              title={form.title}
              subtitle={`Clarification · ${form.status.replace(/_/g, ' ')}`}
            >
              <RndClarifications
                userId={detail.userId} profileRevision={review.profileRevision} scopeKey={review.scopeKey}
                workspace={{ enabled: true, forms: [form] }}
                canWrite={!busy && !toolBusy && !!review.claim?.mine}
                showComposer={false} embedded onBusyChange={setToolBusy} onUpdated={model.reloadDetail}
              />
            </ReviewDocumentPage>
          ))}
        {review?.profileProposals?.proposals.map((proposal, index) => (
          <ReviewDocumentPage
            key={proposal.id}
            page={3 + (review.clarifications?.forms.length ?? 0) + index}
            title="Recorded profile correction"
            subtitle={`Correction · ${proposal.status.replace(/_/g, ' ')}`}
          >
            <ProfileProposalCard proposal={proposal} embedded />
          </ReviewDocumentPage>
        ))}
      </RndQueueDocument>
      <Modal isOpen={tool !== null} onClose={() => { if (!busy && !toolBusy) setTool(null); }} layer="canvas" size="2xl"
        presentation="workspace" contentClassName={styles.body}
        title={tool === 'document' ? 'Review clinical document' : 'Propose profile corrections'}
        description={tool === 'document' ? undefined : 'Use information reviewed with this member. The member must acknowledge the recorded changes before they apply.'}
        headerContent={<p className="mt-3 text-sm font-medium text-brand-text">{detail.name} · Profile revision {review?.profileRevision}</p>}>
        {tool === 'document' && <div className="space-y-6"><ProfileDocumentReview model={model} section="decision" /></div>}
        {tool === 'corrections' && review && <RndProfileProposals
          userId={detail.userId} profileRevision={review.profileRevision} scopeKey={review.scopeKey}
          workspace={review.profileProposals} clarifications={review.clarifications}
          healthDetails={review.healthDetails ?? []} availableAreas={detail.availableAreas}
          canWrite={!busy && !!review.claim?.mine} draft={proposalDraft} showProposals={false}
          onBusyChange={setToolBusy} onUpdated={async () => { await model.reloadDetail(); setTool(null); }}
        />}
      </Modal>
      <Modal
        isOpen={decisionOpen}
        onClose={() => {
          if (!busy && !toolBusy) setDecisionOpen(false);
        }}
        layer="canvas"
        size="2xl"
        presentation="workspace"
        contentClassName={styles.body}
        title="Record profile decision"
        description="Confirm the current profile for planning, request correction, or ask for more details."
        headerContent={<p className="mt-3 text-sm font-medium text-brand-text">{detail.name} · Profile revision {review?.profileRevision}</p>}
        footer={<ProfileDecisionActions model={{ ...model, busy: busy || toolBusy }} />}
      >
        {review?.clarifications?.forms.some(form => form.status === 'ANSWERED') && (
          <div className="mb-6 space-y-4 border-b border-brand-border pb-6">
            <h3 className="font-display text-lg font-semibold">Review clarification answers</h3>
            <RndClarifications
              userId={detail.userId} profileRevision={review.profileRevision} scopeKey={review.scopeKey}
              workspace={{ enabled: true, forms: review.clarifications.forms.filter(form => form.status === 'ANSWERED') }}
              canWrite={!busy && !toolBusy && !!review.claim?.mine} showComposer={false} embedded
              onBusyChange={setToolBusy} onUpdated={model.reloadDetail}
            />
          </div>
        )}
        <ProfileClinicalReview model={{ ...model, busy: busy || toolBusy }} section="decision" showActions={false} />
      </Modal>
    </>
  );
}
