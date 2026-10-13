'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import { formatMealTitle } from '@/lib/meal-title';

type PendingIncident = { id: string; mealName: string; state: string; incidentCount: number };

/** First-incident flags belong to Reviews; quarantine remains an administrative lifecycle. */
export default function PendingMealRereviews() {
  const ownerId = useAuth().user?.userId;
  const query = useSessionQuery<PendingIncident[]>({
    ownerId, resource: 'pending-meal-rereviews', pollIntervalMs: false,
    errorMessage: 'Meals needing re-review could not be loaded.',
    fetcher: async () => {
      const response = await api.get('/nutritionist/meal-review-cases', { params: { state: 'PENDING_REREVIEW' } });
      if (!response.data?.success || !Array.isArray(response.data.data)) throw new Error('Meals needing re-review could not be loaded.');
      return response.data.data.filter((row: PendingIncident) => row.state === 'PENDING_REREVIEW');
    },
  });
  return <section aria-label="Meals needing re-review" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold">Meals needing re-review</h2>
      <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Refresh</Button>
    </div>
    {query.error && <FeedbackNotice variant="inline">{query.error}<Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Retry</Button></FeedbackNotice>}
    {query.isLoading && !query.data && <p role="status">Loading meals needing re-review…</p>}
    {query.data && <WorkspaceTable label="Meals needing re-review" rows={query.data} rowKey={row => row.id}
      emptyMessage="No meals need re-review." columns={[
        { key: 'meal', header: 'Meal', cell: row => <strong>{formatMealTitle(row.mealName)}</strong> },
        { key: 'incident', header: 'Incident', cell: row => row.incidentCount },
        { key: 'action', header: 'Actions', cell: row => <Link href={`/nutritionist/library?mealId=${encodeURIComponent(row.id)}`} className="inline-flex min-h-11 items-center font-semibold text-brand-green underline underline-offset-4">Review meal</Link> },
      ]} />}
  </section>;
}
