'use client';
import { formatMealTitle } from '@/lib/meal-title';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import { reviewStateLabel } from './MealReviewTimeline';
export default function QuarantinedMeals({
  isAdmin,
  active,
  openMeal,
}: {
  isAdmin: boolean;
  active: boolean;
  openMeal: (meal: { id: string }) => Promise<void>;
}) {
  const ownerId = useAuth().user?.userId;
  const base = isAdmin ? '/admin' : '/nutritionist';
  const query = useSessionQuery<{ id: string; mealName: string; state: string; incidentCount: number }[]>({
    ownerId,
    enabled: active,
    resource: `quarantined-meals:${base}`,
    fetcher: async () => {
      const response = await api.get(`${base}/meal-review-cases`, { params: { state: 'QUARANTINED' } });
      if (!response.data?.success || !Array.isArray(response.data.data)) throw new Error('Quarantined meals could not be loaded.');
      return response.data.data.filter((row: { state: string }) => row.state === 'QUARANTINED');
    },
    errorMessage: 'Quarantined meals could not be loaded.',
  });
  if (!active) return null;
  return (
    <section
      className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface p-4"
      aria-label="Quarantined meals"
    >
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Quarantined meals</h2>
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          Refresh cases
        </Button>
      </div>
      {query.error && <FeedbackNotice variant="inline">{query.error}<Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Retry</Button></FeedbackNotice>}
      {query.isLoading && !query.data && <p role="status">Loading cases…</p>}
      {query.data && (
        <WorkspaceTable
          label="Quarantined meals"
          rows={query.data}
          rowKey={(row) => row.id}
          emptyMessage="No meals are quarantined."
          columns={[
            { key: 'meal', header: 'Meal', cell: (row) => <strong>{formatMealTitle(row.mealName)}</strong> },
            { key: 'state', header: 'Review state', cell: (row) => reviewStateLabel(row.state) },
            { key: 'incident', header: 'Incident', cell: (row) => row.incidentCount },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row) => (
                <Button variant="secondary" size="sm" onClick={() => void openMeal(row)}>
                  View meal
                </Button>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}
