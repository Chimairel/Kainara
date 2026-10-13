'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuth } from '@/hooks/useAuth';
import { formatManilaDate } from '@/lib/manila-date';
import { formatMealTitle } from '@/lib/meal-title';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import NativeSelect from '@/components/ui/NativeSelect';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import MealIngredientTable from '@/components/shared/MealIngredientTable';
import type { DetailData } from './review-types';

const conditionLabels: Record<string, string> = {
  DIABETES: 'Diabetes', HYPERTENSION: 'Hypertension', KIDNEY_DISEASE: 'Kidney disease',
  HEART_CONDITION: 'Heart condition', PREGNANT: 'Pregnancy',
};
type ReviewRow = {
  id: string; mealName: string; decision: 'APPROVE' | 'REJECT'; reviewedAt: string;
  reviewerName: string | null; needsReview: boolean;
  plateFacts: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  ingredients: Array<{ name: string; quantity: number | null; unit: string | null; source: string }>;
};
type ReviewPage = { condition: string; rows: ReviewRow[]; total: number; page: number; totalPages: number };

/** Browse prior decisions while keeping the current claim and decision draft in place. */
export default function RelatedConditionReviews({ detail }: { detail: DetailData }) {
  const conditions = (detail.user.conditions ?? []).filter(condition => conditionLabels[condition]);
  const [open, setOpen] = useState(false);
  return conditions.length ? <>
    <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Related reviews</Button>
    {open && <ConditionReviewBrowser key={detail.mealPlan.id}
      mealId={detail.mealPlan.id} conditions={conditions} expectedContextKey={detail.reviewContext?.contextKey}
      onClose={() => setOpen(false)} />}
  </> : null;
}

function ConditionReviewBrowser({ mealId, conditions, expectedContextKey, onClose }: {
  mealId: string; conditions: string[]; expectedContextKey?: string; onClose: () => void;
}) {
  const ownerId = useAuth().user?.userId;
  const [condition, setCondition] = useState(conditions[0]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ReviewPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setBusy(true); setFailed(false); setResult(null); setExpandedId(null);
    api.get(`/nutritionist/queue/${encodeURIComponent(mealId)}/condition-reviews`, {
      params: { condition, page, search: query || undefined, expectedContextKey }, signal: controller.signal,
    }).then(response => {
      if (active) setResult(response.data.data);
    }).catch(error => {
      if (active && !controller.signal.aborted) {
        setFailed(true);
        toast.error(getApiErrorMessage(error, 'Could not load related reviews. Try again.'));
      }
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [ownerId, mealId, condition, page, query, expectedContextKey, retry]);
  return <Modal isOpen onClose={onClose} title="Related condition reviews" size="3xl" layer="canvas"
    description="Browse completed meal decisions for a condition in this case. A shared condition alone does not make an approval reusable.">
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <div className="space-y-2">
          <label htmlFor="related-review-condition" className="text-xs font-semibold">Condition</label>
          <NativeSelect id="related-review-condition" value={condition} onChange={event => {
            setCondition(event.target.value); setPage(1); setExpandedId(null);
          }}>
            {conditions.map(value => <option key={value} value={value}>{conditionLabels[value]}</option>)}
          </NativeSelect>
        </div>
        <Input label="Search reviewed meals" value={search} maxLength={100}
          placeholder="Search by meal name" onChange={event => setSearch(event.target.value)} />
      </div>
      <p role="status" className="text-sm text-brand-muted">
        {busy ? 'Loading completed reviews…' : failed ? 'Related reviews could not be loaded.' :
          `${result?.total ?? 0} completed ${(result?.total ?? 0) === 1 ? 'review' : 'reviews'} for ${conditionLabels[condition].toLowerCase()}`}
      </p>
      {failed ? <Button variant="secondary" onClick={() => setRetry(value => value + 1)}>Try again</Button> :
        !busy && <WorkspaceTable label="Related condition reviews" rows={result?.rows ?? []} rowKey={row => row.id}
          emptyMessage={query ? 'No completed reviews match this meal name.' : 'No completed reviews for this condition yet.'}
          columns={[
            { key: 'meal', header: 'Meal', cell: row => <span className="block min-w-36 font-bold">{formatMealTitle(row.mealName)}</span> },
            { key: 'decision', header: 'Decision', cell: row => <div className="min-w-24">
              <span className={row.decision === 'APPROVE' ? 'text-status-verified-text font-bold' : 'text-status-error-text font-bold'}>
                {row.decision === 'APPROVE' ? 'Approved' : 'Rejected'}
              </span>
              {row.decision === 'APPROVE' && row.needsReview && <span className="block mt-1 text-brand-muted">No longer cleared</span>}
            </div> },
            { key: 'reviewer', header: 'RND', cell: row => <span className="block min-w-28">{row.reviewerName ?? 'Name not recorded'}</span> },
            { key: 'date', header: 'Reviewed', cell: row => <span className="whitespace-nowrap">{formatManilaDate(row.reviewedAt, { dateStyle: 'medium' })}</span> },
            { key: 'evidence', header: 'Evidence', cell: row => <Button variant="secondary" size="sm"
              aria-expanded={expandedId === row.id} aria-label={`${expandedId === row.id ? 'Hide' : 'View'} evidence for ${formatMealTitle(row.mealName)}`}
              onClick={() => setExpandedId(value => value === row.id ? null : row.id)}>
              {expandedId === row.id ? 'Hide' : 'View'}
            </Button> },
          ]}
          expandedContent={row => expandedId === row.id ? <section aria-label={`Saved evidence for ${formatMealTitle(row.mealName)}`} className="space-y-5 p-2 sm:p-4">
            <h3 className="text-base font-bold">{formatMealTitle(row.mealName)} · Saved meal evidence</h3>
            {row.plateFacts ? <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {([['Energy', row.plateFacts.calories, 'kcal'], ['Protein', row.plateFacts.proteinG, 'g'],
                ['Carbs', row.plateFacts.carbsG, 'g'], ['Fat', row.plateFacts.fatG, 'g']] as const).map(([label, value, unit]) =>
                <div key={label}><dt className="text-xs text-brand-muted">{label}</dt><dd className="text-base font-semibold tabular-nums whitespace-nowrap">{value} {unit}</dd></div>)}
            </dl> : <p className="text-brand-muted">Nutrition amounts were not recorded in this decision.</p>}
            {row.ingredients.length ? <MealIngredientTable ingredients={row.ingredients} /> :
              <p className="text-brand-muted">No ingredients were recorded in this decision.</p>}
          </section> : null} />}
      {!busy && !failed && result && <Pagination page={page} pageCount={result.totalPages} onPageChange={setPage} label="Related review pages" />}
    </div>
  </Modal>;
}
