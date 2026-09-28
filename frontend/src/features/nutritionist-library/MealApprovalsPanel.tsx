'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';

type Approval = {
  id: string;
  kind: 'PROFILE' | 'CONDITION';
  scope: unknown;
  caseScope?: unknown;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewDueAt: string | null;
  status: string;
  flagReason: string | null;
};
type Variant = {
  id: string;
  status: 'APPROVED' | 'FLAGGED' | 'ARCHIVED';
  mealName: string;
  nutritionServingDescription: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: Array<{ ingredientName: string; quantity: number | null; unit: string | null }>;
  approvals: Approval[];
};

type CaseDetails = {
  meal: Variant & { description: string | null; mealType: string; recipeSignature: string | null };
  recordedScope: unknown;
  recordedCaseScope?: unknown;
  recordedAt: string | null;
  approvalMatchesCurrentRecipe: boolean;
  originatingPlan: (Pick<Variant, 'mealName' | 'calories' | 'proteinG' | 'carbsG' | 'fatG'> & {
    description: string | null; nutritionistNote: string | null;
    ingredients: Array<{ ingredientName: string; quantity: number | null; unit: string | null; dataSource?: string }>;
  }) | null;
  reviewedPlanProfile: { goal: string; dailyCalorieTarget: number; dietaryPreference: string | null; ricePreference: string } | null;
  linkedUserCurrentProfile: {
    name: string; age: number | null; sex: string | null;
    conditions: string[]; allergies: string[];
  } | null;
  reviewedClinicalDocuments: Array<{ area: string; documentType: string; status: string; validUntil: string | null; facts: Array<{ code: string; valueText: string | null; valueNumber: number | null; unit: string | null }> }>;
};

function readable(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function contextLabel(scope: unknown): string {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return 'Health context unavailable';
  const value = scope as Record<string, unknown>;
  const values = (key: string) => Array.isArray(value[key])
    ? (value[key] as unknown[]).filter((item): item is string => typeof item === 'string' && item.toUpperCase() !== 'NONE')
    : [];
  const parts = [
    ...values('conditions').map(readable),
    ...values('customConditions').map(readable),
    ...values('allergens').map((item) => `${readable(item)} allergy`),
    ...values('customFoodRestrictions').map((item) => `${readable(item)} restriction`),
  ];
  return parts.length ? parts.join(' + ') : 'No recorded health restrictions';
}

export function MealApprovalsPanel({ mealId }: {
  mealId: string;
}) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagTarget, setFlagTarget] = useState<{ variantId: string; approval: Approval } | null>(null);
  const [recheckTarget, setRecheckTarget] = useState<{ variantId: string; approval: Approval } | null>(null);
  const [reason, setReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'FLAGGED' | 'REVIEW_DUE'>('ALL');
  const [selected, setSelected] = useState<{ variantId: string; approval: Approval } | null>(null);
  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/nutritionist/library/${mealId}/approvals`);
      setVariants(response.data.data ?? []);
      setError(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not load approvals.'));
    } finally {
      setLoading(false);
    }
  }, [mealId]);

  useEffect(() => { void reload(); }, [reload]);

  async function flag() {
    if (!flagTarget || reason.trim().length < 10) return;
    setBusy(true);
    try {
      await api.post(`/nutritionist/library/${flagTarget.variantId}/approvals/flag`, {
        kind: flagTarget.approval.kind,
        approvalId: flagTarget.approval.id,
        reason: reason.trim(),
      });
      setFlagTarget(null);
      setReason('');
      await reload();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not flag this approval.'));
    } finally {
      setBusy(false);
    }
  }

  async function recheck() {
    if (!recheckTarget || reviewNote.trim().length < 10) return;
    setBusy(true);
    try {
      await api.post(`/nutritionist/library/${recheckTarget.variantId}/approvals/${recheckTarget.approval.id}/recheck`, {
        kind: recheckTarget.approval.kind,
        rationale: reviewNote.trim(),
      });
      setRecheckTarget(null);
      setReviewNote('');
      await reload();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not complete the recheck.'));
    } finally {
      setBusy(false);
    }
  }

  const filteredVariants = variants.map((variant) => ({
    ...variant,
    approvals: variant.approvals.filter((approval) => filter === 'ALL' || approval.status === filter),
  }));

  async function viewApproval(variantId: string, approval: Approval) {
    setSelected({ variantId, approval });
    setCaseDetails(null);
    setFlagTarget(null);
    setRecheckTarget(null);
    setDetailLoading(true);
    try {
      const response = await api.get(`/nutritionist/library/${variantId}/approvals/${approval.kind}/${approval.id}`);
      setCaseDetails(response.data.data);
      setError(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not load this approval case.'));
    } finally {
      setDetailLoading(false);
    }
  }

  if (selected) {
    const currentApproval = variants.flatMap((variant) => variant.approvals)
      .find((approval) => approval.id === selected.approval.id && approval.kind === selected.approval.kind) ?? selected.approval;
    const caseUser = caseDetails?.linkedUserCurrentProfile;
    const reviewedMeal = caseDetails?.originatingPlan ?? caseDetails?.meal;
    return (
      <ExpandableCasePanel expanded={expanded} onExpandedChange={setExpanded} className="rounded-2xl border border-brand-border bg-brand-surface/60 overflow-hidden" contentClassName="space-y-5 p-5">
        <Button variant="ghost" size="sm" onClick={() => { setExpanded(false); setSelected(null); setCaseDetails(null); setFlagTarget(null); setRecheckTarget(null); }}>
          ← Back to approvals
        </Button>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-green">Health-context approval</p>
          <h2 id="approval-case-heading" className="mt-1 font-display text-2xl font-bold text-brand-text">{contextLabel(caseDetails?.recordedCaseScope ?? currentApproval.caseScope ?? currentApproval.scope)}</h2>
          {currentApproval.kind === 'CONDITION' && <p className="mt-1 text-xs text-brand-muted">Approved condition scope: {contextLabel(currentApproval.scope)}. Other restrictions in this case are checked separately.</p>}
          <p className="mt-1 text-xs text-brand-muted">
            {currentApproval.reviewerName || 'Reviewer unavailable'} · Reviewed {currentApproval.reviewedAt ? new Date(currentApproval.reviewedAt).toLocaleDateString() : 'date unavailable'} · {currentApproval.status.replaceAll('_', ' ')}
          </p>
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-500/40 p-3 text-red-300">{error}</p>}
        {detailLoading && <p className="text-brand-muted">Loading approval case...</p>}
        {caseDetails && <>
          {!caseDetails.approvalMatchesCurrentRecipe && <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-300">The current recipe differs from the version recorded with this approval. Recheck before reuse.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="space-y-3 rounded-2xl border border-brand-border p-4" aria-label="User health profile">
              <h3 className="font-bold text-brand-text">Reviewed health context</h3>
              <p className="text-sm">Case at review: {contextLabel(caseDetails.recordedCaseScope ?? caseDetails.recordedScope)}</p>
              {caseDetails.reviewedPlanProfile && <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-brand-muted">Goal at planning</dt><dd>{readable(caseDetails.reviewedPlanProfile.goal)}</dd></div>
                <div><dt className="text-brand-muted">Daily target at planning</dt><dd>{caseDetails.reviewedPlanProfile.dailyCalorieTarget} kcal</dd></div>
                <div><dt className="text-brand-muted">Diet at planning</dt><dd>{caseDetails.reviewedPlanProfile.dietaryPreference ? readable(caseDetails.reviewedPlanProfile.dietaryPreference) : 'Not recorded'}</dd></div>
                <div><dt className="text-brand-muted">Rice preference at planning</dt><dd>{readable(caseDetails.reviewedPlanProfile.ricePreference)}</dd></div>
              </dl>}
              {caseUser ? <>
                <h4 className="border-t border-brand-border pt-3 text-sm font-bold">Linked user now</h4>
                <p className="font-semibold">{caseUser.name}{caseUser.age != null ? ` · ${caseUser.age} years` : ''}{caseUser.sex ? ` · ${readable(caseUser.sex)}` : ''}</p>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">This profile may have changed since approval. The recorded scope and planning targets above are the review context.</p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-brand-muted">Current conditions</dt><dd>{caseUser.conditions.length ? caseUser.conditions.map(readable).join(', ') : 'None declared'}</dd></div>
                  <div><dt className="text-brand-muted">Current allergies</dt><dd>{caseUser.allergies.length ? caseUser.allergies.map(readable).join(', ') : 'None declared'}</dd></div>
                </dl>
              </> : <p className="text-sm text-brand-muted">No linked user case is retained for this approval. Review the recorded scope above; do not infer missing patient details.</p>}
              {(caseDetails.reviewedClinicalDocuments?.length ?? 0) > 0 && <div className="border-t border-brand-border pt-3 text-sm">
                <h4 className="font-bold">Reviewed clinical documents at case approval</h4>
                {caseDetails.reviewedClinicalDocuments?.map((document, index) => <div key={`${document.area}-${index}`} className="mt-2 rounded-lg border border-brand-border p-2">
                  <p>{readable(document.area)} · {readable(document.documentType)} · {readable(document.status)}</p>
                  {document.facts.map((fact, factIndex) => <p key={`${fact.code}-${factIndex}`} className="text-xs text-brand-muted">{readable(fact.code)}: {fact.valueText ?? fact.valueNumber} {fact.unit ?? ''}</p>)}
                </div>)}
              </div>}
            </section>
            <section className="space-y-3 rounded-2xl border border-brand-border p-4" aria-label="Meal details">
              <h3 className="font-bold text-brand-text">Meal details</h3>
              <p className="font-semibold">{reviewedMeal?.mealName}</p>
              <p className="text-sm text-brand-muted">{reviewedMeal?.description || 'No description recorded.'}</p>
              <p className="text-sm">{reviewedMeal?.calories} kcal · {reviewedMeal?.proteinG}g protein · {reviewedMeal?.carbsG}g carbs · {reviewedMeal?.fatG}g fat</p>
              <h4 className="text-sm font-bold">Ingredients in the reviewed serving</h4>
              <ul className="space-y-1 text-sm text-brand-muted">
                {reviewedMeal?.ingredients.map((ingredient, index) => <li key={index}>{ingredient.ingredientName}{ingredient.quantity != null ? ` · ${ingredient.quantity} ${ingredient.unit || ''}` : ''}{'dataSource' in ingredient && ingredient.dataSource ? ` · ${readable(ingredient.dataSource)}` : ''}</li>)}
              </ul>
              {caseDetails.originatingPlan?.nutritionistNote && <p className="border-t border-brand-border pt-3 text-sm"><strong>Nutritionist note:</strong> {caseDetails.originatingPlan.nutritionistNote}</p>}
              {caseDetails.originatingPlan && <p className="text-xs text-brand-muted">Shown from the linked reviewed meal plan.</p>}
            </section>
          </div>
          {currentApproval.flagReason && <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Flag reason: {currentApproval.flagReason}</p>}
          {variants.find((variant) => variant.id === selected.variantId)?.status === 'FLAGGED' &&
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">This approval is suspended by a meal-wide flag. Resolve the base meal before reviewing this approval.</p>}
          <div className="flex flex-wrap gap-2">
            {(currentApproval.status === 'ACTIVE' || currentApproval.status === 'REVIEW_DUE') && <Button variant="secondary" disabled={busy || variants.find((variant) => variant.id === selected.variantId)?.status === 'FLAGGED'} onClick={() => { setFlagTarget({ variantId: selected.variantId, approval: currentApproval }); setReason(''); }}>Flag approval</Button>}
            {(currentApproval.status === 'FLAGGED' || currentApproval.status === 'REVIEW_DUE') && <Button variant="secondary" disabled={busy || variants.find((variant) => variant.id === selected.variantId)?.status === 'FLAGGED'} onClick={() => { setRecheckTarget({ variantId: selected.variantId, approval: currentApproval }); setReviewNote(''); }}>Recheck approval</Button>}
          </div>
          {flagTarget && <div className="rounded-xl border border-amber-600/50 p-4">
            <label htmlFor="approval-flag-reason" className="block text-sm font-semibold">Reason for flagging this approval</label>
            <textarea id="approval-flag-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={1000} rows={3} placeholder="Provide reasons for flagging this approval..." className="mt-2 w-full rounded-xl border border-brand-border/80 bg-brand-surface p-3 text-sm text-brand-text shadow-sm outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 placeholder:text-brand-muted/70" />
            <div className="mt-2 flex gap-2"><Button disabled={busy || reason.trim().length < 10} onClick={() => void flag()}>Submit flag</Button><Button variant="secondary" onClick={() => setFlagTarget(null)}>Cancel</Button></div>
          </div>}
          {recheckTarget && <div className="rounded-xl border border-brand-green/50 p-4">
            <label htmlFor="approval-recheck-note" className="block text-sm font-semibold">Review findings for this approval</label>
            <textarea id="approval-recheck-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} minLength={10} maxLength={1000} rows={3} placeholder="Document findings for this recheck..." className="mt-2 w-full rounded-xl border border-brand-border/80 bg-brand-surface p-3 text-sm text-brand-text shadow-sm outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 placeholder:text-brand-muted/70" />
            <div className="mt-2 flex gap-2"><Button disabled={busy || reviewNote.trim().length < 10} onClick={() => void recheck()}>Submit recheck</Button><Button variant="secondary" onClick={() => setRecheckTarget(null)}>Cancel</Button></div>
          </div>}
        </>}
      </ExpandableCasePanel>
    );
  }

  return (
    <section aria-labelledby="meal-approvals-heading" className="space-y-4 rounded-2xl border border-brand-border bg-brand-surface/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="meal-approvals-heading" className="font-display text-xl font-bold text-brand-text">Approvals</h2>
          <p className="text-xs text-brand-muted">Each approval applies to its recorded ingredients, serving, and health context.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-brand-muted">
          Show
          <select aria-label="Filter approvals" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}
            className="rounded-xl border border-brand-border bg-brand-surface px-3 py-1.5 text-xs text-brand-text shadow-xs outline-none focus:border-brand-green">
            <option value="ALL">All approvals</option>
            <option value="ACTIVE">Current</option>
            <option value="FLAGGED">Flagged</option>
            <option value="REVIEW_DUE">Scheduled recheck due</option>
          </select>
        </label>
      </div>
      <div className="space-y-4">
        {error && <p role="alert" className="rounded-xl border border-red-500/40 p-3 text-red-300">{error}</p>}
        {loading ? <p className="text-brand-muted">Loading approvals...</p> : filteredVariants.every((variant) => variant.approvals.length === 0) ? (
          <p className="rounded-xl border border-brand-border p-4 text-brand-muted">{filter === 'ALL' ? 'No reusable approvals are recorded for this recipe yet.' : 'No approvals match this filter.'}</p>
        ) : filteredVariants.map((variant) => variant.approvals.length > 0 && (
          <section key={variant.id} className="space-y-3 rounded-2xl border border-brand-border p-4">
            <div>
              {variant.status === 'FLAGGED' && <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">Suspended by meal-wide flag</p>}
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Serving variant · {variant.mealName}</p>
              <p className="text-xs text-brand-muted">
                {variant.nutritionServingDescription || 'Recorded serving'} · {variant.calories} kcal ·
                {' '}{variant.proteinG}g protein · {variant.carbsG}g carbs · {variant.fatG}g fat
              </p>
              <details className="mt-2 text-xs text-brand-muted">
                <summary className="cursor-pointer">Ingredients in this approved variant</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {variant.ingredients.map((ingredient, index) => (
                    <li key={index}>{ingredient.ingredientName}
                      {ingredient.quantity != null ? ` · ${ingredient.quantity} ${ingredient.unit || ''}` : ''}</li>
                  ))}
                </ul>
              </details>
            </div>
            {variant.approvals.map((approval) => (
              <div key={`${approval.kind}-${approval.id}`} className="rounded-xl border border-brand-border bg-brand-surface p-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-brand-text">{contextLabel(approval.caseScope ?? approval.scope)}</h3>
                  <span className={variant.status === 'APPROVED' && approval.status === 'ACTIVE' ? 'text-brand-green font-bold' : 'text-amber-700 dark:text-amber-300 font-bold'}>
                    {variant.status === 'FLAGGED' ? 'Suspended by meal flag' : approval.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-brand-muted">
                  {approval.reviewerName || 'Reviewed policy'} · Reviewed {approval.reviewedAt ? new Date(approval.reviewedAt).toLocaleDateString() : 'pending'}
                  {approval.reviewDueAt ? ` · Recheck ${new Date(approval.reviewDueAt).toLocaleDateString()}` : ''}
                </p>
                {approval.kind === 'CONDITION' && approval.caseScope != null && contextLabel(approval.caseScope) !== contextLabel(approval.scope) &&
                  <p className="mt-1 text-xs text-brand-muted">Approved condition: {contextLabel(approval.scope)} · other case restrictions checked separately</p>}
                {approval.flagReason && <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300">Flag reason: {approval.flagReason}</p>}
                {approval.status === 'STALE' && <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300">The recipe evidence or reviewer eligibility changed. A fresh approval is required.</p>}
                <div className="mt-3"><Button variant="secondary" size="sm" onClick={() => void viewApproval(variant.id, approval)}>View</Button></div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}
