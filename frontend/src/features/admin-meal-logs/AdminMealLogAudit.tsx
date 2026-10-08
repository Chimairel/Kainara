'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
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
      {query.data?.rows.map((row) => (
        <Card key={row.logId} className="p-4 sm:p-5">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0 space-y-1">
              <p className="font-display font-bold [overflow-wrap:anywhere]">
                {row.snapshot.mealName}{' '}
                {row.synthetic && <span className="text-xs text-brand-muted">· Test account</span>}
              </p>
              <p className="text-sm text-brand-muted">
                {row.memberName} ·{' '}
                {row.snapshot.mealDate ? membershipDate(row.snapshot.mealDate) : 'Meal date not recorded'}
              </p>
              <p className="text-xs text-brand-muted">
                {row.snapshot.source === 'USER_LOGGED' ? 'Outside meal' : 'Planned meal'} ·{' '}
                {row.snapshot.mealType ?? 'Meal type not recorded'} ·{' '}
                {row.deleted || row.snapshot.status === 'VOIDED'
                  ? 'Removed'
                  : row.snapshot.status === 'DONE'
                    ? 'Eaten'
                    : row.snapshot.status === 'SKIPPED'
                      ? 'Skipped'
                      : 'Pending'}
              </p>
              <p className="text-xs text-brand-muted">
                {membershipNames[row.membership] ?? row.membership} ·{' '}
                {row.ageGroup === 'UNKNOWN' ? 'Age not recorded' : row.ageGroup}
              </p>
            </div>
            <Button
              variant="secondary"
              className="self-start"
              aria-expanded={open === row.logId}
              onClick={() => setOpen(open === row.logId ? null : row.logId)}
            >
              {open === row.logId ? 'Close details' : 'Details'}
            </Button>
          </div>
          {open === row.logId && <MealLogDetail key={`${ownerId}:${row.logId}`} logId={row.logId} ownerId={ownerId} />}
        </Card>
      ))}
      {query.data && !query.data.rows.length && (
        <Card className="p-6">
          <p>No meal logs match these filters.</p>
        </Card>
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
