'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import SubscriptionHistoryCard from '@/features/membership/SubscriptionHistoryCard';

type Members = { rows: { id: string; name: string; email: string }[]; total: number; totalPages: number; page: number };
export default function AdminSubscriptionHistory() {
  const ownerId = useAuth().user?.userId;
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
      setSelected('');
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useSessionQuery<Members>({
    ownerId,
    resource: `subscription-members:${term}:${page}`,
    fetcher: async () => {
      const response = await api.get('/admin/membership-history/members', {
        params: { page, limit: 10, search: term || undefined },
      });
      if (!response.data?.success || !response.data.data) throw new Error('Member list unavailable.');
      return response.data.data;
    },
    errorMessage: 'Members could not be loaded. Please try again.',
  });
  const member = query.data?.rows.find((row) => row.id === selected) ?? query.data?.rows[0];
  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-6" contentClassName="space-y-4">
        <p className="text-sm text-brand-muted">
          Find a member to inspect their subscription periods. This view does not include meal logs or health details.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-xs font-semibold text-brand-muted">
            Member name or email
            <input
              aria-label="Member name or email"
              type="search"
              maxLength={200}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members"
              className="min-h-11 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-sm text-brand-text focus:ring-2 focus:ring-brand-green/40"
            />
          </label>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-brand-muted">Member</p>
            <Select
              aria-label="Subscription member"
              value={member?.id ?? ''}
              onChange={setSelected}
              placeholder="Choose a member"
              options={query.data?.rows.map((row) => ({ value: row.id, label: `${row.name} · ${row.email}` })) ?? []}
              disabled={!query.data?.rows.length}
              className="w-full"
            />
          </div>
        </div>
        {query.isLoading && !query.data && (
          <p role="status" className="text-sm text-brand-muted">
            Loading members…
          </p>
        )}
        {query.error && (
          <div>
            <p role="alert" className="text-sm text-status-error-text">
              {query.error}
            </p>
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              Retry members
            </Button>
          </div>
        )}
        {query.data && !query.data.rows.length && (
          <p className="text-sm text-brand-muted">No members match this search.</p>
        )}
        {query.data && query.data.totalPages > 1 && (
          <Pagination
            page={page}
            pageCount={query.data.totalPages}
            onPageChange={(next) => {
              setPage(next);
              setSelected('');
            }}
            busy={query.isLoading}
          />
        )}
      </Card>
      {member && (
        <SubscriptionHistoryCard
          key={`${ownerId}:${member.id}`}
          ownerId={ownerId}
          endpoint={`/admin/membership-history/${encodeURIComponent(member.id)}`}
          admin
        />
      )}
    </div>
  );
}
