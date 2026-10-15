'use client';
import { formatMealTitle } from '@/lib/meal-title';
import { formatManilaDate } from '@/lib/manila-date';
import { ReviewDocumentPage } from './RndQueueDocument';
import CaseProfileSection from './sections/CaseProfileSection';
import CaseAuditSection from './sections/CaseAuditSection';
import CaseFlagConcernSheet from './CaseFlagConcernSheet';
import ClarificationFormCard from '@/features/clinical-clarification/ClarificationFormCard';
import RndClarifications from '@/features/clinical-clarification/RndClarifications';
import type { DetailData } from './review-types';

/** One paper composition for live review and immutable approval replay. */
export default function CaseEvidenceSheets({ detailData, canWrite = false, onUpdated = async () => {} }: {
  detailData: DetailData; canWrite?: boolean; onUpdated?: () => Promise<void>;
}) {
  const meal = detailData.mealPlan;
  const findings = detailData.warnings.filter(warning => warning.severity === 'CRITICAL');
  const dateLabel = meal.scheduledDate && !Number.isNaN(new Date(meal.scheduledDate).getTime())
    ? formatManilaDate(meal.scheduledDate, { dateStyle: 'medium' }) : 'Date not recorded';
  return <>
        <ReviewDocumentPage
          page={1}
          title="Member health profile"
          subtitle={`${detailData.user.name} · ${dateLabel}`}
        >
          <CaseProfileSection model={{ detailData }} paper />
        </ReviewDocumentPage>
        <ReviewDocumentPage
          page={2}
          title="Meal evidence"
          subtitle={`${formatMealTitle(meal.mealName)} · ${meal.mealType} · ${dateLabel}`}
        >
          <CaseAuditSection model={{ detailData }} paper />
          {findings.length > 0 && (
            <section aria-label="Critical review findings" className="space-y-3 border-t border-brand-border pt-4">
              <h3 className="font-bold">Critical review findings</h3>
              {findings.map((warning, index) => (
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
            subtitle={form.purpose === 'MEAL' ? 'Meal question and recorded response' : 'Saved profile clarification · read only'}
          >
            {form.purpose === 'MEAL' && detailData.reviewContext ? <RndClarifications
              userId={meal.userId} profileRevision={detailData.reviewContext.profileRevision} scopeKey={detailData.reviewContext.scopeKey}
              workspace={{ enabled: true, forms: [form] }} canWrite={canWrite} onUpdated={onUpdated}
              showComposer={false} embedded
              publishTarget={{ url: `/nutritionist/queue/${meal.id}/clarifications`, expectedContextKey: detailData.reviewContext.contextKey, purpose: 'MEAL' }}
            /> : <ClarificationFormCard form={form} mode="reviewer" embedded />}
          </ReviewDocumentPage>
        ))}
  </>;
}
