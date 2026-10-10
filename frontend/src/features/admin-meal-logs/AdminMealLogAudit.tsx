'use client';
import { useEffect, useId, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import WorkspaceTable, { type WorkspaceTableColumn } from '@/components/shared/WorkspaceTable';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import MealLogFilters from './MealLogFilters';
import MealLogDetail from './MealLogDetail';
import { defaultFilters, logParams, membershipNames, type LogRow, type FilterValues } from './meal-log.types';
import { membershipDate } from '@/features/membership/MembershipTimeline';

type History = { rows: LogRow[]; total: number; totalPages: number };
export default function AdminMealLogAudit() {
  const ownerId = useAuth().user?.userId;
  const [filters, setFilters] = useState(defaultFilters),
    [page, setPage] = useState(1),
    [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'meal-logs')
      setFilters((v) => ({
        ...v,
        ...Object.fromEntries(
          Object.keys(v)
            .filter((k) => params.has(k))
            .map((k) => [k, params.get(k)!])
        ),
      }));
  }, []);
  const query = useSessionQuery<History>({
    ownerId,
    resource: `admin-meal-logs:${JSON.stringify(filters)}:${page}`,
    errorMessage: 'Meal logs could not be loaded. Please check the filters and retry.',
    fetcher: async () => {
      const r = await api.get('/admin/meal-logs', { params: logParams(filters, page) });
      if (!r.data?.success || !r.data.data) throw new Error('Meal logs unavailable.');
      return r.data.data;
    },
  });
  const panelPrefix = useId();
  const panelId = (row: LogRow) => panelPrefix + '-' + row.logId;
  const columns: WorkspaceTableColumn<LogRow>[] = [
    {
      key: 'date',
      header: 'Meal date',
      headerClassName: 'min-w-[160px]',
      cell: (row) => (
        <span className="text-brand-muted">
          {row.snapshot.mealDate ? membershipDate(row.snapshot.mealDate) : 'Meal date not recorded'}
        </span>
      ),
    },
    {
      key: 'meal',
      header: 'Meal',
      headerClassName: 'min-w-[200px]',
      cell: (row) => (
        <>
          <p className="font-bold [overflow-wrap:anywhere]">
            {row.snapshot.mealName ?? 'Meal name not recorded'}
            {row.synthetic && <span className="text-[11px] text-brand-muted"> · Test account</span>}
          </p>
          <p className="mt-1 text-[11px] text-brand-muted">
            {row.snapshot.source === 'USER_LOGGED' ? 'Outside meal' : 'Planned meal'} ·{' '}
            {row.snapshot.mealType ?? 'Meal type not recorded'}
          </p>
        </>
      ),
    },
    {
      key: 'member',
      header: 'Member',
      headerClassName: 'min-w-[160px]',
      cell: (row) => <span className="font-semibold">{row.memberName}</span>,
    },
    {
      key: 'plan',
      header: 'Plan / age',
      headerClassName: 'min-w-[130px]',
      cell: (row) => (
        <>
          <p>{membershipNames[row.membership] ?? row.membership}</p>
          <p className="mt-1 text-[11px] text-brand-muted">
            {row.ageGroup === 'UNKNOWN' ? 'Age not recorded' : row.ageGroup}
          </p>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      headerClassName: 'min-w-[90px]',
      cell: (row) => (
        <span className="inline-flex rounded-full bg-brand-bgAlt px-2.5 py-1 text-[10px] font-bold">
          {row.deleted || row.snapshot.status === 'VOIDED'
            ? 'Removed'
            : row.snapshot.status === 'DONE'
              ? 'Eaten'
              : row.snapshot.status === 'SKIPPED'
                ? 'Skipped'
                : 'Pending'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'min-w-[120px]',
      cell: (row) => (
        <Button
          variant="secondary"
          size="sm"
          className="!min-h-11"
          aria-expanded={open === row.logId}
          aria-controls={panelId(row)}
          onClick={() => setOpen(open === row.logId ? null : row.logId)}
        >
          {open === row.logId ? 'Close details' : 'Details'}
        </Button>
      ),
    },
  ];
  return (
    <div className="space-y-5">
      <MealLogFilters
        key={JSON.stringify(filters)}
        value={filters}
        onApply={(v: FilterValues) => {
          setFilters(v);
          setPage(1);
          setOpen(null);
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Meal logs {query.data ? `· ${query.data.total}` : ''}</h2>
        <Button variant="secondary" isLoading={query.isLoading} onClick={() => void query.refetch()}>
          Refresh meal logs
        </Button>
      </div>
      {query.error && (
        <p role="alert" className="text-sm text-status-error-text">
          {query.error}
        </p>
      )}
      {query.isLoading && !query.data && <p role="status">Loading meal logs…</p>}
      {query.data && (
        <WorkspaceTable
          label="Meal logs"
          rows={query.data.rows}
          columns={columns}
          rowKey={(row) => row.logId}
          emptyMessage="No meal logs match these filters."
          expandedContent={(row) =>
            open === row.logId ? (
              <div
                id={panelId(row)}
                role="region"
                aria-label={'Meal log details: ' + (row.snapshot.mealName ?? 'Recorded meal')}
              >
                <MealLogDetail key={ownerId + ':' + row.logId} logId={row.logId} ownerId={ownerId} />
              </div>
            ) : null
          }
          footer={
            <span>
              Showing <strong className="text-brand-text">{query.data.rows.length}</strong> of {query.data.total} logs
            </span>
          }
        />
      )}
      {query.data && query.data.totalPages > 1 && (
        <Pagination
          page={page}
          pageCount={query.data.totalPages}
          busy={query.isLoading}
          onPageChange={(next) => {
            setPage(next);
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}
