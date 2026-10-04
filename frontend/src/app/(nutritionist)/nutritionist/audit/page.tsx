'use client';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';

import { useCallback, useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import api from '@/lib/axios';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import GovernanceQueuePanel from '../reviews/GovernanceQueuePanel';
import { useReviewWorkCounts } from '@/features/nutritionist-reviews/useReviewWorkCounts';
import { formatBadgeCount } from '@/lib/badge-count';

type AuditRow = { id: string; occurredAt: string; nutritionist: string; action: string; subject: string; outcome: string };
type History = { rows: AuditRow[]; page: number; total: number; totalPages: number };

export default function NutritionistAuditPage() {
  const [view, setView] = useState<'history' | 'rechecks'>('history');
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counts = useReviewWorkCounts();
  const load = useCallback(async () => {
    try {
      const response = await api.get('/nutritionist/audit-history', { params: { page, limit: 20 } });
      setHistory(response.data.data);
      setError(null);
    } catch {
      setError('Audit history could not be loaded. Try again.');
    }
  }, [page]);
  useVisiblePolling(
    async () => {
      await load();
    },
    { enabled: view === 'history', immediate: false, scopeKey: String(page) }
  );
  useEffect(() => { if (view === 'history') void load(); }, [load, view]);

  return <div className="portal-page space-y-5 pb-20 text-brand-text">
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <PortalPageHeader icon={ScrollText} eyebrow="Clinical workspace" title="Audit"
        description="Review nutritionist decisions and act on due or flagged rechecks." />
      <div className="flex w-fit gap-1.5 rounded-2xl border border-brand-border/70 bg-brand-surface/75 p-1.5 shadow-sm" aria-label="Audit views">
        <button type="button" aria-pressed={view === 'history'} onClick={() => setView('history')}
          className={`rounded-xl px-4 py-2 text-xs font-extrabold ${view === 'history' ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted hover:text-brand-text'}`}>
          Activity history
        </button>
        <button type="button" aria-pressed={view === 'rechecks'} onClick={() => setView('rechecks')}
          className={`rounded-xl px-4 py-2 text-xs font-extrabold ${view === 'rechecks' ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted hover:text-brand-text'}`}>
          Due rechecks {counts?.audit ? `· ${formatBadgeCount(counts.audit)}` : ''}
        </button>
      </div>
      {view === 'rechecks' ? <GovernanceQueuePanel tab="audit" /> :
        <section className="overflow-hidden rounded-2xl border border-brand-border/70 bg-brand-surface shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-brand-border/70 p-5">
            <div><h2 className="font-display text-xl font-black">Activity history</h2>
              <p className="mt-1 text-xs text-brand-muted">Review decisions and meal flags across the workspace.</p></div>
            <button type="button" onClick={() => void load()} className="rounded-xl border border-brand-border px-3 py-2 text-xs font-bold hover:border-brand-green">Refresh</button>
          </div>
          {error && <p role="alert" className="p-5 text-sm text-status-error-text">{error}</p>}
          {!history && !error ? <p className="p-6 text-sm text-brand-muted">Loading activity…</p> : null}
          {history && <>
            <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-brand-bgAlt/50 text-[10px] uppercase tracking-wider text-brand-muted"><tr>
                <th className="p-3">Date and time</th><th className="p-3">Reviewer</th>
                <th className="p-3">Action</th><th className="p-3">Subject</th><th className="p-3">Outcome</th>
              </tr></thead>
              <tbody>{history.rows.map((row) => <tr key={row.id} className="border-t border-brand-border/50">
                <td className="p-3 text-brand-muted">{new Date(row.occurredAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="p-3 font-semibold">{row.nutritionist}</td><td className="p-3">{row.action}</td>
                <td className="p-3">{row.subject}</td><td className="p-3 text-brand-muted">{row.outcome}</td>
              </tr>)}</tbody></table></div>
            {!history.rows.length && <p className="p-6 text-sm text-brand-muted">No review activity recorded yet.</p>}
            <div className="flex items-center justify-between border-t border-brand-border/70 p-4 text-xs text-brand-muted">
              <span>{history.total} records · Page {history.page} of {Math.max(1, history.totalPages)}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-brand-border px-3 py-1.5 disabled:opacity-40">Previous</button>
                <button type="button" disabled={page >= history.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-brand-border px-3 py-1.5 disabled:opacity-40">Next</button>
              </div>
            </div>
          </>}
        </section>}
    </div>
  </div>;
}
