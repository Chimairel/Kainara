'use client';
import { formatMealTitle } from '@/lib/meal-title';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { formatManilaDate } from '@/lib/manila-date';
import RndQueueDocument, { ReviewDocumentPage } from './RndQueueDocument';
import CaseProfileSection from './sections/CaseProfileSection';
import CaseAuditSection from './sections/CaseAuditSection';
import CaseFlagConcernSheet from './CaseFlagConcernSheet';
import CaseDecisionSection from './sections/CaseDecisionSection';
import type { useCaseReviewWorkspaceModel } from './sections/useCaseReviewWorkspaceModel';
import { useReviewSwap } from './useReviewSwap';
import { useState, useEffect } from 'react';
import RndClarifications from '@/features/clinical-clarification/RndClarifications';
import ClarificationFormCard from '@/features/clinical-clarification/ClarificationFormCard';
import RelatedConditionReviews from './RelatedConditionReviews';

type Model = ReturnType<typeof useCaseReviewWorkspaceModel>;

export default function CaseReviewDocument({ model }: { model: Model }) {
  const { detailData, expanded, setExpanded, claimHeader, errorMsg, setSelectedMealId } = model;
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
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
  return (
    <>
      <RndQueueDocument
        key={meal.id}
        title={`Case approval · ${formatMealTitle(meal.mealName)}`}
        contentKey={meal.id}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onBack={() => setSelectedMealId(null)}
        actions={
          <>
            <RelatedConditionReviews key={meal.id} detail={detailData} />
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
        <ReviewDocumentPage
          page={1}
          title="Member health profile"
          subtitle={`${detailData.user.name} · ${formatManilaDate(meal.scheduledDate, { dateStyle: 'medium' })}`}
        >
          {meal.requiresSafetyRevalidation && (
            <FeedbackNotice role="status" tone="warning">
              <strong>Profile or evidence changed.</strong> Check the current diet, allergies, conditions and portion
              target below. Previous automated triage is not current.
            </FeedbackNotice>
          )}
          {detailData.highRiskReviewRequired && (
            <FeedbackNotice tone="warning">
              Review the recorded health context before approving this meal.
            </FeedbackNotice>
          )}
          <CaseProfileSection model={model} paper />
        </ReviewDocumentPage>
        <ReviewDocumentPage
          page={2}
          title="Meal evidence"
          subtitle={`${formatMealTitle(meal.mealName)} · ${meal.mealType} · ${formatManilaDate(meal.scheduledDate, { dateStyle: 'medium' })}`}
        >
          <CaseAuditSection model={model} paper />
          {detailData.warnings.length > 0 && (
            <section aria-label="Pre-computed clinical warnings" className="space-y-3 border-t border-[#dce4e0] pt-4">
              <h3 className="font-bold text-[#1B4332]">Pre-computed clinical warnings</h3>
              {detailData.warnings.map((warning, index) => (
                <p
                  key={index}
                  className={`rounded-xl border p-3 text-sm ${
                    warning.severity === 'CRITICAL'
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : warning.severity === 'IMPORTANT'
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-teal-200 bg-teal-50 text-teal-900'
                  }`}
                >
                  <strong>{warning.severity}: </strong>
                  {warning.message}
                </p>
              ))}
            </section>
          )}
        </ReviewDocumentPage>
        {!!detailData.flagConcerns?.length && (
          <ReviewDocumentPage page={3} title="Flag concerns" subtitle="Recorded concerns and their resolution">
            <CaseFlagConcernSheet
              concerns={detailData.flagConcerns}
              canWrite={detailData.claimStatus.claimedByMe}
              onUpdated={async () => {
                await model.review.handleSelectMeal(meal.id);
                await model.review.fetchQueue(false, undefined, true);
              }}
            />
          </ReviewDocumentPage>
        )}
        {detailData.clarifications?.enabled && detailData.reviewContext && (
          <ReviewDocumentPage
            page={detailData.flagConcerns?.length ? 4 : 3}
            title="Request profile clarification"
            subtitle="Questions stay with the member’s Profile case"
          >
            <RndClarifications
              userId={meal.userId}
              profileRevision={detailData.reviewContext.profileRevision}
              scopeKey={detailData.reviewContext.scopeKey}
              workspace={detailData.clarifications}
              canWrite={detailData.claimStatus.claimedByMe}
              draft={model.review.clarificationDraft}
              showForms={false}
              publishTarget={{
                url: `/nutritionist/queue/${meal.id}/clarifications`,
                expectedContextKey: detailData.reviewContext.contextKey,
              }}
              onInvalidated={(failure) => model.review.retireInactiveReview(failure, meal.id)}
              onUpdated={async () => {
                model.review.retireInactiveReview(
                  { response: { data: { code: 'PROFILE_REVIEW_REQUIRED' } } },
                  meal.id,
                  'Questions sent to Health details. This member’s meal reviews are paused. Continue the case in the Profile queue.'
                );
                await model.review.fetchQueue(false, undefined, true);
              }}
            />
          </ReviewDocumentPage>
        )}
        {detailData.clarifications?.forms.map((form, index) => (
          <ReviewDocumentPage
            key={form.id}
            page={(detailData.flagConcerns?.length ? 5 : 4) + index}
            title={form.title}
            subtitle="Saved profile clarification · read only"
          >
            <ClarificationFormCard form={form} mode="reviewer" />
          </ReviewDocumentPage>
        ))}
      </RndQueueDocument>
      {detailData.claimStatus.claimedByMe && (
        <p className="mt-3 text-xs text-brand-muted">
          30-minute exclusive review lock active. Submit before expiry to prevent automatic release and cooldown.
        </p>
      )}
    </>
  );
}
