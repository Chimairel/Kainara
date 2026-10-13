'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import AuditHistoryList, { type AuditRow } from '@/components/shared/AuditHistoryList';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';

export default function RecipeCaseHistory({ mealId }: { mealId: string }) {
  const ownerId = useAuth().user?.userId;
  const [page, setPage] = useState(1);
  const query = useSessionQuery<{ rows: AuditRow[]; total: number; totalPages: number }>({
    ownerId, resource: `recipe-case-history:${mealId}:${page}`, pollIntervalMs: false,
    errorMessage: 'Member case decisions could not be loaded.',
    fetcher: async () => {
      const response = await api.get(`/nutritionist/library/${encodeURIComponent(mealId)}/case-history`, { params: { page } });
      if (!response.data?.success || !Array.isArray(response.data.data?.rows) ||
        !Number.isInteger(response.data.data?.totalPages)) throw new Error('Member case decisions could not be loaded.');
      return response.data.data;
    },
  });
  return <section className="space-y-4 border-t border-brand-border pt-5">
    <div>
      <h3 className="font-display text-lg font-bold">Member case decisions</h3>
      <p className="mt-1 text-sm text-brand-muted">Decisions linked to this recipe’s saved evidence. Each applies only to its recorded member case and is separate from reusable approvals.</p>
    </div>
    {query.error && <FeedbackNotice variant="inline">{query.error}<Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Retry</Button></FeedbackNotice>}
    {query.isLoading && !query.data && <p role="status">Loading recorded decisions…</p>}
    {query.data && (query.data.rows.length ? <>
      <AuditHistoryList rows={query.data.rows} ownerId={ownerId} endpoint="/nutritionist/audit-history" />
      <Pagination page={page} pageCount={query.data.totalPages} onPageChange={setPage} />
    </> : <p className="text-sm text-brand-muted">No member case decisions are linked to this recipe’s saved identity. Older records without that link remain available in Audit.</p>)}
  </section>;
}
