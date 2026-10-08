'use client';
import { useState } from 'react';
import api from '@/lib/axios';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import RecordPaper from '@/components/shared/RecordPaper';
import { Select } from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import RecordedCaseFields from '@/features/admin-audit/RecordedCaseFields';
import { membershipDate } from '@/features/membership/MembershipTimeline';
import { displaySnapshot, membershipNames, type LogDetail } from './meal-log.types';

export default function MealLogDetail({ logId, ownerId }: { logId: string; ownerId: string | undefined }) {
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState('current');
  const query = useSessionQuery<LogDetail>({
    ownerId,
    resource: `admin-meal-log-detail:${logId}:${page}`,
    errorMessage: 'Meal log details could not be loaded.',
    fetcher: async () => {
      const r = await api.get(`/admin/meal-logs/${encodeURIComponent(logId)}`, { params: { page } });
      if (!r.data?.success || !r.data.data) throw new Error('Meal log unavailable.');
      return r.data.data;
    },
  });
  if (!query.data)
    return (
      <div className="space-y-3 p-4">
        <p role={query.error ? 'alert' : 'status'}>{query.error ?? 'Loading recorded changes…'}</p>
        {query.error && (
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Retry details
          </Button>
        )}
      </div>
    );
  const { record, events, items } = query.data;
  const event = events.find((e) => e.id === selected);
  const actions: Record<string, string> = { INSERT: 'Created', UPDATE: 'Updated', DELETE: 'Removed' };
  return (
    <RecordPaper className="my-4">
      {query.error && <p role="alert">{query.error}</p>}
      <h3 className="font-display text-xl font-bold">Recorded meal log</h3>
      <p className="text-sm text-brand-muted">
        {record.memberName} · {record.ageGroup === 'UNKNOWN' ? 'Age not recorded' : `Age ${record.ageGroup}`} ·{' '}
        {membershipNames[record.membership] ?? record.membership}
      </p>
      <p className="text-xs text-brand-muted">
        First recorded: {record.firstRecordedAt ? membershipDate(record.firstRecordedAt) : 'Not recorded'} · Last
        action: {record.lastActionAt ? membershipDate(record.lastActionAt) : 'Not recorded'}
      </p>
      {record.contextVersion === 'LEGACY_UNAVAILABLE' && (
        <p className="rounded-xl border border-brand-border p-3 text-sm">
          This log predates change recording. Earlier changes, original age and membership context are not recorded.
        </p>
      )}
      <Select
        aria-label="Meal log change"
        value={event?.id ?? 'current'}
        options={[
          { value: 'current', label: 'Current recorded log' },
          ...events.map((e) => ({
            value: e.id,
            label: `${actions[e.action] ?? e.action} ${e.entityType === 'ITEM' ? 'dish' : 'log'} · ${membershipDate(e.occurredAt)} · ${e.actorName}`,
          })),
        ]}
        onChange={setSelected}
        className="w-full"
      />
      {event ? (
        <>
          <p className="text-sm">
            {event.actorName} · {event.actorRole === 'NUTRITIONIST' ? 'RND' : event.actorRole} ·{' '}
            {membershipDate(event.occurredAt)}
          </p>
          <p className="text-sm">{event.reason ?? 'No rationale recorded.'}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="min-w-0 space-y-3">
              <h4 className="font-bold">Before</h4>
              <RecordedCaseFields value={displaySnapshot(event.before)} />
            </section>
            <section className="min-w-0 space-y-3">
              <h4 className="font-bold">After</h4>
              <RecordedCaseFields value={displaySnapshot(event.after)} />
            </section>
          </div>
        </>
      ) : (
        <>
          <RecordedCaseFields value={displaySnapshot(record.snapshot)} />
          {items.length > 0 && (
            <section className="space-y-3">
              <h4 className="font-bold">Current recorded dishes</h4>
              {items.map((item, index) => (
                <RecordedCaseFields key={String(item.id ?? index)} value={displaySnapshot(item)} />
              ))}
            </section>
          )}
        </>
      )}
      {events.length === 0 && <p className="text-sm text-brand-muted">No saved change events.</p>}
      {query.data.totalPages > 1 && (
        <Pagination
          page={page}
          pageCount={query.data.totalPages}
          busy={query.isLoading}
          onPageChange={(next) => {
            setPage(next);
            setSelected('current');
          }}
        />
      )}
      <p className="border-t border-brand-border pt-3 text-xs text-brand-muted">
        Estimated and reported nutrition retain their recorded source. Opening these details is recorded in Admin
        activity.
      </p>
    </RecordPaper>
  );
}
