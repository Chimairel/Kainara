'use client';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import { reviewStateLabel } from './MealReviewTimeline';
export default function MealReviewQueue({
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
    resource: `recipe-review-queue:${base}`,
    fetcher: async () => (await api.get(`${base}/meal-review-cases`)).data.data,
    errorMessage: 'Re-review queue could not be loaded.',
  });
  if (!active) return null;
  return (
    <section
      className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface p-4"
      aria-label="Shared recipe re-review pool"
    >
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Shared recipe re-review pool</h2>
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          Refresh cases
        </Button>
      </div>
      {query.error && (
        <p role="alert" className="text-sm text-status-error-text">
          {query.error}
        </p>
      )}
      {query.isLoading && !query.data && <p role="status">Loading cases…</p>}
      {query.data?.length === 0 && <p className="text-sm text-brand-muted">No held recipes await re-review.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {query.data?.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-border p-3"
          >
            <div>
              <p className="font-semibold">{row.mealName}</p>
              <p className="text-xs text-brand-muted">
                {reviewStateLabel(row.state)} · Incident {row.incidentCount}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void openMeal(row)}>
              Review case
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
