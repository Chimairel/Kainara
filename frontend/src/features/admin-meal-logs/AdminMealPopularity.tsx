'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import MealLogFilters from './MealLogFilters';
import { defaultFilters, logParams, type PopularityRow } from './meal-log.types';

type Popularity = {
  rows: PopularityRow[];
  total: number;
  totalPages: number;
  unmatchedItems: number;
  legacyLogs: number;
  minimumCohort: number;
};
export default function AdminMealPopularity({ active = true }: { active?: boolean }) {
  const ownerId = useAuth().user?.userId;
  const [filters, setFilters] = useState(defaultFilters),
    [page, setPage] = useState(1);
  const query = useSessionQuery<Popularity>({
    ownerId,
    enabled: active,
    resource: `admin-meal-popularity:${JSON.stringify(filters)}:${page}`,
    errorMessage: 'Meal popularity could not be loaded. Please check the filters and retry.',
    fetcher: async () => {
      const r = await api.get('/admin/meal-logs/popularity', { params: logParams(filters, page, true) });
      if (!r.data?.success || !r.data.data) throw new Error('Meal popularity unavailable.');
      return r.data.data;
    },
  });
  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5 sm:p-6" decoration="logo" decorationVariant="statistics">
        <h2 className="font-display text-xl font-bold">Meal popularity</h2>
        <p className="text-sm text-brand-muted">
          Rank recorded eating occasions and see how many different members ate each dish. Popularity is a usage
          measure; clinical review determines meal eligibility.
        </p>
        <p className="text-xs text-brand-muted">
          Each dish counts once per meal log. Marked test accounts and removed logs are excluded. Unmatched dishes are
          reported separately.
        </p>
      </Card>
      <MealLogFilters
        value={filters}
        onApply={(value) => {
          setFilters(value);
          setPage(1);
        }}
        popularity
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">
          {filters.order === 'LEAST_EATEN' ? 'Least eaten' : 'Most eaten'}
        </h3>
        <Button variant="secondary" isLoading={query.isLoading} onClick={() => void query.refetch()}>
          Refresh popularity
        </Button>
      </div>
      {query.error && (
        <p role="alert" className="text-sm text-status-error-text">
          {query.error}
        </p>
      )}
      {query.isLoading && !query.data && <p role="status">Loading meal popularity…</p>}
      {query.data && (
        <>
          <p className="text-xs text-brand-muted">
            {query.data.unmatchedItems} unmatched dish records · {query.data.legacyLogs} older logs with unrecorded
            age/membership context.
            {query.data.minimumCohort > 0 &&
              ` Age or membership results require at least ${query.data.minimumCohort} distinct eaters per dish.`}
          </p>
          <WorkspaceTable
            label="Meal popularity rankings"
            rows={query.data.rows}
            rowKey={(row) => row.key}
            emptyMessage="No dishes meet the selected filters and minimum group size."
            columns={[
              {
                key: 'meal',
                header: 'Meal',
                headerClassName: 'min-w-[200px]',
                cell: (row, index) => (
                  <h4 className="font-bold [overflow-wrap:anywhere]">
                    {(page - 1) * 20 + index + 1}. {row.name}
                  </h4>
                ),
              },
              { key: 'eaten', header: 'Times eaten', cell: (row) => row.eaten },
              { key: 'members', header: 'Members', cell: (row) => row.members },
              { key: 'repeat', header: 'Repeat eaters', cell: (row) => row.repeatEaters },
              { key: 'skipped', header: 'Times skipped', cell: (row) => row.skipped },
              {
                key: 'percentage',
                header: 'Eaten percentage',
                cell: (row) => (row.eatenPercentage === null ? 'Not recorded' : row.eatenPercentage + '%'),
              },
              {
                key: 'logs',
                header: 'Actions',
                headerClassName: 'min-w-[140px]',
                cell: (row) => (
                  <Link
                    className="inline-flex min-h-11 items-center font-bold text-brand-green"
                    href={
                      '/admin/audit?' +
                      new URLSearchParams({
                        ...Object.fromEntries(
                          Object.entries(filters).filter(
                            ([key, value]) => value && !['member', 'status', 'includeTests', 'recipeKey'].includes(key)
                          )
                        ),
                        view: 'meal-logs',
                        recipeKey: row.key,
                      })
                    }
                  >
                    View meal logs →
                  </Link>
                ),
              },
            ]}
          />
          {query.data.totalPages > 1 && (
            <Pagination page={page} pageCount={query.data.totalPages} busy={query.isLoading} onPageChange={setPage} />
          )}
        </>
      )}
      <p className="text-xs text-brand-muted">
        Eaten percentage = eaten ÷ (eaten + skipped). Meals with no recorded decisions are excluded from rankings.
      </p>
    </div>
  );
}
