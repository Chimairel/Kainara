'use client';
import { formatMealTitle } from '@/lib/meal-title';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import CaseEvidenceSheets from './CaseEvidenceSheets';
import RndQueueDocument, { ReviewDocumentPage } from './RndQueueDocument';
import CaseDecisionSection, { CaseDecisionPage } from './sections/CaseDecisionSection';
import type { useCaseReviewWorkspaceModel } from './sections/useCaseReviewWorkspaceModel';
import { useReviewSwap } from './useReviewSwap';
import { useState, useEffect } from 'react';
import RndClarifications from '@/features/clinical-clarification/RndClarifications';
import Button from '@/components/ui/Button';
import { Plus, MessageSquare, FileText, BookOpen } from '@/components/ui/icons';
import CanvasMenu from './CanvasMenu';
import RelatedConditionReviews, { initialRelatedReviewView, relatedReviewConditions } from './RelatedConditionReviews';

type Model = ReturnType<typeof useCaseReviewWorkspaceModel>;

export default function CaseReviewDocument({ model }: { model: Model }) {
  const { detailData, expanded, setExpanded, claimHeader, errorMsg, setSelectedMealId } = model;
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [referenceRequest, setReferenceRequest] = useState<{ key: string; request: number } | null>(null);
  const [referenceView, setReferenceView] = useState(initialRelatedReviewView);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messagePurpose, setMessagePurpose] = useState<'MEAL' | 'PROFILE'>('MEAL');
  const [focus, setFocus] = useState<{ title: string; request: number }>();
  const focusPage = (title: string) => setFocus(previous => ({ title, request: (previous?.request ?? 0) + 1 }));
  const selectDecision = (value: 'approve' | 'reject' | null) => {
    setAction(value);
    if (value) { setMessageOpen(false); focusPage(value === 'approve' ? 'Approval rationale' : 'Rejection rationale'); }
  };
  useEffect(() => {
    const active = referenceRequest?.key === `${detailData?.mealPlan.id}:${detailData?.reviewContext?.contextKey ?? 'legacy'}`;
    if (model.review.canvasReference) model.review.canvasReference.current = active ? {
      ...referenceView, condition: referenceView.condition || (detailData ? relatedReviewConditions(detailData)[0] : ''),
    } : null;
  }, [referenceView, referenceRequest, detailData, model.review]);
  const hasActiveConcern = detailData?.flagConcerns?.some((concern) => concern.active);
  useEffect(() => { setAction(null); setMessageOpen(false); setFocus(undefined); }, [model.selectedMealId, detailData?.claimStatus.claimedByMe, hasActiveConcern]);
  const swap = useReviewSwap(
    model.selectedMealId,
    Boolean(detailData?.claimStatus.claimedByMe),
    async (replacementId) => {
      await model.review.handleSelectMeal(replacementId);
      await model.review.fetchQueue(true, undefined, true);
    },
    detailData?.reviewContext?.contextKey,
    (failure) => model.review.retireInactiveReview(failure, model.selectedMealId),
    model.review.setReplacementPending
  );
  if (!detailData) return null;
  const meal = detailData.mealPlan;
  const referenceKey = `${meal.id}:${detailData.reviewContext?.contextKey ?? 'legacy'}`;
  const referencesOpen = referenceRequest?.key === referenceKey;
  const lastPage = 2 + Number(Boolean(detailData.flagConcerns?.length))
    + (detailData.clarifications?.forms.length ?? 0);
  return (
    <>
      <RndQueueDocument
        key={meal.id}
        title={`Case approval · ${formatMealTitle(meal.mealName)}`}
        contentKey={meal.id}
        onLayoutChange={layout => { if (model.review.canvasLayout) model.review.canvasLayout.current = layout; }}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onBack={() => setSelectedMealId(null)}
        focusSheet={focus}
        hideDecisionDock
        tools={<>
          <CaseDecisionSection model={model} swap={swap} action={action} setAction={selectDecision} />
          <CanvasMenu label="Add page" disabled={!detailData.claimStatus.claimedByMe || Boolean(model.actionLoading) || swap.saving} icon={<Plus aria-hidden="true" className="h-5 w-5" />}
            items={[
              { value: 'meal-question', label: 'Meal question', icon: <MessageSquare className="h-4 w-4" />,
                disabled: !detailData.claimStatus.claimedByMe || !detailData.clarifications?.enabled || !detailData.reviewContext },
              { value: 'profile-question', label: 'Profile question', icon: <MessageSquare className="h-4 w-4" />,
                disabled: !detailData.claimStatus.claimedByMe || !detailData.clarifications?.enabled || !detailData.reviewContext },
              { value: 'references', label: 'Related reviews', icon: <BookOpen className="h-4 w-4" />, disabled: !relatedReviewConditions(detailData).length },
              { value: 'profile', label: 'Member health profile', icon: <FileText className="h-4 w-4" /> },
              { value: 'meal', label: 'Meal evidence', icon: <FileText className="h-4 w-4" /> },
            ]} onSelect={value => {
              if (value === 'meal-question' || value === 'profile-question') {
                setMessagePurpose(value === 'meal-question' ? 'MEAL' : 'PROFILE');
                setAction(null); setMessageOpen(true); focusPage(value === 'meal-question' ? 'Meal question' : 'Profile question');
              }
              else if (value === 'references') {
                if (!referencesOpen) setReferenceView({ ...initialRelatedReviewView, search: formatMealTitle(meal.mealName) });
                setReferenceRequest(previous => ({ key: referenceKey, request: (previous?.request ?? 0) + 1 }));
                focusPage('Related condition reviews');
              } else focusPage(value === 'profile' ? 'Member health profile' : 'Meal evidence');
            }} />
        </>}
        actions={
          <>
            {claimHeader}
            {detailData.reviewContext?.mealQuestionState && <span role="status" className="text-xs text-brand-muted">
              {detailData.reviewContext.mealQuestionState === 'AWAITING_MEMBER'
                ? 'Meal question · waiting for the member' : 'Meal answer received · review and resolve it'}
            </span>}
            {errorMsg && !action && (
              <FeedbackNotice variant="inline" className="max-w-sm">
                {errorMsg}
              </FeedbackNotice>
            )}
          </>
        }
      >
        {CaseEvidenceSheets({ detailData, canWrite: detailData.claimStatus.claimedByMe,
          onUpdated: async () => { await model.review.handleSelectMeal(meal.id); await model.review.fetchQueue(false, undefined, true); } })}
        {referencesOpen && (
          <ReviewDocumentPage page={lastPage + 1} title="Related condition reviews" subtitle="Completed decisions for this case’s conditions">
            <RelatedConditionReviews detail={detailData} view={referenceView} onViewChange={setReferenceView} />
          </ReviewDocumentPage>
        )}
        {messageOpen && detailData.reviewContext && detailData.claimStatus.claimedByMe && (
          <ReviewDocumentPage page={lastPage + Number(referencesOpen) + 1} title={messagePurpose === 'MEAL' ? 'Meal question' : 'Profile question'} subtitle="Draft · not sent">
            <RndClarifications userId={meal.userId} profileRevision={detailData.reviewContext.profileRevision}
              scopeKey={detailData.reviewContext.scopeKey} workspace={detailData.clarifications} canWrite
              draft={messagePurpose === 'MEAL' ? model.review.clarificationDraft : model.review.profileClarificationDraft} showForms={false} embedded
              publishTarget={{ url: `/nutritionist/queue/${meal.id}/clarifications`, expectedContextKey: detailData.reviewContext.contextKey, purpose: messagePurpose }}
              onInvalidated={failure => model.review.retireInactiveReview(failure, meal.id)}
              onUpdated={async () => {
                if (messagePurpose === 'PROFILE') model.review.retireInactiveReview({ response: { data: { code: 'PROFILE_REVIEW_REQUIRED' } } }, meal.id,
                  'Profile questions sent to Health details. This member’s meal reviews are paused. Continue in the Member queue.');
                else { setMessageOpen(false); await model.review.handleSelectMeal(meal.id); }
                await model.review.fetchQueue(false, undefined, true);
              }} />
            <Button variant="secondary" className="mt-6" onClick={() => setMessageOpen(false)}>Close draft</Button>
          </ReviewDocumentPage>
        )}
        {action && detailData.claimStatus.claimedByMe && <CaseDecisionPage model={model} swap={swap} action={action}
          title={action === 'approve' ? 'Approval rationale' : 'Rejection rationale'}
          page={lastPage + Number(referencesOpen) + 1} setAction={selectDecision} />}
      </RndQueueDocument>
      {detailData.claimStatus.claimedByMe && (
        <p className="mt-3 text-xs text-brand-muted">
          30-minute exclusive review lock active. Submit before expiry to prevent automatic release and cooldown.
        </p>
      )}
    </>
  );
}
