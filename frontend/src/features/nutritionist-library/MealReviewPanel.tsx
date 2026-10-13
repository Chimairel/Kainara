'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import MealReviewTimeline, { reviewStateLabel, type ReviewIncident } from './MealReviewTimeline';
import RecipeDerivationForm from './RecipeDerivationForm';
import RndQueueDocument, { ReviewDocumentPage } from '@/features/nutritionist-reviews/RndQueueDocument';
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
  claimStatus?: { claimedByMe: boolean; claimedByOther: boolean };
};
const field = 'min-h-11 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm text-brand-text';
export default function MealReviewPanel({
  meal,
  isAdmin,
  refresh,
  flagOpen,
  onFlagOpenChange,
  embedded = false,
}: {
  meal: LibraryMeal;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  embedded?: boolean;
  flagOpen?: boolean;
  onFlagOpenChange?: (open: boolean) => void;
}) {
  const ownerId = useAuth().user?.userId;
  const base = isAdmin ? '/admin' : '/nutritionist';
  const query = useSessionQuery<ReviewCase>({
    ownerId,
    resource: `recipe-review:${base}:${meal.id}:${meal.safetyEvidenceRevision}`,
    fetcher: async () => (await api.get(`${base}/meal-review-cases/${meal.id}`)).data.data,
    errorMessage: 'Review history could not be loaded.',
  });
  const flagFormId = useId();
  const [localFlagOpen, setLocalFlagOpen] = useState(false);
  const isFlagOpen = flagOpen ?? localFlagOpen;
  const setFlagOpen = onFlagOpenChange ?? setLocalFlagOpen;
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('NUTRITION');
  const [affected, setAffected] = useState('');
  const [explanation, setExplanation] = useState('');
  const [reference, setReference] = useState('');
  const [correction, setCorrection] = useState('');
  const [rationale, setRationale] = useState('');
  const [evidenceReviewed, setEvidenceReviewed] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(false);
  const [savedVersion, setSavedVersion] = useState<string | null>(null);
  const data = query.data;
  useEffect(() => {
    setEvidenceReviewed(false);
    setResolutions({});
    setResolved({});
    setRationale('');
  }, [data?.reviewVersion, data?.claimStatus?.claimedByMe]);
  const held = data?.state === 'PENDING_REREVIEW' || data?.state === 'QUARANTINED';
  const decisionControls =
    data && held && (isAdmin || data.state !== 'QUARANTINED') ? (
      <div className="flex flex-wrap gap-3">
        {isAdmin ? (
          <>
            <Button
              disabled={busy || !data.canAdminRelease || rationale.trim().length < 20}
              onClick={() => void mutate('release')}
            >
              Release quarantine
            </Button>
            <Button
              variant="secondary"
              disabled={busy || rationale.trim().length < 20}
              onClick={() => void mutate('archive')}
            >
              Archive unresolved recipe
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={busy || data.claimStatus?.claimedByMe || data.claimStatus?.claimedByOther}
              onClick={() => void mutate('claim')}
            >
              Claim re-review
            </Button>
            <Button
              disabled={
                busy ||
                savedVersion === data.reviewVersion ||
                !data.claimStatus?.claimedByMe ||
                !evidenceReviewed ||
                rationale.trim().length < 20 ||
                data.incident?.reports.some(
                  (report) => !resolved[report.id] || (resolutions[report.id]?.trim().length ?? 0) < 20
                )
              }
              onClick={() => void mutate('confirm')}
            >
              Re-verify recipe
            </Button>
          </>
        )}
      </div>
    ) : undefined;
  async function mutate(action: 'flag' | 'claim' | 'confirm' | 'release' | 'archive') {
    if (!data || submitting.current || busy || (action === 'confirm' && savedVersion === data.reviewVersion)) return;
    if (action === 'flag' && (!affected.trim() || explanation.trim().length < 20 || reference.trim().length < 10 || correction.trim().length < 10 || data.state === 'ARCHIVED')) return;
    if (
      action === 'confirm' &&
      (!data.claimStatus?.claimedByMe || data.incident?.reports.some((report) => !resolved[report.id]))
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      const url =
        action === 'flag' ? `${base}/library/${meal.id}/flag` : `${base}/meal-review-cases/${meal.id}/${action}`;
      const payload =
        action === 'flag'
          ? {
              expectedVersion: data.recipeVersion,
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
          : {
              expectedVersion: data.reviewVersion,
              ...(action !== 'claim' ? { rationale } : {}),
              ...(action === 'confirm'
                ? {
                    evidenceReviewed,
                    riceRoleReviewed: evidenceReviewed,
                    resolutions: (data.incident?.reports ?? []).map((report) => ({
                      reportId: report.id,
                      rationale: resolutions[report.id] ?? '',
                    })),
                  }
                : {}),
            };
      const response = await api.post(url, payload);
      if (response.data?.success !== true) throw new Error('Unconfirmed review action');
      if (action === 'flag') {
        setFlagOpen(false);
        setAffected(''); setExplanation(''); setReference(''); setCorrection('');
        toast.success(held ? 'Additional evidence recorded.' : 'Meal flagged for review.');
      }
      if (action === 'confirm') setSavedVersion(data.reviewVersion);
      setMessage(
        action === 'flag' ? '' : action === 'claim' ? 'Claimed for 30 minutes. Review every concern before confirming.' : 'Decision recorded.'
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
      {!data && isFlagOpen && <Modal isOpen onClose={() => setFlagOpen(false)} title="Flag meal" size="xl">
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
          {held && data.incident && (
            <RndQueueDocument
              title={`Recipe re-review · ${formatMealTitle(meal.mealName)}`}
              contentKey={`${meal.id}:${data.reviewVersion}`}
              expanded={expanded}
              onExpandedChange={setExpanded}
              onBack={() => setExpanded(false)}
              actions={null}
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
                title="Flag concerns and resolutions"
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
                      note={resolutions[report.id] ?? ''}
                      resolved={Boolean(resolved[report.id])}
                      canWrite={
                        !isAdmin && data.state !== 'QUARANTINED' && Boolean(data.claimStatus?.claimedByMe) && !busy
                      }
                      onNote={(value) => {
                        setResolutions({ ...resolutions, [report.id]: value });
                        setResolved({ ...resolved, [report.id]: false });
                      }}
                      onResolve={() => setResolved({ ...resolved, [report.id]: true })}
                    />
                  ))}
                  {(isAdmin || data.state !== 'QUARANTINED') && (
                    <>
                      <label className="block text-sm font-semibold">
                        {isAdmin ? 'Administrative rationale' : 'Independent review findings'}
                        <textarea
                          className={`${field} mt-2`}
                          minLength={20}
                          maxLength={3000}
                          rows={3}
                          value={rationale}
                          onChange={(event) => setRationale(event.target.value)}
                        />
                      </label>
                      {!isAdmin && (
                        <label className="flex min-h-11 items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={evidenceReviewed}
                            onChange={(event) => setEvidenceReviewed(event.target.checked)}
                          />
                          I reviewed the nutrition evidence, measured ingredients, preparation and rice role for every
                          serving variant.
                        </label>
                      )}
                    </>
                  )}
                  <p className="text-xs text-brand-muted">
                    {data.state === 'QUARANTINED'
                      ? 'Admin release records an administrative decision. Member-specific clinical approvals still require RND review.'
                      : 'Authors, flaggers and challenged verifiers cannot re-verify this incident. Corrections and new evidence invalidate prior confirmations.'}
                  </p>
                  {!isAdmin && (
                    <RecipeDerivationForm
                      key={`correction-${data.reviewVersion}`}
                      meal={meal}
                      correctionVersion={data.reviewVersion}
                      onCreated={() => {
                        void query.refetch();
                        void refresh();
                      }}
                    />
                  )}
                </div>
              </ReviewDocumentPage>
            </RndQueueDocument>
          )}
          {data.state !== 'ARCHIVED' && (
            <>
              {held && <Button variant="secondary" disabled={busy} onClick={() => setFlagOpen(true)}>Add evidence to this incident</Button>}
              {!held && !onFlagOpenChange && <Button variant="secondary" onClick={() => setFlagOpen(true)}>Flag meal</Button>}
              <Modal isOpen={isFlagOpen} onClose={() => { if (!submitting.current) setFlagOpen(false); }} size="xl" layer="canvas"
                title={held ? 'Add evidence to this incident' : 'Flag meal'}
                description={held ? 'Record another concern for the current meal review.' : 'This withholds the meal and its serving variants until independent review.'}
                footer={<>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => setFlagOpen(false)}>Cancel</Button>
                  <Button type="submit" form={flagFormId} isLoading={busy} disabled={busy || !affected.trim() || explanation.trim().length < 20 || reference.trim().length < 10 || correction.trim().length < 10}>
                    {held ? 'Record evidence' : 'Flag and withhold meal'}
                  </Button>
                </>}>
                <form id={flagFormId} className="space-y-5" aria-busy={busy} onSubmit={event => { event.preventDefault(); void mutate('flag'); }}>
                  <p className="border-b border-brand-border pb-4 text-sm font-semibold">{formatMealTitle(meal.mealName)}</p>
                  <div className="grid gap-4 sm:grid-cols-[1fr_1.5fr]">
                    <label className="block space-y-2 text-sm font-semibold">Concern category
                      <Dropdown value={category} onChange={setCategory} disabled={busy} className="w-full !text-base">
                        {['INGREDIENT', 'NUTRITION', 'ALLERGEN', 'PREPARATION', 'EVIDENCE', 'OTHER'].map(value => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}
                      </Dropdown>
                    </label>
                    <div className="space-y-2 text-sm">
                      <label className="block font-semibold" htmlFor="flag-affected">Affected ingredients or nutrition fields</label>
                      <input id="flag-affected" className={field.replace('text-sm', 'text-base')} disabled={busy} required value={affected} onChange={event => setAffected(event.target.value)} maxLength={2000} placeholder="e.g. sodiumMg, salt" aria-describedby="flag-affected-help" />
                      <p id="flag-affected-help" className="text-xs text-brand-muted">Separate multiple fields with commas.</p>
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {([
                      ['explanation', 'Explanation', explanation, setExplanation, 3000, 20],
                      ['reference', 'Supporting evidence or reference', reference, setReference, 2000, 10],
                      ['correction', 'Proposed correction', correction, setCorrection, 2000, 10],
                    ] as const).map(([id, label, value, setter, maximum, minimum]) => (
                      <div className={`space-y-2 text-sm ${id === 'explanation' ? 'sm:col-span-2' : ''}`} key={id}>
                        <label className="block font-semibold" htmlFor={`flag-${id}`}>{label}</label>
                        <textarea id={`flag-${id}`} className={field.replace('text-sm', 'text-base')} disabled={busy} required minLength={minimum} maxLength={maximum}
                          rows={id === 'explanation' ? 3 : 2} value={value} onChange={event => setter(event.target.value)} aria-describedby={`flag-${id}-help`} />
                        <p id={`flag-${id}-help`} className="text-xs text-brand-muted">At least {minimum} characters.</p>
                      </div>
                    ))}
                  </div>
                </form>
              </Modal>
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
