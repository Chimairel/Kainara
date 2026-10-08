'use client';

type SnapshotMeal = {
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

export function ReviewSnapshot({ meals }: { meals: SnapshotMeal[] }) {
  return (
    <div className="space-y-3">
      {meals.map((meal) => (
        <section key={meal.id} className="rounded-xl border border-brand-border p-3 text-xs">
          <h4 className="font-bold">{meal.mealName ?? 'Name not recorded'}</h4>
          <p className="text-brand-muted">{meal.nutritionServingDescription ?? 'Serving description not recorded'}</p>
          <dl className="my-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(
              [
                ['calories', 'kcal'],
                ['proteinG', 'g protein'],
                ['carbsG', 'g carbs'],
                ['fatG', 'g fat'],
                ['sodiumMg', 'mg sodium'],
              ] as const
            ).map(([key, unit]) => (
              <div key={key}>
                <dt className="text-brand-muted">{key === 'calories' ? 'Energy' : unit.split(' ').at(-1)}</dt>
                <dd>{meal[key] == null ? 'Not recorded' : `${meal[key]} ${unit}`}</dd>
              </div>
            ))}
          </dl>
          <p className="whitespace-pre-wrap">{meal.description}</p>
          <ul className="mt-2 space-y-1">
            {meal.ingredients?.map((item, index) => (
              <li key={index}>
                {item.ingredientName} ·{' '}
                {item.quantity == null ? 'Quantity not recorded' : `${item.quantity} ${item.unit ?? ''}`}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function MealReviewTimeline({
  history,
  legacyHistoryUnknown,
}: {
  history: ReviewIncident[];
  legacyHistoryUnknown: boolean;
}) {
  return (
    <section className="space-y-4" aria-label="Recipe review timeline">
      <h3 className="font-display text-lg font-bold">Review timeline</h3>
      {legacyHistoryUnknown && (
        <p className="text-sm text-brand-muted">
          Prior incident counts and missing historical values were not recorded. Legacy reports are preserved as
          evidence.
        </p>
      )}
      {!history.length && <p className="text-sm text-brand-muted">No incident decisions have been recorded.</p>}
      {history.map((incident) => (
        <div key={incident.id} className="space-y-3 border-l-2 border-brand-border pl-4">
          <h4 className="font-bold">
            {incident.number === 0 ? 'Legacy hold' : `Incident ${incident.number}`} · {reviewStateLabel(incident.state)}
          </h4>
          {incident.decisions.map((decision) => (
            <details key={decision.id} className="rounded-xl border border-brand-border bg-brand-bg p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                {decision.action.replaceAll('_', ' ')} · {decision.actorSnapshot.name ?? 'Actor not recorded'}
                <span className="ml-2 text-xs font-normal text-brand-muted">
                  {new Date(decision.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
                </span>
              </summary>
              <p className="my-3 whitespace-pre-wrap text-sm">{decision.rationale}</p>
              <p className="mb-2 text-xs text-brand-muted">
                Immutable values recorded for this decision. Version {decision.version.slice(0, 12)}.
              </p>
              {decision.snapshot.meals ? (
                <ReviewSnapshot meals={decision.snapshot.meals} />
              ) : (
                <p className="text-xs">Historical recipe values not recorded.</p>
              )}
              <details className="mt-3 text-xs">
                <summary>All recorded nutrition and evidence fields</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(decision.snapshot, null, 2)}
                </pre>
              </details>
            </details>
          ))}
        </div>
      ))}
    </section>
  );
}
