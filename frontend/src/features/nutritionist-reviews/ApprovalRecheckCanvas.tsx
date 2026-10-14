'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatMealTitle } from '@/lib/meal-title';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import CanvasToolButton from './CanvasToolButton';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import RndQueueDocument, { ReviewDocumentPage } from './RndQueueDocument';
import ConcernResolution, { type ReviewConcern } from './ConcernResolution';
import { useAuth } from '@/hooks/useAuth';
import { useRequestScope } from '@/hooks/useRequestScope';

export type ApprovalReviewTarget = { mealLibraryId: string; approvalId: string; kind: 'PROFILE' | 'CONDITION' };
type Plate = {
  mealName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  description?: string;
  ingredients?: Array<{ ingredientName: string; quantity: number | null; unit: string | null }>;
};
type Detail = {
  meal: Plate;
  originatingPlan: Plate | null;
  recordedCaseScope?: unknown;
  recordedScope?: unknown;
  flagReview: {
    expectedVersion: string;
    state: string;
    canResolve: boolean;
    blockedByRecipe: boolean;
    matchesCurrentRecipe: boolean;
    concern: ReviewConcern;
  };
};
export default function ApprovalRecheckCanvas({
  target,
  onClose,
  onVerified,
}: {
  target: ApprovalReviewTarget;
  onClose: () => void;
  onVerified: () => Promise<void>;
}) {
  const ownerId = useAuth().user?.userId;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState('');
  const [resolved, setResolved] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const key = `${ownerId}:${target.kind}:${target.approvalId}:${target.mealLibraryId}`;
  const captureScope = useRequestScope(key);
  useEffect(() => {
    const abort = new AbortController();
    setDetail(null);
    setNote('');
    setResolved(false);
    setResolutionOpen(false);
    setError('');
    setBusy(false);
    api
      .get(`/nutritionist/library/${target.mealLibraryId}/approvals/${target.kind}/${target.approvalId}`, {
        signal: abort.signal,
      })
      .then((response) => {
        if (abort.signal.aborted) return;
        const value = response.data?.data as Detail | undefined;
        if (!value?.meal || typeof value.meal.mealName !== 'string' ||
          !value.flagReview || typeof value.flagReview.expectedVersion !== 'string' ||
          typeof value.flagReview.state !== 'string' ||
          typeof value.flagReview.canResolve !== 'boolean' ||
          typeof value.flagReview.blockedByRecipe !== 'boolean' ||
          typeof value.flagReview.matchesCurrentRecipe !== 'boolean' ||
          !value.flagReview.concern?.notes ||
          typeof value.flagReview.concern.id !== 'string' ||
          typeof value.flagReview.concern.notes.explanation !== 'string') {
          throw new Error('Approval evidence could not be loaded.');
        }
        setDetail(value);
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(getApiErrorMessage(failure, 'Approval evidence could not be loaded.'));
      });
    return () => abort.abort();
  }, [key, retry, target.approvalId, target.kind, target.mealLibraryId]);
  const blocked =
    !detail?.flagReview ||
    !detail.flagReview.canResolve ||
    detail.flagReview.blockedByRecipe ||
    !detail.flagReview.matchesCurrentRecipe ||
    !['FLAGGED', 'SUSPENDED', 'REVIEW_DUE'].includes(detail.flagReview.state);
  const blockedReason = !detail?.flagReview
    ? 'Current approval evidence is unavailable. Reload evidence.'
    : !detail.flagReview.canResolve
      ? 'An uninvolved RND is required to resolve this flagged approval.'
      : detail.flagReview.blockedByRecipe
        ? 'This recipe is held. Resolve its recipe review first.'
        : !detail.flagReview.matchesCurrentRecipe
          ? 'The recipe evidence changed. Review its current variant instead.'
          : 'This approval no longer needs recheck. Reload evidence.';
  const verify = async () => {
    if (busy || !resolved || blocked || !detail) return;
    const isCurrent = captureScope();
    setBusy(true);
    setError('');
    try {
      await api.post(`/nutritionist/library/${target.mealLibraryId}/approvals/${target.approvalId}/recheck`, {
        kind: target.kind,
        rationale: note.trim(),
        expectedVersion: detail.flagReview.expectedVersion,
        resolved: true,
      });
    } catch (failure) {
      if (isCurrent()) {
        setError(getApiErrorMessage(failure, 'Verification was not saved. Reload current evidence before retrying.'));
        setResolved(false);
        setDetail(null);
        setBusy(false);
      }
      return;
    }
    if (!isCurrent()) return;
    // The decision is already saved; a refresh failure must not invite another submission.
    try {
      await onVerified();
      if (isCurrent()) onClose();
    } catch {
      if (isCurrent()) {
        setError('Verification saved. Close this canvas and refresh the queue.');
        setDetail(null);
      }
    }
    if (isCurrent()) setBusy(false);
  };
  const plate = detail?.originatingPlan ?? detail?.meal;
  const scope = detail?.recordedCaseScope ?? detail?.recordedScope;
  const scopeValues =
    scope && typeof scope === 'object' && !Array.isArray(scope)
      ? Object.entries(scope).filter(([, value]) => Array.isArray(value) && value.length)
      : [];
  return (
    <>
    <RndQueueDocument
      title={`Approval recheck · ${formatMealTitle(plate?.mealName ?? 'Recorded case')}`}
      contentKey={key}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onBack={onClose}
      tools={<CanvasToolButton disabled={blocked || busy} onClick={() => setResolutionOpen(true)}>Resolve concern</CanvasToolButton>}
      actions={
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRetry(retry + 1)}>
          Reload evidence
        </Button>
      }
      decision={
        <Button disabled={busy || !resolved || blocked} isLoading={busy} onClick={() => void verify()}>
          Verify resolved case
        </Button>
      }
    >
      <ReviewDocumentPage
        page={1}
        title="Recorded case evidence"
        subtitle={target.kind === 'PROFILE' ? 'Exact profile approval' : 'Recorded condition approval'}
      >
        {error && <FeedbackNotice>{error}</FeedbackNotice>}
        {!detail && !error && <p role="status">Loading recorded approval evidence…</p>}
        {plate && (
          <>
            <h3 className="text-lg font-bold">{formatMealTitle(plate.mealName)}</h3>
            <p className="mt-3 text-sm leading-6">{plate.description || 'Preparation description not recorded.'}</p>
            <dl className="mt-6 grid grid-cols-4 gap-3 text-sm">
              {(
                [
                  ['Energy', plate.calories, 'kcal'],
                  ['Protein', plate.proteinG, 'g'],
                  ['Carbs', plate.carbsG, 'g'],
                  ['Fat', plate.fatG, 'g'],
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
            <h3 className="mt-6 font-bold">Recorded restrictions</h3>
            {scopeValues.length ? (
              <dl className="mt-3 space-y-2 text-sm">
                {scopeValues.map(([label, values]) => (
                  <div key={label}>
                    <dt className="font-semibold">{label.replace(/([A-Z])/g, ' $1')}</dt>
                    <dd>{(values as unknown[]).map(String).join(', ').replaceAll('_', ' ')}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-brand-muted">No additional recorded restrictions available.</p>
            )}
            <h3 className="mt-6 font-bold">Ingredients</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {plate.ingredients?.map((item, index) => (
                <li key={index}>
                  {item.ingredientName} · {item.quantity ?? 'Not recorded'} {item.unit ?? ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </ReviewDocumentPage>
      <ReviewDocumentPage
        page={2}
        title="Recorded flag concern"
        subtitle="An uninvolved RND must review the recorded concern"
      >
        {detail?.flagReview && (
          <>
            {blocked && <FeedbackNotice tone="warning">{blockedReason}</FeedbackNotice>}
            <ConcernResolution
              concern={detail.flagReview.concern}
              note={note}
              resolved={resolved}
              canWrite={false}
              maxLength={1000}
              onNote={(value) => {
                setNote(value);
                setResolved(false);
              }}
              onResolve={() => setResolved(true)}
            />
            <p className="mt-6 text-xs text-brand-muted">
              Your resolution and verification are saved together. Existing member meal holds remain until their own
              current-context checks.
            </p>
          </>
        )}
      </ReviewDocumentPage>
    </RndQueueDocument>
    <Modal isOpen={resolutionOpen && !!detail} onClose={() => { if (!busy) setResolutionOpen(false); }} layer="canvas" size="xl"
      title="Resolve flagged approval" footer={<Button disabled={busy || !resolved || blocked} isLoading={busy} onClick={() => void verify()}>Verify resolved case</Button>}>
      {detail && <ConcernResolution concern={detail.flagReview.concern} note={note} resolved={resolved}
        canWrite={!blocked && !busy} maxLength={1000}
        onNote={value => { setNote(value); setResolved(false); }} onResolve={() => setResolved(true)} />}
    </Modal>
    </>
  );
}
