'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';

type QueueItem = {
  userId: string; name: string; profileRevision: number; conditions: string[]; allergies: string[];
  needsClarification: boolean; status: string;
};
type Detail = QueueItem & {
  age: number | null; goal: string | null; dietaryPreference: string | null;
  dailyCalorieTarget: number | null; customConditions: string[]; customFoodRestrictions: string[];
  requirements: Array<{ area: string; state: string; message: string }>;
  documents: Array<{ id: string; area: string; status: string; originalFileName: string }>;
  availableAreas: string[];
  previousReview: null | { status: string; reasonCodes: string[]; notes: string | null };
  nutritionGuidance: null | {
    version: number; generatedAt: string; acknowledgedAt: string | null; isCurrent: boolean;
    summary: string; referenceItems: Array<{
      heading: string; value: string; explanation: string; sourceTitle: string; sourceUrl: string;
    }>;
  };
};

export default function ClinicalProfileReviewPanel() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notes, setNotes] = useState('');
  const [requestArea, setRequestArea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/nutritionist/profile-reviews');
      setQueue(response.data.data);
    } catch (cause) { setError(getApiErrorMessage(cause, 'The profile queue could not be loaded.')); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const select = async (userId: string) => {
    setBusy(true); setError(null);
    try {
      const response = await api.get(`/nutritionist/profile-reviews/${userId}`);
      setDetail(response.data.data);
      setNotes('');
      setRequestArea(response.data.data.availableAreas?.[0] ?? '');
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not open this profile.')); }
    finally { setBusy(false); }
  };
  const decide = async (decision: 'APPROVED' | 'DECLINED' | 'REQUEST_DOCUMENT') => {
    if (!detail) return;
    setBusy(true); setError(null);
    try {
      await api.post(`/nutritionist/profile-reviews/${detail.userId}/decision`, {
        decision, notes, ...(decision === 'REQUEST_DOCUMENT' ? { area: requestArea } : {}),
      });
      setDetail(null); setNotes('');
      await refresh();
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not save this profile review.')); }
    finally { setBusy(false); }
  };
  const blocked = detail?.needsClarification || detail?.requirements.some((item) => item.state !== 'READY');

  return (
    <div className="overflow-y-auto rounded-3xl border border-brand-border/70 bg-brand-surface p-6 text-brand-text shadow-card-lg backdrop-blur-xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-black text-brand-text">Health profile review</h2>
          <p className="mt-1 text-xs text-brand-muted max-w-2xl leading-relaxed">
            Review declared conditions and allergies before meal candidates are prepared. Confirming this planning context does not verify a diagnosis; each restricted meal still needs its own case approval.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,360px)_1fr]">
        <div className="space-y-2.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 custom-scrollbar">
          {queue.length ? (
            queue.map((item) => (
              <button
                key={item.userId}
                type="button"
                disabled={busy}
                onClick={() => void select(item.userId)}
                className={`w-full rounded-2xl border p-4 text-left text-sm transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                  detail?.userId === item.userId
                    ? 'border-brand-accent/70 bg-brand-accent/10 shadow-sm'
                    : 'border-brand-border/70 bg-brand-surface hover:border-brand-accent/30'
                }`}
              >
                <strong className="block font-display text-sm font-bold text-brand-text">{item.name}</strong>
                <p className="mt-1 text-xs text-brand-muted">
                  Conditions: {item.conditions.filter((value) => value !== 'NONE').join(', ') || 'none'} · Allergies: {item.allergies.filter((value) => value !== 'NONE').join(', ') || 'none'}
                </p>
                <p className="mt-1 font-mono text-[10px] text-brand-muted">
                  {item.status.replaceAll('_', ' ').toLowerCase()} · profile revision {item.profileRevision}
                </p>
              </button>
            ))
          ) : (
            <div className="p-8 text-center rounded-2xl border border-dashed border-brand-border/80 bg-brand-surface/40 text-xs text-brand-muted">
              No restricted profiles are awaiting review.
            </div>
          )}
        </div>

        {detail ? (
          <div className="space-y-5 rounded-2xl border border-brand-border/70 bg-brand-surface p-5">
            <div>
              <h3 className="font-display text-xl font-bold text-brand-text">{detail.name}</h3>
              <p className="mt-1 text-xs text-brand-muted">
                Age {detail.age ?? 'not recorded'} · {detail.goal ?? 'no goal'} · {detail.dietaryPreference ?? 'no diet preference'} · {detail.dailyCalorieTarget ?? 'no target'} kcal/day
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3.5">
                <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Conditions</h4>
                <p className="mt-1.5 text-sm font-semibold text-brand-text">
                  {[...detail.conditions.filter((value) => value !== 'NONE'), ...detail.customConditions].join(', ') || 'None declared'}
                </p>
              </div>
              <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3.5">
                <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Allergies and food restrictions</h4>
                <p className="mt-1.5 text-sm font-semibold text-brand-text">
                  {[...detail.allergies.filter((value) => value !== 'NONE'), ...detail.customFoodRestrictions].join(', ') || 'None declared'}
                </p>
              </div>
            </div>

            <section className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 space-y-3" aria-label="Nutrition guidance">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-brand-text">Nutrition guidance</h4>
                {detail.nutritionGuidance && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                      detail.nutritionGuidance.isCurrent
                        ? 'border-brand-green text-brand-green bg-brand-green/10'
                        : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                    }`}
                  >
                    {detail.nutritionGuidance.isCurrent ? 'Current profile' : 'Out of date'}
                  </span>
                )}
              </div>
              {detail.nutritionGuidance ? (
                <>
                  <p className="text-[11px] text-brand-muted">
                    Version {detail.nutritionGuidance.version} · Prepared {new Date(detail.nutritionGuidance.generatedAt).toLocaleDateString()} · {detail.nutritionGuidance.acknowledgedAt ? 'Acknowledged by user' : 'Awaiting user acknowledgment'}
                  </p>
                  <p className="text-xs text-brand-muted leading-relaxed">{detail.nutritionGuidance.summary}</p>
                  <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
                    {detail.nutritionGuidance.referenceItems.map((item, index) => (
                      <div key={`${item.heading}-${index}`} className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/30 p-3 text-xs">
                        <p className="font-bold text-brand-text">{item.heading}: {item.value}</p>
                        <p className="mt-1 text-brand-muted">{item.explanation}</p>
                        {item.sourceUrl.startsWith('https://') && (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block font-semibold text-brand-green hover:underline">
                            {item.sourceTitle} ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-brand-muted">No nutrition guidance has been prepared for this profile yet.</p>
              )}
              <p className="text-[10px] text-brand-muted">These are planning references, not a diagnosis or approval of a particular meal.</p>
            </section>

            {detail.needsClarification && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-400 font-semibold">
                A restriction needs clarification before this profile can be approved.
              </div>
            )}

            {detail.previousReview?.notes && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs">
                <p className="font-bold text-brand-text">
                  Previous review: {detail.previousReview.reasonCodes?.[0] === 'DOCUMENT_REQUESTED' ? 'Documentation requested' : detail.previousReview.status.toLowerCase()}
                </p>
                <p className="mt-1 text-brand-muted">{detail.previousReview.notes}</p>
              </div>
            )}

            <div className="space-y-1.5 border-t border-brand-border/60 pt-3">
              <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Clinical context</h4>
              {detail.requirements.length ? (
                detail.requirements.map((item) => (
                  <p key={item.area} className={`text-xs ${item.state === 'READY' ? 'text-brand-muted' : 'text-amber-400 font-semibold'}`}>
                    {item.area.replaceAll('_', ' ')}: {item.message}
                  </p>
                ))
              ) : (
                <p className="text-xs text-brand-muted">No clinical document requirement.</p>
              )}
            </div>

            {detail.documents.length > 0 && (
              <div className="space-y-1.5 border-t border-brand-border/60 pt-3">
                <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Submitted documents</h4>
                {detail.documents.map((item) => (
                  <p key={item.id} className="text-xs text-brand-muted">
                    {item.area.replaceAll('_', ' ')} · {item.originalFileName} · {item.status.replaceAll('_', ' ')}
                  </p>
                ))}
                <p className="text-[10px] text-brand-muted">Open Clinical documents to claim and review the original file.</p>
              </div>
            )}

            {detail.availableAreas.length > 0 && (
              <label className="block text-xs font-bold text-brand-text">
                Document request area
                <select
                  value={requestArea}
                  onChange={(event) => setRequestArea(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 p-2.5 text-xs text-brand-text focus:border-brand-accent focus:outline-none"
                >
                  {detail.availableAreas.map((area) => (
                    <option key={area} value={area}>
                      {area.replaceAll('_', ' ').toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block text-xs font-bold text-brand-text">
              Review notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Enter clinical rationale or notes for this review decision..."
                className="mt-1.5 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 p-3 text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
              />
            </label>

            <p className="text-[11px] text-brand-muted leading-relaxed">
              Use the request action when the declaration or clinical context cannot be confirmed without a document. A vague condition entry must also be corrected before approval. The user stays blocked from meal planning until this profile is approved.
            </p>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <Button
                variant="primary"
                disabled={busy || blocked || notes.trim().length < 10}
                isLoading={busy}
                onClick={() => void decide('APPROVED')}
              >
                Confirm for planning
              </Button>
              <Button
                variant="secondary"
                className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                disabled={busy || !requestArea || notes.trim().length < 10}
                onClick={() => void decide('REQUEST_DOCUMENT')}
              >
                Request document
              </Button>
              <Button
                variant="danger"
                disabled={busy || notes.trim().length < 10}
                onClick={() => void decide('DECLINED')}
              >
                Needs correction
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center p-12 text-center rounded-2xl border border-dashed border-brand-border/70 bg-brand-bgAlt/20 text-brand-muted text-sm">
            Select a profile to review its declared context.
          </div>
        )}
      </div>
    </div>
  );
}
