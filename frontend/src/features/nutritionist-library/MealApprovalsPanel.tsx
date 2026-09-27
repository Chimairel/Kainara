'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';

type Approval = {
  id: string;
  kind: 'PROFILE' | 'CONDITION';
  scope: unknown;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewDueAt: string | null;
  status: string;
  flagReason: string | null;
};
type Variant = {
  id: string;
  mealName: string;
  nutritionServingDescription: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: Array<{ ingredientName: string; quantity: number | null; unit: string | null }>;
  approvals: Approval[];
};

function contextLabel(scope: unknown): string {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return 'Recorded health context';
  const value = scope as Record<string, unknown>;
  const conditions = Array.isArray(value.conditions) ? value.conditions.filter((item): item is string => typeof item === 'string') : [];
  const allergens = Array.isArray(value.allergens) ? value.allergens.filter((item): item is string => typeof item === 'string') : [];
  const parts = [
    conditions.length ? conditions.join(', ') : 'No conditions',
    allergens.length ? `Avoid: ${allergens.join(', ')}` : 'No allergies',
  ];
  if (value.userScoped === true) parts.push('Individual clinical scope');
  return parts.join(' · ');
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
            className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-brand-text">
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
              <h3 className="font-bold">{variant.mealName}</h3>
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
              <div key={`${approval.kind}-${approval.id}`} className="rounded-xl border border-brand-border bg-brand-bg/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm">{contextLabel(approval.scope)}</strong>
                  <span className={approval.status === 'ACTIVE' ? 'text-brand-green' : 'text-amber-300'}>
                    {approval.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-brand-muted">
                  {approval.reviewerName || 'Reviewed policy'} · Reviewed {approval.reviewedAt ? new Date(approval.reviewedAt).toLocaleDateString() : 'pending'}
                  {approval.reviewDueAt ? ` · Recheck ${new Date(approval.reviewDueAt).toLocaleDateString()}` : ''}
                </p>
                {approval.flagReason && <p className="mt-2 text-xs text-amber-300">Flag reason: {approval.flagReason}</p>}
                {approval.status === 'STALE' && <p className="mt-2 text-xs text-amber-300">The recipe evidence or reviewer eligibility changed. A fresh approval is required.</p>}
                <div className="mt-3 flex gap-2">
                  {approval.status === 'ACTIVE' || approval.status === 'REVIEW_DUE' ? (
                    <Button variant="secondary" disabled={busy} onClick={() => { setFlagTarget({ variantId: variant.id, approval }); setReason(''); }}>
                      Flag approval
                    </Button>
                  ) : null}
                  {approval.status === 'FLAGGED' || approval.status === 'REVIEW_DUE' ? (
                    <Button variant="secondary" disabled={busy} onClick={() => { setRecheckTarget({ variantId: variant.id, approval }); setReviewNote(''); }}>
                      Recheck approval
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        ))}
        {flagTarget && <div className="rounded-xl border border-amber-600/50 p-4">
          <label htmlFor="approval-flag-reason" className="block text-sm font-semibold">Reason for flagging this approval</label>
          <textarea id="approval-flag-reason" value={reason} onChange={(event) => setReason(event.target.value)}
            minLength={10} maxLength={1000} rows={3}
            className="mt-2 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-brand-text" />
          <div className="mt-2 flex gap-2">
            <Button disabled={busy || reason.trim().length < 10} onClick={() => void flag()}>Submit flag</Button>
            <Button variant="secondary" onClick={() => setFlagTarget(null)}>Cancel</Button>
          </div>
        </div>}
        {recheckTarget && <div className="rounded-xl border border-brand-green/50 p-4">
          <label htmlFor="approval-recheck-note" className="block text-sm font-semibold">Review findings for this approval</label>
          <p className="mt-1 text-xs text-brand-muted">Inspect this variant’s ingredients, serving, health context and original flag before renewing approval.</p>
          <textarea id="approval-recheck-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)}
            minLength={10} maxLength={1000} rows={3}
            className="mt-2 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-brand-text" />
          <div className="mt-2 flex gap-2">
            <Button disabled={busy || reviewNote.trim().length < 10} onClick={() => void recheck()}>Submit recheck</Button>
            <Button variant="secondary" onClick={() => setRecheckTarget(null)}>Cancel</Button>
          </div>
        </div>}
      </div>
    </section>
  );
}
