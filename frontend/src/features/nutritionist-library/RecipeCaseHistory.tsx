'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import AuditHistoryList, { type AuditRow } from '@/components/shared/AuditHistoryList';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import NativeSelect from '@/components/ui/NativeSelect';
import { reviewConditionLabels } from '@/lib/recorded-review-conditions';

export default function RecipeCaseHistory({ mealId, approvalsOnly = false, role = 'nutritionist' }: { mealId: string; approvalsOnly?: boolean; role?: 'admin' | 'nutritionist' }) {
  const ownerId = useAuth().user?.userId;
  const [page, setPage] = useState(1);
  const [condition, setCondition] = useState('');
  const query = useSessionQuery<{ rows: AuditRow[]; total: number; totalPages: number }>({
    ownerId, resource: `recipe-case-history:${role}:${mealId}:${page}:${approvalsOnly}:${condition}`, pollIntervalMs: false,
    errorMessage: 'Member case decisions could not be loaded.',
    fetcher: async () => {
      const response = await api.get(`/${role}/library/${encodeURIComponent(mealId)}/case-history`, { params: { page, ...(approvalsOnly ? { approvalsOnly: 'true' } : {}), ...(condition ? { condition } : {}) } });
      if (!response.data?.success || !Array.isArray(response.data.data?.rows) ||
        !Number.isInteger(response.data.data?.totalPages)) throw new Error('Member case decisions could not be loaded.');
      return response.data.data;
    },
  });
  return <section className={approvalsOnly ? "space-y-5" : "space-y-4 border-t border-brand-border pt-5"}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
      <h3 className="font-display text-lg font-bold">{approvalsOnly ? 'Approvals' : 'Member case decisions'}</h3>
      <p className="mt-1 max-w-prose text-sm text-brand-muted">{approvalsOnly ? 'Filter this meal’s approvals by the condition recorded at review. Open Details for the saved evidence.' : 'Decisions linked to this recipe’s saved evidence. Each applies only to its recorded member case and is separate from reusable approvals.'}</p>
      </div>
      <label className="w-full space-y-1 text-xs font-semibold sm:w-52">
        <span>Recorded condition</span>
        <NativeSelect value={condition} onChange={event => { setCondition(event.target.value); setPage(1); }}>
          <option value="">All conditions</option>
          {Object.entries(reviewConditionLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          <option value="NONE">None declared</option>
          <option value="UNRECORDED">Not recorded</option>
        </NativeSelect>
      </label>
    </div>
    {query.error && <FeedbackNotice variant="inline">{query.error}<Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Retry</Button></FeedbackNotice>}
    {query.isLoading && !query.data && <p role="status">Loading recorded decisions…</p>}
    {approvalsOnly && query.data && <p className="text-sm text-brand-muted">{query.data.total} recorded {query.data.total === 1 ? 'approval' : 'approvals'}</p>}
    {query.data && (query.data.rows.length ? <>
      <AuditHistoryList rows={query.data.rows} ownerId={ownerId} endpoint={`/${role}/audit-history`} showConditions />
      <Pagination page={page} pageCount={query.data.totalPages} onPageChange={setPage} />
    </> : <p className="text-sm text-brand-muted">{condition ? 'No recorded decisions match this condition.' : approvalsOnly ? 'No recorded approvals are linked to this meal yet. Older records without a meal link remain available in Audit.' : 'No member case decisions are linked to this recipe’s saved identity. Older records without that link remain available in Audit.'}</p>)}
  </section>;
}
