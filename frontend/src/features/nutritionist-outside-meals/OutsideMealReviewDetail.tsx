'use client';
import { useEffect, useState } from 'react';
import { formatManilaDate } from '@/lib/manila-date';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import { MessageSquare } from '@/components/ui/icons';
import CanvasToolButton from '@/features/nutritionist-reviews/CanvasToolButton';
import RndQueueDocument, { ReviewDocumentPage } from '@/features/nutritionist-reviews/RndQueueDocument';
import type { useOutsideMealReviewsPanelModel } from './useOutsideMealReviewsPanelModel';

type Model = ReturnType<typeof useOutsideMealReviewsPanelModel>;
export default function OutsideMealReviewDetail({
  model,
  expanded,
  setExpanded,
}: {
  model: Model;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
}) {
  const [composing, setComposing] = useState(false);
  const selectedId = model.selected?.id;
  useEffect(() => {
    setComposing(false);
    if (!selectedId) setExpanded(false);
  }, [selectedId, setExpanded]);
  const row = model.selected;
  if (!row)
    return (
      <div className="p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold">Feedback on logged food</h2>
        <p className="mt-3 max-w-prose text-sm leading-6 text-brand-muted">
          Select a request to see the food and its recorded nutrition. Send practical advice for the member’s next food
          choice.
        </p>
      </div>
    );
  const item = row.outsideMealLogItem;
  return (
    <RndQueueDocument
      title={`Outside food · ${item.name}`}
      contentKey={`outside:${row.id}`}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onBack={() => model.selectReview(null)}
      actions={null}
      hideDecisionDock
      focusSheet={composing ? { title: 'RND feedback', request: 1 } : undefined}
      tools={
        <CanvasToolButton
          title="Write feedback"
          aria-label="Write feedback"
          aria-pressed={composing}
          disabled={model.busy || row.claimStatus.claimedByOther}
          onClick={() => setComposing((value) => !value)}
        >
          <MessageSquare className="h-5 w-5" />
        </CanvasToolButton>
      }
    >
      <ReviewDocumentPage
        page={1}
        title="Logged food"
        subtitle={`${item.mealLog.mealType ?? 'Meal'} · ${formatManilaDate(new Date(item.mealLog.loggedAt), { dateStyle: 'medium', timeStyle: 'short' })}`}
        footer="Logged intake · feedback does not change nutrition values"
      >
        <h2 className="font-display text-xl font-bold">{item.name}</h2>
        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          {(
            [
              ['Energy', item.calories, 'kcal'],
              ['Protein', item.proteinG, 'g'],
              ['Carbohydrates', item.carbsG, 'g'],
              ['Fat', item.fatG, 'g'],
            ] as const
          ).map(([label, value, unit]) => (
            <div key={label} className="border-b border-brand-border pb-3">
              <dt className="text-brand-muted">{label}</dt>
              <dd className="mt-1 font-semibold tabular-nums">{value == null ? 'Not recorded' : `${value} ${unit}`}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 space-y-3 text-sm leading-6">
          {item.mealLog.user && (
            <section className="border-b border-brand-border pb-4">
              <h3 className="font-bold">{item.mealLog.user.name}</h3>
              <p>
                Conditions:{' '}
                {[
                  ...item.mealLog.user.healthConditions.map((row) => row.condition.replaceAll('_', ' ')),
                  item.mealLog.user.userProfile?.otherConditions,
                ]
                  .filter(Boolean)
                  .join(', ') || 'None recorded'}
              </p>
              <p>
                Allergies:{' '}
                {[
                  ...item.mealLog.user.allergies.map((row) => row.allergen.replaceAll('_', ' ')),
                  item.mealLog.user.userProfile?.otherAllergies,
                ]
                  .filter(Boolean)
                  .join(', ') || 'None recorded'}
              </p>
              <p>Diet: {item.mealLog.user.userProfile?.dietaryPreference?.replaceAll('_', ' ') || 'Not recorded'}</p>
            </section>
          )}
          <p>Portion: {item.portionGrams == null ? 'Not recorded' : `${item.portionGrams} g`}</p>
          {item.mealLog.estimationContext && <p>{item.mealLog.estimationContext}</p>}
          {!!item.ingredients?.length && (
            <section>
              <h3 className="font-bold">Recorded ingredients</h3>
              <p>{item.ingredients.join(', ')}</p>
            </section>
          )}
          {item.mealLog.outsideImageMime && (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const response = await api.get(`/nutritionist/outside-meal-reviews/${row.id}/image`, {
                    responseType: 'blob',
                  });
                  const url = URL.createObjectURL(response.data);
                  window.open(url, '_blank', 'noopener,noreferrer');
                  setTimeout(() => URL.revokeObjectURL(url), 60_000);
                } catch (error) {
                  model.setError(getApiErrorMessage(error, 'Could not open the attached photo.'));
                }
              }}
            >
              View attached photo
            </Button>
          )}
        </div>
        {model.error && <FeedbackNotice className="mt-6">{model.error}</FeedbackNotice>}
      </ReviewDocumentPage>
      {!!row.messages?.length && (
        <ReviewDocumentPage page={2} title="Previous conversation" footer="Saved food feedback and replies">
          <div className="space-y-6">
            {row.messages.map((message) => (
              <section key={message.id}>
                <h3 className="text-sm font-semibold">
                  {message.sender === 'NUTRITIONIST' ? 'RND' : 'Member'} · Food revision {message.itemRevision}
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              </section>
            ))}
          </div>
        </ReviewDocumentPage>
      )}
      {composing && (
        <ReviewDocumentPage
          page={row.messages?.length ? 3 : 2}
          title="RND feedback"
          subtitle="Draft · not sent"
          footer="Advice for future choices · logged intake remains unchanged"
        >
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void model.sendFeedback();
            }}
          >
            <label className="block text-sm font-semibold">
              Feedback for the member
              <textarea
                rows={8}
                minLength={3}
                maxLength={500}
                required
                disabled={model.busy}
                value={model.feedback}
                onChange={(event) => model.setFeedback(event.target.value)}
                placeholder="Explain the concern and suggest a practical alternative."
                className="mt-3 block w-full rounded-xl border border-brand-border bg-brand-bgAlt p-4 text-sm font-normal leading-6 outline-none focus:ring-2 focus:ring-brand-green"
              />
            </label>
            {model.error && <FeedbackNotice>{model.error}</FeedbackNotice>}
            <div className="flex gap-3 border-t border-brand-border pt-5">
              <Button
                type="submit"
                isLoading={model.busy}
                disabled={model.busy || row.claimStatus.claimedByOther || model.feedback.trim().length < 3}
              >
                Send feedback
              </Button>
              <Button type="button" variant="secondary" disabled={model.busy} onClick={() => setComposing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </ReviewDocumentPage>
      )}
    </RndQueueDocument>
  );
}
