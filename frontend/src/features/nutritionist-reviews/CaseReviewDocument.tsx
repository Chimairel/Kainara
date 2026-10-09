'use client';

import { formatManilaDate } from '@/lib/manila-date';
import RndQueueDocument, { ReviewDocumentPage } from './RndQueueDocument';
import CaseProfileSection from './sections/CaseProfileSection';
import CaseAuditSection from './sections/CaseAuditSection';
import CaseDecisionSection from './sections/CaseDecisionSection';
import type { useCaseReviewWorkspaceModel } from './sections/useCaseReviewWorkspaceModel';

type Model = ReturnType<typeof useCaseReviewWorkspaceModel>;

export default function CaseReviewDocument({ model }: { model: Model }) {
  const { detailData, expanded, setExpanded, claimHeader, errorMsg, setSelectedMealId } = model;
  if (!detailData) return null;
  const meal = detailData.mealPlan;
  const inspecting = { ...model, isEditing: false };
  return (
    <>
      {errorMsg && (
        <p role="alert" className="mb-3 rounded-xl border border-red-500/30 p-3 text-sm text-red-500">
          {errorMsg}
        </p>
      )}
      <RndQueueDocument
        key={meal.id}
        title={`Case approval · ${meal.mealName}`}
        contentKey={meal.id}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onBack={() => setSelectedMealId(null)}
        actions={claimHeader}
        decision={
          detailData.claimStatus.claimedByMe ? (
            <>
              {model.isEditing && <CaseAuditSection model={model} />}
              <CaseDecisionSection model={model} />
            </>
          ) : undefined
        }
      >
        <ReviewDocumentPage
          page={1}
          title="Member health profile"
          subtitle={`${detailData.user.name} · ${formatManilaDate(meal.scheduledDate, { dateStyle: 'medium' })}`}
        >
          {meal.requiresSafetyRevalidation && (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Profile or evidence changed.</strong> Check the current diet, allergies, conditions and portion
              target below. Previous automated triage is not current.
            </p>
          )}
          {detailData.highRiskReviewRequired && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Review the recorded health context before approving this meal.
            </p>
          )}
          <CaseProfileSection model={model} paper />
        </ReviewDocumentPage>
        <ReviewDocumentPage
          page={2}
          title="Meal evidence"
          subtitle={`${meal.mealName} · ${meal.mealType} · ${formatManilaDate(meal.scheduledDate, { dateStyle: 'medium' })}`}
        >
          <CaseAuditSection model={inspecting} paper />
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
      </RndQueueDocument>
      {detailData.claimStatus.claimedByMe && (
        <p className="mt-3 text-xs text-brand-muted">
          30-minute exclusive review lock active. Submit before expiry to prevent automatic release and cooldown.
        </p>
      )}
    </>
  );
}
