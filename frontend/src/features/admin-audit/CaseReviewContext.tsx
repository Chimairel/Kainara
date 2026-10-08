'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import MealReviewTimeline, { type ReviewIncident } from '@/features/nutritionist-library/MealReviewTimeline';
function ReadOnlyFields({ value }: { value: unknown }) {
  if (value == null) return <span className="text-brand-muted">Not recorded</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ul className="space-y-3">
        {value.map((item, index) => (
          <li key={index}>
            <ReadOnlyFields value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <span className="text-brand-muted">None recorded</span>
    );
  if (typeof value !== 'object') return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
  return (
    <dl className="space-y-2 border-l border-brand-border pl-3">
      {Object.entries(value)
        .filter(
          ([key]) =>
            !['id', 'userId', 'nutritionistProfileId', 'claimedByNutritionistId', 'sha256', 'documentSha256'].includes(
              key
            )
        )
        .map(([key, item]) => (
          <div key={key}>
            <dt className="text-xs font-semibold text-brand-muted">
              {key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ')}
            </dt>
            <dd className="text-xs">
              <ReadOnlyFields value={item} />
            </dd>
          </div>
        ))}
    </dl>
  );
}
type Context = {
  currentProfile: unknown;
  reviewedSnapshot: unknown;
  decisions: unknown;
  clinicalEvidence: { id?: string; documentType?: string; originalFileName?: string }[];
  historicalInformation: string | null;
  recipe?: { history: ReviewIncident[]; legacyHistoryUnknown: boolean };
};
export default function CaseReviewContext({ auditId, ownerId }: { auditId: string; ownerId: string | undefined }) {
  const scope = JSON.stringify([auditId, ownerId]);
  const liveScope = useRef(scope);
  liveScope.current = scope;
  const [loaded, setLoaded] = useState<{ scope: string; data: Context } | null>(null);
  const data = loaded?.scope === scope ? loaded.data : null;
  useEffect(() => {
    setLoaded(null);
    setError(null);
    setBusy(false);
  }, [ownerId, auditId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.get(`/admin/audit-history/${encodeURIComponent(auditId)}/review-context`);
      if (liveScope.current === scope) setLoaded({ scope, data: result.data.data });
    } catch (err) {
      if (liveScope.current !== scope) return;
      setError(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          'Review context could not be loaded.'
      );
    } finally {
      if (liveScope.current === scope) setBusy(false);
    }
  }
  return (
    <section className="space-y-3 border-t border-brand-border pt-3">
      {!data && (
        <Button variant="secondary" size="sm" isLoading={busy} onClick={() => void open()}>
          Open related review details
        </Button>
      )}
      {error && (
        <p role="alert" className="text-xs text-status-error-text">
          {error}
        </p>
      )}
      {data && (
        <>
          <p className="text-xs text-brand-muted">Read-only case oversight. Access to clinical details is recorded.</p>
          {data.historicalInformation && <p className="text-xs text-brand-muted">{data.historicalInformation}</p>}
          {data.recipe && (
            <MealReviewTimeline history={data.recipe.history} legacyHistoryUnknown={data.recipe.legacyHistoryUnknown} />
          )}
          {(
            [
              ['Current member profile', data.currentProfile],
              ['Profile recorded for review', data.reviewedSnapshot],
              ['Recorded review decisions', data.decisions],
              ['Clinical evidence attached to this case', data.clinicalEvidence],
            ] as const
          ).map(
            ([label, value]) =>
              value != null && (
                <details key={label} className="rounded-xl border border-brand-border p-3">
                  <summary className="min-h-11 cursor-pointer text-sm font-semibold">{label}</summary>
                  <ReadOnlyFields value={value} />
                </details>
              )
          )}
          {data.clinicalEvidence
            .filter((document) => document.id)
            .map((record) => (
              <Button
                key={record.id}
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    const result = await api.get(
                      `/admin/audit-history/${encodeURIComponent(auditId)}/review-context/documents/${encodeURIComponent(record.id!)}/file`,
                      { responseType: 'blob' }
                    );
                    if (liveScope.current !== scope) return;
                    const url = URL.createObjectURL(result.data);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = record.originalFileName || 'clinical-evidence';
                    anchor.click();
                    setTimeout(() => URL.revokeObjectURL(url), 30_000);
                  } catch {
                    if (liveScope.current !== scope) return;
                    setError('The related original record could not be loaded. It may have been withdrawn.');
                  }
                }}
              >
                Download related {record.documentType?.replaceAll('_', ' ').toLowerCase() || 'clinical record'}
              </Button>
            ))}
          <Button variant="secondary" size="sm" onClick={() => setLoaded(null)}>
            Close case details
          </Button>
        </>
      )}
    </section>
  );
}
