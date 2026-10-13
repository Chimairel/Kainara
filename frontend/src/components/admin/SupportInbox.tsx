'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import { RefreshCw, ArrowLeft, Mail } from '@/components/ui/icons';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatManilaDate } from '@/lib/manila-date';
import api from '@/lib/axios';

type Delivery = 'PROCESSING' | 'ACCEPTED' | 'UNCONFIRMED';
type Reply = { id: string; message: string; deliveryStatus: Delivery; createdAt: string; author?: { name: string } | null };
type Request = { id: string; category: string; replyEmail: string; deliveryStatus: Delivery; createdAt: string; user: { name: string; email: string }; replies: Reply[]; message?: string };
type Inbox = { items: Request[]; page: number; pageSize: number; total: number };
const topics: Record<string, string> = { ACCOUNT: 'Account help', MEALS: 'Meals and planning', GROCERIES: 'Groceries', NOTIFICATIONS: 'Notifications', OTHER: 'Other question or feedback' };
const date = (value: string) => formatManilaDate(value, { dateStyle: 'medium', timeStyle: 'short' });
const delivery = (status: Delivery) => status === 'ACCEPTED' ? 'Accepted by email provider' : status === 'PROCESSING' ? 'Delivery confirmation pending' : 'Email delivery unconfirmed';

export default function SupportInbox() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [record, setRecord] = useState<Request | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVersion, setDetailVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [notice, setNotice] = useState('');
  const sending = useRef(false);
  const replyController = useRef<AbortController | null>(null);
  const attempts = useRef<Record<string, { key: string; message: string }>>({});
  const currentSelection = useRef(selected); currentSelection.current = selected;
  const loadList = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setListError('');
    try {
      const response = await api.get('/admin/support', { params: { page }, signal });
      if (!signal?.aborted) setInbox(response.data.data);
    } catch (error) {
      if (!signal?.aborted) setListError(getApiErrorMessage(error, 'Could not load support requests. Refresh to try again.'));
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [page]);
  useEffect(() => { const controller = new AbortController(); void loadList(controller.signal); return () => controller.abort(); }, [loadList]);
  useEffect(() => () => replyController.current?.abort(), []);
  useEffect(() => {
    setRecord(null); setDetailError(''); setNotice('');
    if (!selected) { setDetailLoading(false); return; }
    const controller = new AbortController(); setDetailLoading(true);
    void api.get(`/admin/support/${selected}`, { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setRecord(response.data.data);
    }).catch(error => {
      if (!controller.signal.aborted) setDetailError(getApiErrorMessage(error, 'Could not open this request. Select it again to retry.'));
    }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selected, detailVersion]);
  const choose = (id: string | null) => {
    if (sending.current) return;
    if (id === selected) setDetailVersion(version => version + 1);
    else setSelected(id);
  };
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || sending.current) return;
    const id = record.id; const message = (drafts[id] ?? '').trim();
    if (!message) { setDetailError('Write a reply before sending.'); return; }
    sending.current = true; setPending(true); setDetailError(''); setNotice('');
    const controller = new AbortController(); replyController.current = controller;
    if (attempts.current[id]?.message !== message) attempts.current[id] = { key: crypto.randomUUID(), message };
    try {
      const response = await api.post(`/admin/support/${id}/replies`, { message, requestKey: attempts.current[id].key }, { signal: controller.signal });
      const saved = response.data.data as Reply;
      if (!response.data.success || !saved?.id || !saved.deliveryStatus) throw new Error('Unconfirmed reply');
      if (controller.signal.aborted || currentSelection.current !== id) return;
      setRecord(current => current && ({ ...current, replies: current.replies.some(reply => reply.id === saved.id) ? current.replies : [...current.replies, saved] }));
      setDrafts(current => ({ ...current, [id]: '' })); delete attempts.current[id];
      setNotice(saved.deliveryStatus === 'ACCEPTED' ? 'Reply saved and accepted by the email provider.' : 'Reply saved, but email delivery is unconfirmed. It has not been retried.');
      void loadList(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) setDetailError(getApiErrorMessage(error, 'Could not confirm the reply. Your draft is kept. Trying the same draft again will not send a duplicate.'));
    } finally { sending.current = false; if (!controller.signal.aborted) setPending(false); }
  }

  return <div className="portal-page space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-brand-border pb-6">
      <div><h1 className="font-display text-3xl font-bold">Support inbox</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">Member questions, feedback, and account help. Replies use Kainara’s configured email sender.</p></div>
      <Button variant="secondary" onClick={() => { void loadList(); setDetailVersion(version => version + 1); }} disabled={loading || pending}><RefreshCw className="h-4 w-4" /> Refresh</Button>
    </header>
    {listError && <FeedbackNotice>{listError}</FeedbackNotice>}
    <div className="grid overflow-hidden rounded-3xl border border-brand-border bg-brand-surface lg:grid-cols-[minmax(240px,0.85fr)_minmax(0,2fr)]">
      <section aria-label="Support requests" className={`border-brand-border lg:border-r ${selected ? 'hidden lg:block' : ''}`}>
        <div className="flex items-center justify-between gap-3 border-b border-brand-border p-5"><h2 className="font-semibold">Requests</h2><span className="text-sm tabular-nums text-brand-muted">{inbox?.total ?? '…'}</span></div>
        {loading && !inbox ? <p role="status" className="p-5 text-brand-muted">Loading requests…</p> : inbox?.items.length === 0 ? <p className="p-5 text-sm text-brand-muted">No support requests yet.</p> :
          <ul className="divide-y divide-brand-border">{inbox?.items.map(item => <li key={item.id}><button type="button" onClick={() => choose(item.id)} disabled={pending} aria-current={item.id === selected ? 'true' : undefined}
            className={`w-full px-5 py-5 text-left transition-colors hover:bg-brand-green/5 disabled:opacity-60 ${item.id === selected ? 'bg-brand-green/10' : ''}`}>
            <span className="block truncate font-semibold">{item.user.name}</span><span className="mt-1 block text-sm text-brand-muted">{topics[item.category]}</span>
            <span className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted"><span>{date(item.createdAt)}</span><span className="font-semibold text-brand-green">{item.replies[0]?.deliveryStatus === 'ACCEPTED' ? 'Replied' : item.replies.length ? 'Check delivery' : 'Needs reply'}</span></span>
          </button></li>)}</ul>}
        {inbox && inbox.total > inbox.pageSize && <div className="flex items-center justify-between gap-2 border-t border-brand-border p-4"><Button variant="secondary" size="sm" disabled={page === 1 || pending || loading} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-xs tabular-nums">{page} / {Math.ceil(inbox.total / inbox.pageSize)}</span><Button variant="secondary" size="sm" disabled={page * inbox.pageSize >= inbox.total || pending || loading} onClick={() => setPage(page + 1)}>Next</Button></div>}
      </section>
      <section aria-label="Request conversation" className={`min-w-0 p-5 sm:p-8 ${selected ? '' : 'hidden lg:block'}`}>
        {selected && <Button variant="ghost" size="sm" className="mb-5 lg:hidden" disabled={pending} onClick={() => choose(null)}><ArrowLeft className="h-4 w-4" /> All requests</Button>}
        {detailLoading ? <p role="status" className="text-brand-muted">Opening request…</p> : !selected ? <div className="py-12"><Mail className="mb-5 h-8 w-8 text-brand-green" /><h2 className="font-display text-xl font-bold">Select a support request</h2><p className="mt-3 text-sm text-brand-muted">Read the member’s message and respond to their chosen reply email.</p></div> : record && <>
          <h2 className="font-display text-2xl font-bold">{topics[record.category]}</h2>
          <dl className="mt-5 space-y-2 text-sm"><div><dt className="inline text-brand-muted">From: </dt><dd className="inline break-words">{record.user.name} · {record.user.email}</dd></div><div><dt className="inline text-brand-muted">Reply to: </dt><dd className="inline break-all font-semibold">{record.replyEmail}</dd></div><div><dt className="inline text-brand-muted">Reference: </dt><dd className="inline break-all text-xs">{record.id}</dd></div></dl>
          <div className="mt-8 border-y border-brand-border py-6"><p className="text-xs text-brand-muted">{date(record.createdAt)} · Member message</p><p className="mt-3 whitespace-pre-wrap break-words text-base leading-7">{record.message}</p></div>
          <ol aria-label="Support replies" className="divide-y divide-brand-border">{record.replies.map(item => <li key={item.id} className="py-6"><p className="text-xs text-brand-muted">{item.author?.name ?? 'Kainara Support'} · {date(item.createdAt)}</p><p className="mt-3 whitespace-pre-wrap break-words text-base leading-7">{item.message}</p><p className={`mt-3 text-sm ${item.deliveryStatus === 'ACCEPTED' ? 'text-brand-green' : 'text-status-warning-text'}`}>{delivery(item.deliveryStatus)}. {item.deliveryStatus !== 'ACCEPTED' && 'No automatic retry.'}</p></li>)}</ol>
          <form onSubmit={reply} className="mt-6 space-y-4" aria-busy={pending}>
            <label htmlFor="admin-support-reply" className="block font-semibold">Your reply</label>
            <textarea id="admin-support-reply" value={drafts[record.id] ?? ''} onChange={event => setDrafts(current => ({ ...current, [record.id]: event.target.value }))} required maxLength={4000} rows={6} disabled={pending}
              className="w-full resize-y rounded-2xl border border-brand-border bg-brand-bg px-4 py-3 text-base leading-7 text-brand-text outline-none" placeholder="Write a helpful response…" />
            <p className="break-all text-sm text-brand-muted">This reply will be emailed to {record.replyEmail}.</p>
            {notice && <FeedbackNotice tone="info" variant="inline">{notice}</FeedbackNotice>}
            <Button type="submit" isLoading={pending}>Send reply</Button>
          </form>
        </>}
        {detailError && <FeedbackNotice className="mt-5">{detailError}</FeedbackNotice>}
      </section>
    </div>
  </div>;
}
