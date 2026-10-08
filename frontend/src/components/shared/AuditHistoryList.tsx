'use client';

import { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import CaseReviewContext from '@/features/admin-audit/CaseReviewContext';

export type AuditRow = {
  id: string;
  occurredAt: string;
  actor: string;
  role: string;
  action: string;
  subject: string;
  outcome: string;
};
type Nutrition = { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null };
export type AuditDetails = {
  facts: { label: string; value: string }[];
  reason: string | null;
  food: null | {
    name: string | null;
    portionGrams: number | null;
    source: string | null;
    nutritionStatus: string | null;
    ingredients: { name: string; quantity: number | null; unit: string | null }[];
  };
  previous: Nutrition | null;
  effective: Nutrition | null;
};
const dateLabel = (value: string) =>
  new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
const humanize = (value: string) => value.replace(/_/g, ' ').toLowerCase();
const nutritionFields = [
  ['calories', 'Energy', 'kcal'],
  ['proteinG', 'Protein', 'g'],
  ['carbsG', 'Carbs', 'g'],
  ['fatG', 'Fat', 'g'],
] as const;
function RecordedDetails({ data, canAuthor }: { data: AuditDetails; canAuthor: boolean }) {
  const facts = [...data.facts];
  if (data.food?.portionGrams != null) facts.push({ label: 'Portion', value: `${data.food.portionGrams} g` });
  if (data.food?.source) facts.push({ label: 'Source', value: humanize(data.food.source) });
  if (data.food?.nutritionStatus) facts.push({ label: 'Food status', value: humanize(data.food.nutritionStatus) });
  return (
    <div className="space-y-4 text-sm">
      {data.food?.name && <h3 className="break-words font-display font-bold">{data.food.name}</h3>}
      {!!facts.length && (
        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-xs text-brand-muted">{fact.label}</dt>
              <dd className="mt-1 break-words font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {data.effective && (
        <table className="w-full text-left text-xs" aria-label="Recorded nutrition">
          <thead className="text-brand-muted">
            <tr>
              <th className="py-2">Nutrition</th>
              {data.previous && <th>Before</th>}
              <th>{data.previous ? 'After' : 'Recorded'}</th>
            </tr>
          </thead>
          <tbody>
            {nutritionFields.map(([key, label, unit]) => {
              const value = (row: Nutrition) => (row[key] == null ? 'Not recorded' : `${row[key]} ${unit}`);
              return (
                <tr key={key} className="border-t border-brand-border/60">
                  <th className="py-2 font-medium">{label}</th>
                  {data.previous && <td>{value(data.previous)}</td>}
                  <td>{value(data.effective!)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {data.food && (
        <div>
          <h4 className="mb-2 text-xs font-bold">Recorded ingredients</h4>
          {data.food.ingredients.length ? (
            <ul className="space-y-1 text-xs">
              {data.food.ingredients.map((item, index) => (
                <li key={index} className="break-words">
                  {item.name}
                  {item.quantity != null ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-brand-muted">Not recorded</p>
          )}
        </div>
      )}
      {data.reason && (
        <div>
          <h4 className="mb-1 text-xs font-bold">Review reason</h4>
          <p className="whitespace-pre-wrap break-words text-xs">{data.reason}</p>
        </div>
      )}
      {!facts.length && !data.food && !data.reason && !data.effective && (
        <p className="text-xs text-brand-muted">No additional details were recorded.</p>
      )}
      {(data.food || data.effective) && <p className="text-xs text-brand-muted">Saved at the time of this action.</p>}
      {canAuthor && data.food && (
        <Link
          href="/admin/meals?tab=author"
          className="inline-flex min-h-11 items-center text-xs font-bold text-brand-green underline"
        >
          Author a meal
        </Link>
      )}
    </div>
  );
}
function DetailPanel({
  id,
  ownerId,
  endpoint,
  canAuthor,
}: {
  id: string;
  ownerId: string | undefined;
  endpoint: string;
  canAuthor: boolean;
}) {
  const query = useSessionQuery<AuditDetails>({
    ownerId,
    resource: `audit-detail:${endpoint}:${id}`,
    errorMessage: 'Details could not be loaded. Please try again.',
    fetcher: async () => {
      const response = await api.get(`${endpoint}/${encodeURIComponent(id)}`);
      if (!response.data?.success) throw new Error('Details could not be loaded. Please try again.');
      return response.data.data;
    },
  });
  return (
    <>
      {query.error && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-xs text-status-error-text">
            {query.error}
          </p>
          <Button variant="secondary" size="sm" className="!min-h-11" onClick={() => void query.refetch()}>
            Retry details
          </Button>
        </div>
      )}
      {query.isLoading && !query.data && (
        <p role="status" className="text-xs text-brand-muted">
          Loading details...
        </p>
      )}
      {query.data && <RecordedDetails data={query.data} canAuthor={canAuthor} />}
      {query.data && endpoint.startsWith('/admin/') && <CaseReviewContext key={id} auditId={id} ownerId={ownerId} />}
    </>
  );
}
function AuditEntry({
  row,
  expanded,
  onToggle,
  onRelated,
  ownerId,
  endpoint,
  canAuthor,
}: {
  row: AuditRow;
  expanded: boolean;
  onToggle: () => void;
  onRelated?: (row: AuditRow) => void;
  ownerId: string | undefined;
  endpoint: string;
  canAuthor: boolean;
}) {
  const panelId = useId();
  return (
    <article>
      <div className="grid gap-3 p-4 md:grid-cols-[145px_1fr_1.5fr_110px_auto] md:items-center">
        <time dateTime={row.occurredAt} className="text-xs text-brand-muted">
          {dateLabel(row.occurredAt)}
        </time>
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{row.actor}</p>
          <p className="mt-1 text-xs text-brand-muted">
            {row.role === 'ADMIN' ? 'Administrator' : row.role === 'NUTRITIONIST' ? 'RND' : 'Role not recorded'}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold">{row.action}</p>
          <p className="mt-1 break-words text-xs text-brand-muted">{row.subject}</p>
        </div>
        <p className="text-xs text-brand-muted">{row.outcome}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="!min-h-11"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={`Details: ${row.action} — ${row.subject}`}
            onClick={onToggle}
          >
            Details {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          {onRelated && (
            <Button
              variant="ghost"
              size="sm"
              className="!min-h-11"
              onClick={() => onRelated(row)}
              aria-label={`Related activity: ${row.action} — ${row.subject}`}
            >
              Related activity
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <div
          id={panelId}
          role="region"
          aria-label={`${row.action} details`}
          className="mx-4 mb-4 rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 text-brand-text"
        >
          <DetailPanel
            key={`${ownerId}:${row.id}`}
            id={row.id}
            ownerId={ownerId}
            endpoint={endpoint}
            canAuthor={canAuthor}
          />
        </div>
      )}
    </article>
  );
}
export default function AuditHistoryList({
  rows,
  onRelated,
  ownerId,
  endpoint,
  canAuthor = false,
}: {
  rows: AuditRow[];
  onRelated?: (row: AuditRow) => void;
  ownerId: string | undefined;
  endpoint: string;
  canAuthor?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div className="divide-y divide-brand-border/60" aria-label="Audit records">
      {rows.map((row) => (
        <AuditEntry
          key={row.id}
          row={row}
          expanded={expandedId === row.id}
          onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
          onRelated={onRelated}
          ownerId={ownerId}
          endpoint={endpoint}
          canAuthor={canAuthor}
        />
      ))}
      {!rows.length && <p className="p-6 text-sm text-brand-muted">No activity matches these filters.</p>}
    </div>
  );
}
