'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import { Check, X, ShieldCheck, LogOut } from '@/components/ui/icons';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import type { LibraryMeal } from '@/features/nutritionist-library/useNutritionistLibrary';
import type { ReviewCase } from '@/features/nutritionist-library/MealReviewPanel';
import RndQueueDocument, { ReviewDocumentPage } from './RndQueueDocument';
import BaseMealEvidenceSheets from './BaseMealEvidenceSheets';
import ConcernResolution from './ConcernResolution';
import ReviewDecisionPage from './ReviewDecisionPage';
import CanvasToolButton from './CanvasToolButton';
import { ReviewDetailSkeleton } from './NutritionistReviewsSkeleton';

/** Flagged recipes reuse the same claim, evidence canvas and decision papers as case approval. */
export default function FlaggedRecipeCanvas({ mealId, expanded, onExpandedChange, onBack, onComplete, onClaimChange, hasOtherClaim = false }: {
  mealId: string; expanded: boolean; onExpandedChange: (open: boolean) => void; onBack: () => void;
  onComplete: () => Promise<void>; onClaimChange?: () => Promise<void>; hasOtherClaim?: boolean;
}) {
  const ownerId = useAuth().user?.userId;
  const query = useSessionQuery<{ meal: LibraryMeal; review: ReviewCase }>({ ownerId, resource: `flagged-recipe-canvas:${mealId}`,
    fetcher: async () => {
      const [meal, review] = await Promise.all([api.get(`/nutritionist/library/${mealId}`), api.get(`/nutritionist/meal-review-cases/${mealId}`)]);
      return { meal: meal.data.data, review: review.data.data };
    }, errorMessage: 'Recipe evidence could not be loaded. Please retry.' });
  const [action, setAction] = useState<'approve'|'reject'|null>(null), [note, setNote] = useState('');
  const [resolutions, setResolutions] = useState<Record<string,string>>({}), [resolved, setResolved] = useState<Record<string,boolean>>({});
  const [acknowledged, setAcknowledged] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  const data = query.data?.review, meal = query.data?.meal;
  const mine = Boolean(data?.claimStatus?.claimedByMe), involved = Boolean(data?.claimStatus?.reviewerInvolved);
  const canWrite = mine && !busy && data?.state === 'PENDING_REREVIEW';
  useEffect(() => { setAction(null); setNote(''); setResolutions({}); setResolved({}); setAcknowledged(false); }, [data?.reviewVersion, mine]);
  const reports = data?.incident?.reports ?? [];
  const resolvedAll = acknowledged && reports.length > 0 && reports.every(report => resolved[report.id] && (resolutions[report.id]?.trim().length ?? 0) >= 20);
  async function act(command: 'claim'|'release'|'approve'|'reject') {
    if (!data || submitting.current || (command === 'approve' && !resolvedAll)) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const body = { expectedVersion: data.reviewVersion, ...(['approve','reject'].includes(command) ? { rationale: note } : {}),
        ...(command === 'approve' ? { evidenceReviewed: acknowledged, riceRoleReviewed: acknowledged,
          resolutions: reports.map(report => ({ reportId: report.id, rationale: resolutions[report.id] })) } : {}) };
      const result = await api.post(`/nutritionist/meal-review-cases/${mealId}/${command === 'approve' ? 'confirm' : command}`, body);
      if (!result.data?.success) throw new Error('Decision was not confirmed.');
      window.dispatchEvent(new Event('nutrimind:review-work-updated'));
      if (command === 'approve' || command === 'reject') {
        toast.success(command === 'approve' ? 'Meal verified' : 'Recipe remains withheld for correction');
        await onComplete();
      } else {
        await query.refetch(); await onClaimChange?.();
      }
    } catch (failure) { setError(getApiErrorMessage(failure, 'The review could not be saved. Refresh and try again.')); }
    finally { submitting.current = false; setBusy(false); }
  }
  if (!meal || !data) return query.error ? <FeedbackNotice><p>{query.error}</p><Button onClick={() => void query.refetch()}>Retry details</Button></FeedbackNotice> : <ReviewDetailSkeleton />;
  const blocked = involved || data.claimStatus?.claimedByOther || hasOtherClaim || data.state !== 'PENDING_REREVIEW';
  return <RndQueueDocument title={`Meal verification · ${meal.mealName}`} contentKey={`${mealId}:${data.reviewVersion}`}
    expanded={expanded} onExpandedChange={onExpandedChange} onBack={() => { if (!busy) onBack(); }} hideDecisionDock
    focusSheet={action ? { title: action === 'approve' ? 'Verification rationale' : 'Rejection rationale', request: action === 'approve' ? 1 : 2 } : undefined}
    actions={mine ? <div className="flex items-center gap-2 text-xs"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-brand-green" /><span>Claim active</span>
      <CanvasToolButton aria-label="Release claim" title="Release claim" disabled={busy} onClick={() => void act('release')}><LogOut className="h-5 w-5" /></CanvasToolButton></div>
      : <Button size="sm" variant={involved ? 'secondary' : 'primary'} disabled={busy || blocked} title={involved ? 'The previous verifier, author and flagger cannot claim this review.' : undefined}
        onClick={() => void act('claim')}>{involved ? 'Independent RND needed' : hasOtherClaim ? 'Finish current review first' : data.claimStatus?.claimedByOther ? 'Being reviewed' : 'Claim verification'}</Button>}
    tools={<div role="toolbar" aria-label="Meal review actions" className="flex items-center gap-2">
      <CanvasToolButton aria-label="Approve" title="Verify base meal" disabled={!canWrite} onClick={() => setAction('approve')}><Check className="h-5 w-5" /></CanvasToolButton>
      <CanvasToolButton aria-label="Reject" title="Keep recipe withheld" disabled={!canWrite} className="text-red-700 dark:text-red-400" onClick={() => setAction('reject')}><X className="h-5 w-5" /></CanvasToolButton>
    </div>}>
    {BaseMealEvidenceSheets({ selected: { kind: 'LIBRARY_MEAL', id: meal.id, name: meal.mealName, revisionKey: data.recipeVersion,
      description: meal.description ?? null, mealType: meal.mealType, source: 'RECORDED_RECIPE', status: 'FLAGGED',
      calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG, ingredients: meal.ingredients,
      riceRole: meal.riceRole, claimedByMe: mine, claimedByOther: Boolean(data.claimStatus?.claimedByOther) }, image: meal.image, error: error || query.error })}
    <ReviewDocumentPage page={3} title="Recorded flag concerns" subtitle="Saved reasons for withholding this recipe">
      {involved && <p className="text-sm">An independent RND must decide this review. You can inspect the recorded evidence.</p>}
      {reports.map(concern => <ConcernResolution key={concern.id} concern={concern} note="" resolved={false} canWrite={false} onNote={() => {}} onResolve={() => {}} />)}
    </ReviewDocumentPage>
    {action && mine && <ReviewDecisionPage page={4} action={action} title={action === 'approve' ? 'Verification rationale' : 'Rejection rationale'}
      note={note} onNoteChange={setNote} busy={busy} error={error} minimumLength={20} maximumLength={3000}
      confirmDisabled={action === 'approve' && !resolvedAll} onClose={() => setAction(null)}
      approvalLabel="Verify base meal" rejectionLabel="Keep recipe withheld" onConfirm={() => void act(action)}>
      {action === 'approve' ? <>
        {reports.map(concern => <ConcernResolution key={concern.id} concern={concern} note={resolutions[concern.id] ?? ''} resolved={Boolean(resolved[concern.id])} canWrite={canWrite}
          onNote={value => { setResolutions(previous => ({ ...previous, [concern.id]: value })); setResolved(previous => ({ ...previous, [concern.id]: false })); }}
          onResolve={() => setResolved(previous => ({ ...previous, [concern.id]: true }))} />)}
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} />I reviewed the nutrition evidence, measured ingredients, preparation and rice role for every serving variant.</label>
      </> : <p className="text-sm">This records your findings and releases your claim. The recipe stays withheld in this queue until its concerns are resolved. It does not create another flag incident.</p>}
    </ReviewDecisionPage>}
  </RndQueueDocument>;
}
