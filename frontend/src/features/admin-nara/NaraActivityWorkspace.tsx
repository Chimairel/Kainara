'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatManilaDate } from '@/lib/manila-date';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

type Record = {
  id: string;
  message: string;
  mode: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
};
export default function NaraActivityWorkspace() {
  const [items, setItems] = useState<Record[]>([]);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef(0);
  async function load(query: string, cursor?: string) {
    const request = ++activeRequest.current;
    setBusy(true);
    setError(null);
    try {
      const response = await api.get('/admin/nara-answers/activity', {
        params: { ...(query ? { search: query } : {}), ...(cursor ? { cursor } : {}) },
      });
      if (request !== activeRequest.current) return;
      setItems(response.data.data.items);
      setNextCursor(response.data.data.nextCursor);
      setAppliedSearch(query);
    } catch (cause) {
      if (request === activeRequest.current)
        setError(getApiErrorMessage(cause, 'Could not load submitted messages. Try again.'));
    } finally {
      if (request === activeRequest.current) setBusy(false);
    }
  }
  useEffect(() => {
    const requests = activeRequest;
    void load('');
    return () => {
      requests.current++;
    };
  }, []);
  return (
    <section className="portal-page space-y-5" aria-labelledby="nara-activity-title">
      <header>
        <h1 id="nara-activity-title" className="font-display text-2xl font-bold">
          Submitted Nara messages
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-muted">
          Review what members send to improve Nara’s instant answers. Records cover the last 30 days, starting when this
          feature is enabled. Unsent drafts and typing are never recorded.
        </p>
      </header>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void load(search.trim());
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
            label="Search submitted messages"
            value={search}
            maxLength={120}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy}>
          Search
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void load(appliedSearch)}>
          Reload messages
        </Button>
      </form>
      {error && <FeedbackNotice>{error}</FeedbackNotice>}
      {busy && (
        <p role="status" className="text-sm text-brand-muted">
          Loading submitted messages…
        </p>
      )}
      <WorkspaceTable
        label="Submitted Nara messages"
        rows={items}
        rowKey={(item) => item.id}
        emptyMessage={
          busy
            ? 'Loading records…'
            : appliedSearch
              ? 'No submitted messages match your search.'
              : 'No submitted messages recorded yet.'
        }
        columns={[
          {
            key: 'member',
            header: 'Member',
            cell: (item) => (
              <div>
                <p className="font-semibold">{item.user.name}</p>
                <p className="break-all text-xs text-brand-muted">{item.user.email}</p>
              </div>
            ),
          },
          {
            key: 'message',
            header: 'Submitted message',
            cell: (item) => <p className="max-w-xl whitespace-pre-wrap break-words text-sm">{item.message}</p>,
          },
          {
            key: 'mode',
            header: 'Mode',
            cell: (item) => (item.mode === 'AI_REQUEST' ? '/ai request' : 'Standard message'),
          },
          {
            key: 'date',
            header: 'Submitted',
            cell: (item) => formatManilaDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' }),
          },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-muted">
          Administrator access is recorded. Messages may contain personal information.
        </p>
        <Button
          variant="secondary"
          disabled={busy || !nextCursor}
          onClick={() => void load(appliedSearch, nextCursor ?? undefined)}
        >
          Older messages
        </Button>
      </div>
    </section>
  );
}
