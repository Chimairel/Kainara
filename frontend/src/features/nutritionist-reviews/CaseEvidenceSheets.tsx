'use client';
import { formatMealTitle } from '@/lib/meal-title';
import { formatManilaDate } from '@/lib/manila-date';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import { ReviewDocumentPage } from './RndQueueDocument';
import CaseProfileSection from './sections/CaseProfileSection';
import CaseAuditSection from './sections/CaseAuditSection';
import CaseFlagConcernSheet from './CaseFlagConcernSheet';
import ClarificationFormCard from '@/features/clinical-clarification/ClarificationFormCard';
import type { DetailData } from './review-types';

/** One paper composition for live review and immutable approval replay. */
export default function CaseEvidenceSheets({ detailData, canWrite = false, onUpdated = async () => {} }: {
  detailData: DetailData; canWrite?: boolean; onUpdated?: () => Promise<void>;
}) {
  const meal = detailData.mealPlan;
  const dateLabel = meal.scheduledDate && !Number.isNaN(new Date(meal.scheduledDate).getTime())
    ? formatManilaDate(meal.scheduledDate, { dateStyle: 'medium' }) : 'Date not recorded';
  return <>
        <ReviewDocumentPage
          page={1}
          title="Member health profile"
          subtitle={`${detailData.user.name} · ${dateLabel}`}
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
          <CaseProfileSection model={{ detailData }} paper />
        </ReviewDocumentPage>
        <ReviewDocumentPage
          page={2}
          title="Meal evidence"
          subtitle={`${formatMealTitle(meal.mealName)} · ${meal.mealType} · ${dateLabel}`}
        >
          <CaseAuditSection model={{ detailData }} paper />
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
              planId={meal.id}
              concerns={detailData.flagConcerns}
              canWrite={canWrite}
              onUpdated={onUpdated}
            />
          </ReviewDocumentPage>
        )}
        {detailData.clarifications?.forms.map((form, index) => (
          <ReviewDocumentPage
            key={form.id}
            page={3 + Number(Boolean(detailData.flagConcerns?.length)) + index}
            title={form.title}
            subtitle="Saved profile clarification · read only"
          >
            <ClarificationFormCard form={form} mode="reviewer" embedded />
          </ReviewDocumentPage>
        ))}
  </>;
}
