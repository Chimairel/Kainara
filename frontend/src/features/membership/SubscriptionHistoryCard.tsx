'use client';

import { useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import { membershipDate } from './MembershipTimeline';

export type SubscriptionEntry = {
  id: string;
  plan: string;
  period: string;
  source: string;
  status: string;
  recordedAt: string;
  startsAt: string | null;
  endsAt: string | null;
  revokedAt: string | null;
  supersededAt: string | null;
  amountCentavos: number | null;
  currency: string | null;
  note: string | null;
};
export type SubscriptionHistory = {
  member: { id: string; name: string };
  rows: SubscriptionEntry[];
  total: number;
  page: number;
  totalPages: number;
  serverTime: string;
};
const statusLabels: Record<string, string> = {
  NOT_STARTED: 'Not started',
  PAYMENT_REVIEW: 'Payment needs review',
  REVOKED: 'Revoked',
  REPLACED: 'Replaced',
  UNCONFIRMED: 'Unconfirmed',
  RECORDED: 'Historical record',
  ENDED: 'Ended',
  SCHEDULED: 'Scheduled',
  ACTIVE: 'Active',
};

/** The member and admin share this presentation; the server owns access and dates. */
export default function SubscriptionHistoryCard({
  endpoint,
  ownerId,
  admin = false,
}: {
  endpoint: string;
  ownerId: string | undefined;
  admin?: boolean;
}) {
  const [page, setPage] = useState(1);
  const query = useSessionQuery<SubscriptionHistory>({
    ownerId,
    resource: `subscription-history:${endpoint}:${page}`,
    fetcher: async () => {
      const response = await api.get(endpoint, { params: { page, limit: 10 } });
      if (!response.data?.success || !response.data.data) throw new Error('Subscription history unavailable.');
      return response.data.data;
    },
    errorMessage: 'Subscription history could not be loaded. Please try again.',
  });
  return (
    <Card
      aria-label="Subscription history"
      decoration="logo"
      decorationVariant="membership"
      className="p-5 sm:p-8"
      contentClassName="space-y-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-border pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-green/25 bg-brand-green/10 text-brand-green">
            <History className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold">Subscription history</h2>
            <p className="mt-1 text-xs leading-relaxed text-brand-muted">
              {admin && query.data ? `${query.data.member.name} · ` : ''}Free Health access and recorded membership
              periods.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          isLoading={query.isLoading}
          onClick={() => void query.refetch()}
          aria-label="Refresh subscription history"
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </header>
      {query.error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-status-error-text">
            {query.error}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Retry history
          </Button>
        </div>
      )}
      {query.isLoading && !query.data && (
        <p role="status" className="text-sm text-brand-muted">
          Loading subscription history…
        </p>
      )}
      {query.data && (
        <>
          <ol className="space-y-3" aria-label="Recorded membership periods">
            {query.data.rows.map((row, index) => (
              <li key={row.id} className="relative flex min-w-0 gap-3 sm:gap-4">
                <div className="relative flex w-7 shrink-0 justify-center">
                  {index < query.data!.rows.length - 1 && (
                    <span className="absolute bottom-[-12px] top-8 w-px bg-brand-border" aria-hidden="true" />
                  )}
                  <span className="relative mt-3 flex h-7 w-7 items-center justify-center rounded-full border border-brand-green/30 bg-brand-green/10 font-mono text-xs font-bold text-brand-green">
                    {(page - 1) * 10 + index + 1}
                  </span>
                </div>
                <article className="min-w-0 flex-1 rounded-2xl border border-brand-border/80 bg-brand-bgAlt/40 p-4 [overflow-wrap:anywhere]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-bold">{row.plan}</h3>
                      <p className="mt-1 text-xs text-brand-muted">
                        {row.period} · {row.source}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold ${row.status === 'ACTIVE' ? 'border-brand-green/30 bg-brand-green/10 text-brand-green' : 'border-brand-border bg-brand-surface text-brand-muted'}`}
                    >
                      {statusLabels[row.status] ?? row.status}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-xs text-brand-muted">Start date</dt>
                      <dd className="mt-1 text-sm font-semibold">
                        {row.startsAt ? membershipDate(row.startsAt) : 'Not started'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-brand-muted">End date</dt>
                      <dd className="mt-1 text-sm font-semibold">
                        {row.endsAt ? membershipDate(row.endsAt) : 'Not recorded'}
                      </dd>
                    </div>
                    {row.amountCentavos != null && (
                      <div>
                        <dt className="text-xs text-brand-muted">
                          Checkout amount {row.source === 'Test checkout' ? '(test)' : ''}
                        </dt>
                        <dd className="mt-1 text-sm font-semibold">
                          {(row.amountCentavos / 100).toLocaleString('en-PH', {
                            style: 'currency',
                            currency: row.currency || 'PHP',
                          })}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {row.revokedAt && (
                    <p className="mt-3 text-xs text-brand-muted">Revoked: {membershipDate(row.revokedAt)}</p>
                  )}
                  {row.supersededAt && (
                    <p className="mt-3 text-xs text-brand-muted">Replaced: {membershipDate(row.supersededAt)}</p>
                  )}
                  {row.note && <p className="mt-3 text-xs leading-relaxed text-brand-muted">{row.note}</p>}
                  <p className="mt-3 text-xs text-brand-muted">Recorded: {membershipDate(row.recordedAt)}</p>
                </article>
              </li>
            ))}
          </ol>
          {!query.data.rows.length && (
            <p className="text-sm text-brand-muted">No subscription periods have been recorded yet.</p>
          )}
          {query.data.totalPages > 1 && (
            <Pagination page={page} pageCount={query.data.totalPages} onPageChange={setPage} busy={query.isLoading} />
          )}
        </>
      )}
      <footer className="border-t border-brand-border pt-4 text-xs leading-relaxed text-brand-muted">
        Dates use Philippine time. No automatic renewal. Historical periods do not replace the current access shown in
        Plan Schedule.
      </footer>
    </Card>
  );
}
