'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { formatMealTitle } from '@/lib/meal-title';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import RecordPaper, { recordFieldClass, recordSectionClass } from './RecordPaper';
import CaseReviewContext from '@/features/admin-audit/CaseReviewContext';
import WorkspaceTable, { type WorkspaceTableColumn } from './WorkspaceTable';
import { recordedConditionsLabel } from '@/lib/recorded-review-conditions';

export type AuditRow = {
  id: string;
  occurredAt: string;
  actor: string;
  role: string;
  action: string;
  subject: string;
  outcome: string;
  type?: string;
  conditionCodes?: string[] | null;
};
type Nutrition = { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null };
export type AuditDetails = {
  contextAvailable?: boolean;
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
    <RecordPaper aria-label="Recorded audit action" className="text-sm">
      <p className="font-mono text-xs font-bold uppercase tracking-widest text-brand-green">KAINARA · Audit record</p>
      {data.food?.name && (
        <h3 className="break-words font-display text-xl font-extrabold tracking-tight">{formatMealTitle(data.food.name)}</h3>
      )}
      {!!facts.length && (
        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className={`${recordFieldClass} min-w-0`}>
              <dt className="text-xs text-brand-muted">{fact.label}</dt>
              <dd className="mt-1 break-words font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {data.effective && (
        <table className={`${recordSectionClass} w-full text-left text-sm`} aria-label="Recorded nutrition">
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
        <section className={recordSectionClass}>
          <h4 className="mb-2 font-display text-sm font-bold">Recorded ingredients</h4>
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
        </section>
      )}
      {data.reason && (
        <section className={recordSectionClass}>
          <h4 className="mb-1 font-display text-sm font-bold">Review reason</h4>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{data.reason}</p>
        </section>
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
    </RecordPaper>
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
          <FeedbackNotice variant="inline">{query.error}</FeedbackNotice>
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
      {query.data?.contextAvailable && <CaseReviewContext key={id} auditId={id} ownerId={ownerId} endpoint={endpoint} autoOpen />}
      {query.data && (query.data.contextAvailable ? (
        <details className="border-t border-brand-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold">Audit metadata</summary>
          <RecordedDetails data={query.data} canAuthor={canAuthor} />
        </details>
      ) : <RecordedDetails data={query.data} canAuthor={canAuthor} />)}
    </>
  );
}
export default function AuditHistoryList({
  rows,
  onRelated,
  ownerId,
  endpoint,
  canAuthor = false,
  showConditions = false,
}: {
  rows: AuditRow[];
  onRelated?: (row: AuditRow) => void;
  ownerId: string | undefined;
  endpoint: string;
  canAuthor?: boolean;
  showConditions?: boolean;
}) {
  const [opened, setOpened] = useState<{ row: AuditRow; ownerId: string | undefined; endpoint: string } | null>(null);
  const selected = opened && opened.ownerId === ownerId && opened.endpoint === endpoint ? opened.row : null;
  const columns: WorkspaceTableColumn<AuditRow>[] = [
    {
      key: 'date',
      header: 'Date',
      headerClassName: 'min-w-[145px]',
      cell: (row) => (
        <time dateTime={row.occurredAt} className="text-brand-muted">
          {dateLabel(row.occurredAt)}
        </time>
      ),
    },
    {
      key: 'staff',
      header: 'Staff',
      headerClassName: showConditions ? 'min-w-[150px]' : 'min-w-[180px]',
      cell: (row) => (
        <>
          <p className="break-words font-semibold">{row.actor}</p>
          <p className="mt-1 text-[11px] text-brand-muted">
            {row.role === 'ADMIN' ? 'Administrator' : row.role === 'NUTRITIONIST' ? 'RND' : 'Role not recorded'}
          </p>
        </>
      ),
    },
    ...(showConditions ? [{ key: 'conditions', header: 'Condition', headerClassName: 'min-w-[150px]',
      cell: (row: AuditRow) => <span>{recordedConditionsLabel(row.conditionCodes)}</span> }] : []),
    { key: 'type', header: 'Type', headerClassName: showConditions ? 'min-w-[110px]' : 'min-w-[155px]', cell: (row) => row.type ?? 'Recorded activity' },
    {
      key: 'action',
      header: 'Action',
      headerClassName: showConditions ? 'min-w-[160px]' : 'min-w-[240px]',
      cell: (row) => (
        <>
          <p className="font-bold">{row.action}</p>
          <p className="mt-1 break-words text-[11px] text-brand-muted">{formatMealTitle(row.subject)}</p>
        </>
      ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      headerClassName: 'min-w-[110px]',
      cell: (row) => <span className="text-brand-muted">{row.outcome}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: showConditions && !onRelated ? 'min-w-[100px]' : 'min-w-[160px]',
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="!min-h-11"
            aria-haspopup="dialog"
            aria-label={'Details: ' + row.action + ' — ' + formatMealTitle(row.subject)}
            onClick={() => setOpened({ row, ownerId, endpoint })}
          >
            Details
          </Button>
          {onRelated && (
            <Button
              variant="ghost"
              size="sm"
              className="!min-h-11"
              onClick={() => onRelated(row)}
              aria-label={'Related activity: ' + row.action + ' — ' + formatMealTitle(row.subject)}
            >
              Related activity
            </Button>
          )}
        </div>
      ),
    },
  ];
  return (
    <>
    <WorkspaceTable
      label="Audit records"
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      emptyMessage="No activity matches these filters."
      footer={
        <span>
          Showing <strong className="text-brand-text">{rows.length}</strong> records
        </span>
      }
    />
    <Modal isOpen={Boolean(selected)} onClose={() => setOpened(null)} size="4xl"
      title={selected ? `${selected.type ?? 'Audit record'} · ${formatMealTitle(selected.subject)}` : 'Audit record'}
      description={selected ? `${selected.action} · ${selected.actor} · ${dateLabel(selected.occurredAt)}` : undefined}>
      {selected && <section role="region" aria-label={selected.action + ' details'} className="space-y-5">
        <DetailPanel key={ownerId + ':' + selected.id} id={selected.id} ownerId={ownerId} endpoint={endpoint} canAuthor={canAuthor} />
      </section>}
    </Modal>
    </>
  );
}
