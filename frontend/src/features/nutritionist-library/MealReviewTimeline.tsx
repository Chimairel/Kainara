'use client';

import { useState } from 'react';
import { Calendar, ChevronDown, ClipboardList, FileText, Flag } from 'lucide-react';
import RecordPaper, { recordFieldClass, recordSectionClass } from '@/components/shared/RecordPaper';
import { Select } from '@/components/ui/Select';
import { formatManilaDate } from '@/lib/manila-date';

export type SnapshotMeal = {
  id: string;
  mealName?: string;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  sodiumMg?: number | null;
  nutritionServingDescription?: string | null;
  description?: string;
  ingredients?: { ingredientName: string; quantity: number | null; unit: string | null }[];
};
export type ReviewReport = {
  id: string;
  createdAt: string;
  actorSnapshot: { name?: string; role?: string };
  notes: {
    category?: string;
    affectedFields?: string[];
    explanation: string;
    reference?: string;
    proposedCorrection?: string;
    historicalInformation?: string;
  };
};
export type ReviewIncident = {
  id: string;
  number: number;
  state: string;
  reports: ReviewReport[];
  decisions: {
    id: string;
    action: string;
    createdAt: string;
    actorSnapshot: { name?: string; role?: string };
    rationale: string;
    version: string;
    snapshot: { meals?: SnapshotMeal[] };
  }[];
};
export const reviewStateLabel = (state: string) =>
  ({
    PUBLISHED: 'Published',
    PENDING_REREVIEW: 'Pending re-review',
    QUARANTINED: 'Quarantined',
    ARCHIVED: 'Archived',
    RELEASED: 'Released',
  })[state] ?? state;

const actionLabel = (action: string) =>
  ({
    WITHHELD: 'Recipe withheld',
    FLAGGED: 'Flag recorded',
    CORRECTION_BEFORE: 'Before correction',
    CORRECTED: 'Recipe corrected',
    CONFIRMED: 'Independent confirmation',
    REVERIFIED: 'Recipe re-verified',
    ADMIN_RELEASED: 'Admin release',
    ARCHIVED: 'Recipe archived',
  })[action] ?? action.replaceAll('_', ' ').toLowerCase();
const incidentLabel = (incident: ReviewIncident) =>
  incident.number === 0 ? 'Legacy hold' : `Incident ${incident.number}`;
const recordedDate = (date: string) =>
  Number.isNaN(new Date(date).getTime())
    ? 'Date not recorded'
    : formatManilaDate(date, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const nutritionFields = [
  ['calories', 'Energy', 'kcal'],
  ['proteinG', 'Protein', 'g protein'],
  ['carbsG', 'Carbs', 'g carbs'],
  ['fatG', 'Fat', 'g fat'],
  ['sodiumMg', 'Sodium', 'mg sodium'],
] as const;
const nutritionValue = (meal: SnapshotMeal, key: (typeof nutritionFields)[number][0], unit: string) =>
  meal[key] == null ? 'Not recorded' : `${meal[key]} ${unit}`;

export function ReviewSnapshot({ meals, previous }: { meals: SnapshotMeal[]; previous?: SnapshotMeal[] }) {
  return (
    <div className="space-y-4">
      {meals.map((meal) => {
        const before = previous?.find((entry) => entry.id === meal.id);
        return (
          <section
            key={meal.id}
            className={recordSectionClass}
            aria-label={`Recorded recipe: ${meal.mealName ?? 'Name not recorded'}`}
          >
            <div className="border-b border-brand-border/70 pb-3">
              <h4 className="font-display text-base font-extrabold tracking-tight">
                {meal.mealName ?? 'Name not recorded'}
              </h4>
              <p className="mt-1 text-xs text-brand-muted">
                {meal.nutritionServingDescription ?? 'Serving description not recorded'}
              </p>
            </div>
            {before ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm" aria-label="Recorded correction comparison">
                  <thead>
                    <tr className="text-brand-muted">
                      <th className="py-2 pr-3">Nutrition</th>
                      <th className="pr-3">Before</th>
                      <th>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nutritionFields.map(([key, label, unit]) => (
                      <tr key={key} className="border-t border-brand-border/60">
                        <th className="py-2.5 pr-3 font-semibold">{label}</th>
                        <td className="pr-3">{nutritionValue(before, key, unit)}</td>
                        <td className={`font-semibold ${before[key] !== meal[key] ? 'text-brand-green' : ''}`}>
                          {nutritionValue(meal, key, unit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-brand-muted">
                  Compared with the recorded snapshot immediately before this correction.
                </p>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {nutritionFields.map(([key, label, unit]) => (
                  <div key={key} className={recordFieldClass}>
                    <dt className="text-xs font-semibold text-brand-muted">{label}</dt>
                    <dd className="mt-1 font-display text-sm font-bold">{nutritionValue(meal, key, unit)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {meal.description && <p className="whitespace-pre-wrap text-sm leading-relaxed">{meal.description}</p>}
            <details className="group rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
                Recorded ingredients and serving
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="space-y-3 border-t border-brand-border/70 p-3 text-sm">
                {before && (
                  <p className="text-xs text-brand-muted">
                    Before: {before.nutritionServingDescription ?? 'Serving description not recorded'}
                  </p>
                )}
                <p className="text-xs text-brand-muted">
                  {before ? 'After: ' : ''}
                  {meal.nutritionServingDescription ?? 'Serving description not recorded'}
                </p>
                {meal.ingredients?.length ? (
                  <ul className="space-y-2">
                    {meal.ingredients.map((item, index) => (
                      <li key={index} className={recordFieldClass}>
                        {item.ingredientName} ·{' '}
                        {item.quantity == null ? 'Quantity not recorded' : `${item.quantity} ${item.unit ?? ''}`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-brand-muted">Ingredients not recorded.</p>
                )}
                {before?.ingredients?.length ? (
                  <div>
                    <p className="mb-2 text-xs font-bold text-brand-muted">Ingredients before correction</p>
                    <ul className="space-y-2">
                      {before.ingredients.map((item, index) => (
                        <li key={index}>
                          {item.ingredientName} ·{' '}
                          {item.quantity == null ? 'Quantity not recorded' : `${item.quantity} ${item.unit ?? ''}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}

export default function MealReviewTimeline({
  history,
  legacyHistoryUnknown,
  displayedReportIds = [],
}: {
  history: ReviewIncident[];
  legacyHistoryUnknown: boolean;
  displayedReportIds?: string[];
}) {
  const [selectedId, setSelectedId] = useState('');
  const entries = history.flatMap((incident) =>
    incident.decisions.map((decision, index) => ({ incident, decision, index }))
  );
  // Preserve the server's chronological order, including decisions with equal timestamps.
  const selected = entries.find((entry) => entry.decision.id === selectedId) ?? entries.at(-1);
  const preceding = selected?.incident.decisions[(selected?.index ?? 0) - 1];
  const previous =
    selected?.decision.action === 'CORRECTED' && preceding?.action === 'CORRECTION_BEFORE' ? preceding : undefined;
  const reports = selected?.incident.reports.filter((report) => !displayedReportIds.includes(report.id)) ?? [];
  return (
    <RecordPaper aria-label="Recipe review timeline">
      <header className="border-b border-brand-border/80 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green">
              KAINARA · Review record
            </span>
            <h3 className="mt-2 font-display text-xl font-black tracking-tight sm:text-2xl">Review timeline</h3>
            <p className="mt-1 text-sm text-brand-muted">Inspect saved changes, reviewer findings and flag notes.</p>
          </div>
          <span className="rounded-full border border-brand-border bg-brand-bgAlt px-3 py-1.5 text-xs font-semibold">
            {entries.length} recorded {entries.length === 1 ? 'change' : 'changes'}
          </span>
        </div>
      </header>
      {legacyHistoryUnknown && (
        <p className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-brand-muted">
          Prior incident counts and missing historical values were not recorded. Legacy reports are preserved as
          evidence.
        </p>
      )}
      {selected ? (
        <>
          <Select
            aria-label="Review change"
            className="w-full"
            value={selected.decision.id}
            options={[...entries].reverse().map(({ incident, decision }) => ({
              value: decision.id,
              label: `${incidentLabel(incident)} · ${actionLabel(decision.action)} · ${recordedDate(decision.createdAt)}`,
            }))}
            onChange={setSelectedId}
          />
          <section className={recordSectionClass} aria-label="Selected review change">
            <div className="flex items-center gap-2.5 border-b border-brand-border/70 pb-3">
              <div className="rounded-xl bg-brand-green/10 p-2 text-brand-green">
                <ClipboardList className="h-4 w-4" />
              </div>
              <h4 className="font-display text-base font-bold">{actionLabel(selected.decision.action)}</h4>
            </div>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className={recordFieldClass}>
                <dt className="text-xs text-brand-muted">Recorded by</dt>
                <dd className="mt-1 text-sm font-bold">
                  {selected.decision.actorSnapshot.name ?? 'Actor not recorded'}
                </dd>
              </div>
              <div className={recordFieldClass}>
                <dt className="flex items-center gap-1.5 text-xs text-brand-muted">
                  <Calendar className="h-3.5 w-3.5" />
                  Recorded on
                </dt>
                <dd className="mt-1 text-sm font-semibold">{recordedDate(selected.decision.createdAt)}</dd>
              </div>
              <div className={recordFieldClass}>
                <dt className="text-xs text-brand-muted">Incident</dt>
                <dd className="mt-1 text-sm font-semibold">{incidentLabel(selected.incident)}</dd>
              </div>
              <div className={recordFieldClass}>
                <dt className="text-xs text-brand-muted">Incident status</dt>
                <dd className="mt-1 text-sm font-semibold">{reviewStateLabel(selected.incident.state)}</dd>
              </div>
            </dl>
            <div>
              <h5 className="mb-1 text-xs font-bold text-brand-muted">Review findings</h5>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {selected.decision.rationale || 'Rationale not recorded.'}
              </p>
            </div>
            <p className="text-xs text-brand-muted">
              Immutable values recorded for this decision. Version {selected.decision.version.slice(0, 12)}.
            </p>
          </section>
          {selected.decision.snapshot.meals ? (
            <ReviewSnapshot meals={selected.decision.snapshot.meals} previous={previous?.snapshot.meals} />
          ) : (
            <p className="text-sm text-brand-muted">Historical recipe values not recorded.</p>
          )}
          {reports.length > 0 && (
            <section className="space-y-3" aria-label="Incident flag notes">
              <h4 className="flex items-center gap-2 font-display text-base font-bold">
                <Flag className="h-4 w-4 text-brand-accent" />
                Incident flag notes
              </h4>
              {reports.map((report) => (
                <details key={report.id} className="group rounded-2xl border border-amber-500/25 bg-amber-500/[0.03]">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    <span>
                      {report.actorSnapshot.name ?? 'Actor not recorded'} ·{' '}
                      {report.notes.category?.toLowerCase() ?? 'Concern'}
                      <span className="mt-1 block text-xs font-normal text-brand-muted">
                        {recordedDate(report.createdAt)}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <dl className="space-y-3 border-t border-amber-500/20 p-3 text-sm">
                    {[
                      ['Affected fields', report.notes.affectedFields?.join(', ')],
                      ['Explanation', report.notes.explanation],
                      ['Supporting evidence', report.notes.reference],
                      ['Proposed correction', report.notes.proposedCorrection],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="mb-1 text-xs font-bold text-brand-muted">{label}</dt>
                        <dd className="whitespace-pre-wrap">{value || 'Not recorded'}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ))}
            </section>
          )}
          <details className="group rounded-2xl border border-brand-border bg-brand-bgAlt/40">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-3 text-xs font-bold [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-green" />
                All recorded nutrition and evidence fields
              </span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all border-t border-brand-border p-3 text-xs">
              {JSON.stringify(selected.decision.snapshot, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <p className="text-sm text-brand-muted">No incident decisions have been recorded.</p>
      )}
    </RecordPaper>
  );
}
