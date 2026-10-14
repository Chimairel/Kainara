'use client';
import { formatMealTitle } from '@/lib/meal-title';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import CaseEvidenceSheets from './CaseEvidenceSheets';
import RndQueueDocument, { ReviewDocumentPage } from './RndQueueDocument';
import CaseDecisionSection from './sections/CaseDecisionSection';
import type { useCaseReviewWorkspaceModel } from './sections/useCaseReviewWorkspaceModel';
import { useReviewSwap } from './useReviewSwap';
import { useState, useEffect } from 'react';
import ClarificationTool from '@/features/clinical-clarification/ClarificationTool';
import Button from '@/components/ui/Button';
import RelatedConditionReviews, { initialRelatedReviewView, relatedReviewConditions } from './RelatedConditionReviews';

type Model = ReturnType<typeof useCaseReviewWorkspaceModel>;

export default function CaseReviewDocument({ model }: { model: Model }) {
  const { detailData, expanded, setExpanded, claimHeader, errorMsg, setSelectedMealId } = model;
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [referenceRequest, setReferenceRequest] = useState<{ key: string; request: number } | null>(null);
  const [referenceView, setReferenceView] = useState(initialRelatedReviewView);
  useEffect(() => {
    const active = referenceRequest?.key === `${detailData?.mealPlan.id}:${detailData?.reviewContext?.contextKey ?? 'legacy'}`;
    if (model.review.canvasReference) model.review.canvasReference.current = active ? {
      ...referenceView, condition: referenceView.condition || (detailData ? relatedReviewConditions(detailData)[0] : ''),
    } : null;
  }, [referenceView, referenceRequest, detailData, model.review]);
  const hasActiveConcern = detailData?.flagConcerns?.some((concern) => concern.active);
  useEffect(() => setAction(null), [model.selectedMealId, detailData?.claimStatus.claimedByMe, hasActiveConcern]);
  const swap = useReviewSwap(
    model.selectedMealId,
    Boolean(detailData?.claimStatus.claimedByMe),
    async (replacementId) => {
      await model.review.fetchQueue(false, undefined, true);
      await model.review.handleSelectMeal(replacementId);
    },
    detailData?.reviewContext?.contextKey,
    (failure) => model.review.retireInactiveReview(failure, model.selectedMealId)
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
        focusSheet={referencesOpen ? { title: 'Related condition reviews', request: referenceRequest.request } : undefined}
        tools={detailData.clarifications?.enabled && detailData.reviewContext && (
          <ClarificationTool
            userId={meal.userId}
            profileRevision={detailData.reviewContext.profileRevision}
            scopeKey={detailData.reviewContext.scopeKey}
            workspace={detailData.clarifications}
            canWrite={detailData.claimStatus.claimedByMe}
            draft={model.review.clarificationDraft}
            showForms={false}
            publishTarget={{ url: `/nutritionist/queue/${meal.id}/clarifications`, expectedContextKey: detailData.reviewContext.contextKey }}
            onInvalidated={(failure) => model.review.retireInactiveReview(failure, meal.id)}
            onUpdated={async () => {
              model.review.retireInactiveReview(
                { response: { data: { code: 'PROFILE_REVIEW_REQUIRED' } } }, meal.id,
                'Questions sent to Health details. This member’s meal reviews are paused. Continue the case in the Profile queue.'
              );
              await model.review.fetchQueue(false, undefined, true);
            }}
          />
        )}
        actions={
          <>
            {relatedReviewConditions(detailData).length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => {
                if (!referencesOpen) setReferenceView({ ...initialRelatedReviewView, search: formatMealTitle(meal.mealName) });
                setReferenceRequest(previous => ({ key: referenceKey, request: (previous?.request ?? 0) + 1 }));
              }}>Related reviews</Button>
            )}
            {claimHeader}
            {errorMsg && !action && (
              <FeedbackNotice variant="inline" className="max-w-sm">
                {errorMsg}
              </FeedbackNotice>
            )}
          </>
        }
        decision={
          detailData.claimStatus.claimedByMe ? (
            <CaseDecisionSection model={model} swap={swap} action={action} setAction={setAction} />
          ) : undefined
        }
      >
        {CaseEvidenceSheets({ detailData, canWrite: detailData.claimStatus.claimedByMe,
          onUpdated: async () => { await model.review.handleSelectMeal(meal.id); await model.review.fetchQueue(false, undefined, true); } })}
        {referencesOpen && (
          <ReviewDocumentPage page={lastPage + 1} title="Related condition reviews" subtitle="Completed decisions for this case’s conditions">
            <RelatedConditionReviews detail={detailData} view={referenceView} onViewChange={setReferenceView} />
          </ReviewDocumentPage>
        )}
      </RndQueueDocument>
      {detailData.claimStatus.claimedByMe && (
        <p className="mt-3 text-xs text-brand-muted">
          30-minute exclusive review lock active. Submit before expiry to prevent automatic release and cooldown.
        </p>
      )}
    </>
  );
}
