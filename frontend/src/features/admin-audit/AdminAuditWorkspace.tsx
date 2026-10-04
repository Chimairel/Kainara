'use client';

import { useEffect, useState } from 'react';
import { ScrollText, RefreshCw, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Button from '@/components/ui/Button';
import api from '@/lib/axios';

export type AuditRow = {
  id: string;
  occurredAt: string;
  actor: string;
  role: string;
  action: string;
  subject: string;
  outcome: string;
};
type History = { rows: AuditRow[]; total: number; page: number; totalPages: number };
const field =
  'min-h-11 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-sm text-brand-text outline-none focus:ring-2 focus:ring-brand-green/40';
const dateLabel = (value: string) =>
  new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
const actions = [
  ['', 'All actions'],
  ['FLAGGED', 'Meal flags'],
  ['RELEASED', 'Flag releases'],
  ['APPROV', 'Approvals'],
  ['REJECT', 'Rejections'],
  ['CLINICAL_PROFILE', 'Health profile reviews'],
  ['OUTSIDE_MEAL', 'Outside food reviews'],
  ['VERIF', 'Verification'],
  ['ACCESS', 'Access changes'],
  ['USER_', 'Account administration'],
  ['WEBSITE_', 'Website content'],
  ['REFERENCE_DATA_', 'Nutrition data'],
  ['NUTRITIONIST_APPLICATION_', 'Applications'],
] as const;

export function AuditHistoryList({ rows, onRelated }: { rows: AuditRow[]; onRelated?: (row: AuditRow) => void }) {
  return (
    <div className="divide-y divide-brand-border/60" aria-label="Audit records">
      {rows.map((row) => (
        <article key={row.id} className="grid gap-3 p-4 md:grid-cols-[145px_1fr_1.5fr_110px_auto] md:items-center">
          <time dateTime={row.occurredAt} className="text-xs text-brand-muted">
            {dateLabel(row.occurredAt)}
          </time>
          <div>
            <p className="text-sm font-semibold text-brand-text">{row.actor}</p>
            <p className="mt-1 text-xs text-brand-muted">
              {row.role === 'ADMIN'
                ? 'Administrator'
                : row.role === 'NUTRITIONIST'
                  ? 'Nutritionist'
                  : 'Role not recorded'}
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-brand-text">{row.action}</p>
            <p className="mt-1 text-xs text-brand-muted">{row.subject}</p>
          </div>
          <p className="text-xs text-brand-muted">{row.outcome}</p>
          {onRelated && (
            <Button
              variant="secondary"
              size="sm"
              className="!min-h-11"
              onClick={() => onRelated(row)}
              aria-label={`Related activity: ${row.action} — ${row.subject}`}
            >
              Related activity
            </Button>
          )}
        </article>
      ))}
      {!rows.length && <p className="p-6 text-sm text-brand-muted">No activity matches these filters.</p>}
    </div>
  );
}
function Pagination({ history, page, setPage }: { history: History; page: number; setPage: (page: number) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border p-4 text-xs text-brand-muted">
      <p>
        {history.total} records · Page {history.page} of {Math.max(1, history.totalPages)}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="!min-h-11"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="!min-h-11"
          disabled={page >= history.totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default function AdminAuditWorkspace() {
  const ownerId = useAuth().user?.userId;
  const [view, setView] = useState<'admin' | 'nutritionist'>('admin');
  const [page, setPage] = useState(1);
  const [staff, setStaff] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mine, setMine] = useState(false);
  const [related, setRelated] = useState<AuditRow | null>(null);
  const [relatedPage, setRelatedPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setActor(staff.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [staff]);
  const validDates = !from || !to || from <= to;
  const filters = {
    view,
    page,
    actor: actor || undefined,
    action: action || undefined,
    from: from || undefined,
    to: to || undefined,
    mine: view === 'admin' && mine ? 'true' : undefined,
  };
  const history = useSessionQuery<History>({
    ownerId,
    resource: `admin-audit:${JSON.stringify(filters)}`,
    enabled: validDates && !related,
    errorMessage: 'Audit history could not be loaded. Please try again.',
    fetcher: async () => {
      const response = await api.get('/admin/audit-history', { params: filters });
      if (!response.data?.success) throw new Error('Audit history unavailable.');
      return response.data.data;
    },
  });
  const relatedHistory = useSessionQuery<History>({
    ownerId,
    resource: `admin-audit-related:${related?.id}:${relatedPage}`,
    enabled: Boolean(related),
    errorMessage: 'Related activity could not be loaded. Please try again.',
    fetcher: async () => {
      const response = await api.get(`/admin/audit-history/${encodeURIComponent(related!.id)}/related`, {
        params: { page: relatedPage },
      });
      if (!response.data?.success) throw new Error('Related activity unavailable.');
      return response.data.data;
    },
  });
  const current = related ? relatedHistory : history;
  const clear = () => {
    setStaff('');
    setActor('');
    setAction('');
    setFrom('');
    setTo('');
    setMine(false);
    setPage(1);
  };
  return (
    <div className="portal-page space-y-5">
      <PortalPageHeader
        icon={ScrollText}
        eyebrow="Governance"
        title="Admin Audit"
        description={
          related
            ? `Activity concerning ${related.subject}. Dates use Philippine time.`
            : 'Administrator actions and nutritionist review history. Dates use Philippine time.'
        }
        meta={
          <Button variant="secondary" disabled={!related && !validDates} onClick={() => void current.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      {related ? (
        <Button variant="secondary" onClick={() => setRelated(null)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to audit
        </Button>
      ) : (
        <>
          <nav
            className="flex flex-wrap gap-2 rounded-2xl border border-brand-border bg-brand-surface p-2"
            aria-label="Audit views"
          >
            {(['admin', 'nutritionist'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={view === tab}
                onClick={() => {
                  setView(tab);
                  setMine(false);
                  setPage(1);
                }}
                className={`min-h-11 flex-1 rounded-xl px-4 py-2 text-sm font-bold focus-visible:ring-2 focus-visible:ring-brand-green ${view === tab ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted hover:bg-brand-bgAlt'}`}
              >
                {tab === 'admin' ? 'Admin activity' : 'Nutritionist history'}
              </button>
            ))}
          </nav>
          <section aria-label="Audit filters" className="rounded-2xl border border-brand-border bg-brand-surface p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-2 text-xs font-semibold text-brand-muted">
                Staff name
                <input
                  aria-label="Staff name"
                  type="search"
                  maxLength={200}
                  value={staff}
                  onChange={(event) => setStaff(event.target.value)}
                  className={field}
                  placeholder="Search staff"
                />
              </label>
              <label className="space-y-2 text-xs font-semibold text-brand-muted">
                Action
                <select
                  aria-label="Action"
                  value={action}
                  onChange={(event) => {
                    setAction(event.target.value);
                    setPage(1);
                  }}
                  className={field}
                >
                  {actions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-xs font-semibold text-brand-muted">
                From
                <input
                  aria-label="From"
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPage(1);
                  }}
                  className={field}
                />
              </label>
              <label className="space-y-2 text-xs font-semibold text-brand-muted">
                To
                <input
                  aria-label="To"
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPage(1);
                  }}
                  className={field}
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              {view === 'admin' && (
                <label className="flex min-h-11 items-center gap-2 text-sm text-brand-text">
                  <input
                    type="checkbox"
                    checked={mine}
                    onChange={(event) => {
                      setMine(event.target.checked);
                      setPage(1);
                    }}
                  />
                  My actions
                </label>
              )}
              <Button variant="secondary" size="sm" className="!min-h-11" onClick={clear}>
                Clear filters
              </Button>
            </div>
            {!validDates && (
              <p role="alert" className="mt-2 text-sm text-status-error-text">
                The end date must be on or after the start date.
              </p>
            )}
          </section>
        </>
      )}
      <section
        className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface"
        aria-label={
          related ? 'Related activity' : view === 'admin' ? 'Admin activity records' : 'Nutritionist history records'
        }
      >
        {current.error && (
          <p role="alert" className="p-4 text-sm text-status-error-text">
            {current.error}
          </p>
        )}
        {current.isLoading && !current.data && (
          <p role="status" className="p-6 text-sm text-brand-muted">
            Loading activity...
          </p>
        )}
        {current.data && validDates && (
          <>
            <AuditHistoryList
              rows={current.data.rows}
              onRelated={
                related
                  ? undefined
                  : (row) => {
                      setRelated(row);
                      setRelatedPage(1);
                    }
              }
            />
            <Pagination
              history={current.data}
              page={related ? relatedPage : page}
              setPage={related ? setRelatedPage : setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}
