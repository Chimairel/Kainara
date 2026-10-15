'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import MealFlagCanvas from './MealFlagCanvas';
import { useFlagDraft } from '@/features/nutritionist-reviews/useFlagDraft';
import MealReviewTimeline, { reviewStateLabel, type ReviewIncident } from './MealReviewTimeline';
import RndQueueDocument, { ReviewDocumentPage } from '@/features/nutritionist-reviews/RndQueueDocument';
import CanvasToolButton from '@/features/nutritionist-reviews/CanvasToolButton';
import ConcernResolution from '@/features/nutritionist-reviews/ConcernResolution';
import { formatMealTitle } from '@/lib/meal-title';
import type { LibraryMeal } from './useNutritionistLibrary';

export type ReviewCase = {
  recipeVersion: string;
  reviewVersion: string;
  state: string;
  incidentCount: number;
  legacyHistoryUnknown: boolean;
  incident: (ReviewIncident & { claimedByNutritionistId: string | null }) | null;
  history: ReviewIncident[];
  validConfirmations: unknown[];
  canAdminRelease: boolean;
  claimStatus?: { claimedByMe: boolean; claimedByOther: boolean; reviewerInvolved?: boolean };
};
const field = 'min-h-11 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm text-brand-text';
export default function MealReviewPanel({
  meal,
  isAdmin,
  refresh,
  canvasOpen,
  onCanvasOpenChange,
  embedded = false,
}: {
  meal: LibraryMeal;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  embedded?: boolean;
  canvasOpen?: boolean;
  onCanvasOpenChange?: (open: boolean) => void;
}) {
  const ownerId = useAuth().user?.userId;
  const base = isAdmin ? '/admin' : '/nutritionist';
  const query = useSessionQuery<ReviewCase>({
    ownerId,
    resource: `recipe-review:${base}:${meal.id}:${meal.safetyEvidenceRevision}`,
    fetcher: async () => (await api.get(`${base}/meal-review-cases/${meal.id}`)).data.data,
    errorMessage: 'Review history could not be loaded.',
  });
  const [localCanvasOpen, setLocalCanvasOpen] = useState(false);
  const isCanvasOpen = canvasOpen ?? localCanvasOpen;
  const setCanvasOpen = onCanvasOpenChange ?? setLocalCanvasOpen;
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [rationale, setRationale] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const data = query.data;
  const flagDraft = useFlagDraft(isCanvasOpen ? { kind: 'MEAL', targetId: meal.id } : null, data?.recipeVersion, isAdmin);
  const { category, affectedFields: affected, explanation, reference, proposedCorrection: correction } = flagDraft.notes;
  useEffect(() => {
    setResolutionOpen(false);
    setRationale('');
  }, [data?.reviewVersion, data?.claimStatus?.claimedByMe]);
  const held = data?.state === 'PENDING_REREVIEW' || data?.state === 'QUARANTINED';
  const decisionControls = data && held && isAdmin ? (
    <div className="flex flex-wrap gap-3">
      <Button disabled={busy || !data.canAdminRelease || rationale.trim().length < 20} onClick={() => void mutate('release')}>
        Release quarantine
      </Button>
      <Button variant="secondary" disabled={busy || rationale.trim().length < 20} onClick={() => void mutate('archive')}>
        Archive unresolved recipe
      </Button>
    </div>
  ) : undefined;
  async function mutate(action: 'flag' | 'release' | 'archive') {
    if (!data || submitting.current || busy) return;
    if (action === 'flag' && (!flagDraft.draftId || !affected.trim() || explanation.trim().length < 20 || reference.trim().length < 10 || correction.trim().length < 10 || data.state === 'ARCHIVED')) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      if (action === 'flag' && !await flagDraft.save()) return;
      const url =
        action === 'flag' ? `${base}/library/${meal.id}/flag` : `${base}/meal-review-cases/${meal.id}/${action}`;
      const payload =
        action === 'flag'
          ? {
              expectedVersion: data.recipeVersion,
              flagDraftId: flagDraft.draftId,
              notes: {
                category,
                affectedFields: affected
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
                explanation,
                reference,
                proposedCorrection: correction,
              },
            }
          : { expectedVersion: data.reviewVersion, rationale };
      const response = await api.post(url, payload);
      if (response.data?.success !== true) throw new Error('Unconfirmed review action');
      if (action === 'flag') {
        setCanvasOpen(false);
        flagDraft.completed();
        toast.success(held ? 'Additional evidence recorded.' : 'Meal flagged for review.');
      }
      setMessage(
        action === 'flag' ? '' : 'Decision recorded.'
      );
      const showRefreshWarning = () => {
        const warning = 'Decision recorded. Reload the history to see the current review state.';
        if (action === 'flag') toast.warning(warning); else setMessage(warning);
      };
      try {
        const updated = await query.refetch();
        if (!updated) showRefreshWarning();
        await refresh();
      } catch {
        showRefreshWarning();
      }
    } catch (err) {
      const failure = (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        'The review action failed. Refresh and try again.';
      if (action === 'flag') toast.error(failure);
      else setError(failure);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      id="meal-wide-review"
      aria-label="Meal-wide review"
      className={embedded ? "space-y-5" : "scroll-mt-20 space-y-5 rounded-2xl border border-brand-border bg-brand-surface/60 p-5"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Meal-wide review</h2>
        {data && <strong className="rounded-full bg-brand-bg px-3 py-2 text-sm">{reviewStateLabel(data.state)}</strong>}
      </div>
      {(error || query.error) && <FeedbackNotice variant="inline">{error || query.error}</FeedbackNotice>}
      {message && (
        <p role="status" className="text-sm text-brand-green">
          {message}
        </p>
      )}
      {query.isLoading && !data && <p role="status">Loading recorded review history…</p>}
      {query.error && (
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Retry history
        </Button>
      )}
      {!data && isCanvasOpen && <Modal isOpen onClose={() => setCanvasOpen(false)} title="Meal details" size="xl">
        {query.error ? <><p>{query.error}</p><Button variant="secondary" onClick={() => void query.refetch()}>Retry history</Button></> : <p role="status">Loading the current meal version…</p>}
      </Modal>}
      {data && (
        <>
          <p className="text-sm text-brand-muted">
            {held
              ? 'This recipe and its serving variants are unavailable. Existing member slots still need fresh safety checks after release.'
              : 'A flag immediately withholds this recipe and its serving variants from member use.'}{' '}
            Profile and condition approval concerns are handled separately.
          </p>
          {held && !isAdmin && data.incident && <div className="space-y-6">
            {data.state === 'QUARANTINED' && <p className="text-sm">Only an admin can release or archive this quarantined recipe.</p>}
            {data.incident.reports.map(report => <ConcernResolution key={report.id} concern={report}
              note="" resolved={false} canWrite={false} onNote={() => {}} onResolve={() => {}} />)}
          </div>}
          {held && !isAdmin && data.state === 'PENDING_REREVIEW' && <Link
            className="inline-flex min-h-11 items-center rounded-full bg-brand-green px-5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            href={`/nutritionist/reviews?workspace=meal&recipeId=${encodeURIComponent(meal.id)}`}>
            Open meal verification
          </Link>}
          {held && isAdmin && data.incident && (
            <>
            <RndQueueDocument
              title={`Recipe re-review · ${formatMealTitle(meal.mealName)}`}
              contentKey={`${meal.id}:${data.reviewVersion}`}
              expanded={expanded}
              onExpandedChange={setExpanded}
              onBack={() => setExpanded(false)}
              actions={null}
              tools={<CanvasToolButton disabled={busy} onClick={() => setResolutionOpen(true)}>Resolve concerns</CanvasToolButton>}
              decision={decisionControls}
            >
              <ReviewDocumentPage page={1} title="Recipe evidence" subtitle={formatMealTitle(meal.mealName)}>
                <p className="text-sm leading-6">{meal.description || 'No preparation description recorded.'}</p>
                <dl className="mt-6 grid grid-cols-4 gap-3 text-sm">
                  {(
                    [
                      ['Energy', meal.calories, 'kcal'],
                      ['Protein', meal.proteinG, 'g'],
                      ['Carbs', meal.carbsG, 'g'],
                      ['Fat', meal.fatG, 'g'],
                    ] as const
                  ).map(([label, value, unit]) => (
                    <div key={label}>
                      <dt className="text-brand-muted">{label}</dt>
                      <dd className="font-bold">
                        {value} {unit}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm">
                  {meal.nutritionServingDescription || 'Serving description not recorded.'}
                </p>
                <h3 className="mt-6 font-bold">Measured ingredients</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {meal.ingredients?.map((item, index) => (
                    <li key={index}>
                      {item.ingredientName} · {item.quantity ?? 'Not recorded'} {item.unit ?? ''}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-xs text-brand-muted">
                  Review all serving variants and source evidence before re-verification.
                </p>
              </ReviewDocumentPage>
              <ReviewDocumentPage
                page={2}
                title="Recorded flag concerns"
                subtitle="Resolve every concern before re-verifying"
              >
                <div className="space-y-6">
                  <p className="text-sm font-semibold">
                    {data.state === 'QUARANTINED'
                      ? 'Quarantined after repeated flags. Only an admin can release or archive this recipe.'
                      : 'One uninvolved eligible RND can re-verify the current version.'}
                  </p>
                  {data.incident.reports.map((report) => (
                    <ConcernResolution
                      key={report.id}
                      concern={report}
                      note=""
                      resolved={false}
                      canWrite={false}
                      onNote={() => {}}
                      onResolve={() => {}}
                    />
                  ))}
                  <p className="text-xs text-brand-muted">
                    {data.state === 'QUARANTINED'
                      ? 'Admin release records an administrative decision. Member-specific clinical approvals still require RND review.'
                      : 'Authors, flaggers and challenged verifiers cannot re-verify this incident. Corrections and new evidence invalidate prior confirmations.'}
                  </p>
                </div>
              </ReviewDocumentPage>
            </RndQueueDocument>
            <Modal isOpen={resolutionOpen} onClose={() => { if (!busy) setResolutionOpen(false); }} layer="canvas" size="xl"
              title="Administrative resolution" footer={decisionControls}>
              <div className="space-y-6">
                  {data.incident.reports.map((report) => (
                    <ConcernResolution
                      key={report.id}
                      concern={report}
                      note=""
                      resolved={false}
                      canWrite={false}
                      onNote={() => {}}
                      onResolve={() => {}}
                    />
                  ))}
                  {(isAdmin || data.state !== 'QUARANTINED') && (
                    <>
                      <label className="block text-sm font-semibold">
                        Administrative rationale
                        <textarea
                          className={`${field} mt-2`}
                          minLength={20}
                          maxLength={3000}
                          rows={3}
                          value={rationale}
                          onChange={(event) => setRationale(event.target.value)}
                        />
                      </label>
                    </>
                  )}
              </div>
            </Modal>
            </>
          )}
          {data.state !== 'ARCHIVED' && (
            <>
              {held && <Button variant="secondary" disabled={busy} onClick={() => setCanvasOpen(true)}>Add evidence to this incident</Button>}
              {!held && !onCanvasOpenChange && <Button variant="secondary" onClick={() => setCanvasOpen(true)}>Details</Button>}
              {isCanvasOpen && <MealFlagCanvas meal={meal} busy={busy} error={error}
                draft={flagDraft}
                onClose={() => { if (!submitting.current) setCanvasOpen(false); }}
                onSubmit={() => void mutate('flag')} />}

            </>
          )}
          <MealReviewTimeline
            history={data.history}
            legacyHistoryUnknown={data.legacyHistoryUnknown}
            displayedReportIds={data.incident?.reports.map((report) => report.id)}
          />
        </>
      )}
    </section>
  );
}
