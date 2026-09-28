'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';
import { CheckCircle, RefreshCw, UserCheck } from 'lucide-react';

type QueueItem = {
  userId: string;
  name: string;
  profileRevision: number;
  conditions: string[];
  allergies: string[];
  needsClarification: boolean;
  status: string;
};

type Detail = QueueItem & {
  age: number | null;
  goal: string | null;
  dietaryPreference: string | null;
  dailyCalorieTarget: number | null;
  customConditions: string[];
  customFoodRestrictions: string[];
  requirements: Array<{ area: string; state: string; message: string }>;
  documents: Array<{ id: string; area: string; status: string; originalFileName: string }>;
  availableAreas: string[];
  previousReview: null | { status: string; reasonCodes: string[]; notes: string | null };
  nutritionGuidance: null | {
    version: number;
    generatedAt: string;
    acknowledgedAt: string | null;
    isCurrent: boolean;
    summary: string;
    referenceItems: Array<{
      heading: string;
      value: string;
      explanation: string;
      sourceTitle: string;
      sourceUrl: string;
    }>;
  };
};

export default function ClinicalProfileReviewPanel() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const [requestArea, setRequestArea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/nutritionist/profile-reviews');
      setQueue(response.data.data ?? []);
      setError(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'The profile queue could not be loaded.'));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = async (userId: string) => {
    setBusy(true);
    setError(null);
    setExpanded(false);
    try {
      const response = await api.get(`/nutritionist/profile-reviews/${userId}`);
      setDetail(response.data.data);
      setNotes('');
      setRequestArea(response.data.data.availableAreas?.[0] ?? '');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not open this profile.'));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'APPROVED' | 'DECLINED' | 'REQUEST_DOCUMENT') => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/nutritionist/profile-reviews/${detail.userId}/decision`, {
        decision,
        notes,
        ...(decision === 'REQUEST_DOCUMENT' ? { area: requestArea } : {}),
      });
      setDetail(null);
      setExpanded(false);
      setNotes('');
      await refresh();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not save this profile review.'));
    } finally {
      setBusy(false);
    }
  };

  const blocked = detail?.needsClarification || detail?.requirements.some((item) => item.state !== 'READY');

  return (
    <div className="flex md:h-[calc(100vh-270px)] md:min-h-[640px] flex-col overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface text-left shadow-sm md:flex-row">
      {/* Master Queue List Panel */}
      <div
        className={`${detail ? 'hidden md:flex' : 'flex'} ${expanded ? '!hidden' : ''} h-full w-full min-w-0 flex-col border-brand-border/70 bg-brand-surface/75 p-5 md:w-[38%] md:min-w-[280px] md:border-r`}
      >
        <div className="shrink-0 mb-3 rounded-2xl border border-brand-border/80 bg-brand-surface/90 p-5 text-brand-text shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-green">
              Clinical profile queue
            </span>
            <Badge variant="pending" className="text-[9px]">
              {queue.length} pending
            </Badge>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <h2 className="font-display text-lg font-black tracking-tight text-brand-text">
              Profile reviews
            </h2>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={busy}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-border/60 bg-brand-bgAlt/60 text-brand-muted transition hover:border-brand-green/30 hover:bg-brand-green/10 hover:text-brand-green outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:opacity-50"
              title="Refresh queue"
              aria-label="Refresh queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-brand-muted">
            Review declared conditions and allergies before meal candidates are prepared.
          </p>
        </div>

        {!queue.length ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 rounded-2xl border border-dashed border-brand-border/80 bg-brand-surface/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green shadow-inner">
              <CheckCircle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="space-y-1">
              <p className="font-display text-sm font-extrabold text-brand-text">Queue clear</p>
              <p className="text-xs text-brand-muted max-w-xs leading-relaxed">
                No restricted profiles are awaiting review.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {queue.map((item) => {
              const isSelected = detail?.userId === item.userId;
              const conds = item.conditions.filter((value) => value !== 'NONE');
              const allgs = item.allergies.filter((value) => value !== 'NONE');
              return (
                <button
                  key={item.userId}
                  type="button"
                  disabled={busy}
                  onClick={() => void select(item.userId)}
                  className={`w-full rounded-2xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-brand-green/40 cursor-pointer ${
                    isSelected
                      ? 'border-brand-green/40 bg-brand-green/[0.08] shadow-md'
                      : 'border-brand-border/70 bg-brand-surface hover:-translate-y-0.5 hover:border-brand-green/25'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold text-brand-green">{item.name}</span>
                    <Badge variant="pending" className="text-xs">
                      {item.status.replaceAll('_', ' ').toLowerCase()}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-brand-muted line-clamp-2">
                    Conditions: {conds.join(', ') || 'none'} · Allergies: {allgs.join(', ') || 'none'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wide">
                    <span className="rounded-md border border-brand-border px-2 py-0.5 font-mono text-brand-muted">
                      Revision {item.profileRevision}
                    </span>
                    {item.needsClarification && (
                      <span className="rounded-md border border-[#a64600]/30 bg-[#8c3b00] px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                        Needs clarification
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Details View Panel */}
      <ExpandableCasePanel
        expanded={expanded}
        onExpandedChange={setExpanded}
        canExpand={detail !== null}
        onBack={() => {
          setDetail(null);
          setExpanded(false);
        }}
        className={`${detail ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent`}
      >

        {!detail ? (
          <div className="space-y-6 py-2">
            <div className="rounded-3xl border border-brand-border/80 bg-brand-surface/90 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent">
                <UserCheck className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-black tracking-tight text-brand-text">
                  A clear path to profile review
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                  Review declared health conditions, allergies, and clinical guidance before users generate clinical meal plans.
                </p>
              </div>
              <div className="grid gap-3 pt-2">
                {[
                  {
                    step: '01',
                    title: 'Inspect declared conditions',
                    desc: 'Check patient medical history, allergies, custom restrictions, and nutrition report guidance.',
                  },
                  {
                    step: '02',
                    title: 'Evaluate clinical requirements',
                    desc: 'Verify whether self-reported declarations match safe planning thresholds or require supporting documents.',
                  },
                  {
                    step: '03',
                    title: 'Confirm or request documentation',
                    desc: 'Confirm the profile for meal planning, request clinical documentation, or mark as needing correction.',
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="flex items-start gap-3.5 rounded-2xl border border-brand-border/60 bg-brand-bgAlt/50 p-4 transition-colors hover:border-brand-accent/30"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent/15 font-mono text-xs font-black text-brand-accent">
                      {item.step}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-bold text-brand-text">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* User Profile Header Card */}
            <div className="space-y-4 rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card">
              <div className="flex items-center gap-3.5 border-b border-brand-border pb-3">
                <Avatar name={detail.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                    User Health Profile
                  </h2>
                  <h3 className="truncate text-base font-extrabold text-brand-text mt-0.5">{detail.name}</h3>
                  <p className="text-xs text-brand-muted">
                    Age {detail.age ?? 'not recorded'} · {detail.goal ?? 'no goal'} · {detail.dietaryPreference ?? 'no diet preference'} · {detail.dailyCalorieTarget ?? 'no target'} kcal/day
                  </p>
                </div>
              </div>

              {/* Conditions & Allergies */}
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
            </div>

            {/* Nutrition Guidance Section */}
            <section className="rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card space-y-3" aria-label="Nutrition guidance">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-brand-text">Nutrition guidance</h4>
                {detail.nutritionGuidance && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                      detail.nutritionGuidance.isCurrent
                        ? 'border-brand-green text-brand-green bg-brand-green/10'
                        : 'border-[#a64600]/40 text-white bg-[#8c3b00] shadow-xs'
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

            {/* Clinical Requirements */}
            <div className="rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card space-y-3">
              <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Clinical context</h4>
              {detail.requirements.length ? (
                <div className="space-y-2">
                  {detail.requirements.map((item) => (
                    <div
                      key={item.area}
                      className="flex items-center justify-between gap-3 rounded-xl border border-brand-border/60 bg-brand-bgAlt/30 p-3 text-xs"
                    >
                      <span className="font-bold text-brand-text">{item.area.replaceAll('_', ' ')}</span>
                      <span className={item.state === 'READY' ? 'text-brand-muted font-medium' : 'text-amber-400 font-semibold'}>
                        {item.message}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-muted">No clinical document requirement.</p>
              )}
            </div>

            {detail.documents.length > 0 && (
              <div className="rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card space-y-2">
                <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Submitted documents</h4>
                {detail.documents.map((item) => (
                  <p key={item.id} className="text-xs text-brand-muted">
                    {item.area.replaceAll('_', ' ')} · {item.originalFileName} · {item.status.replaceAll('_', ' ')}
                  </p>
                ))}
                <p className="text-[10px] text-brand-muted">Open Clinical documents to claim and review the original file.</p>
              </div>
            )}

            {/* Decision Controls */}
            <div className="rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card space-y-4">
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
                  aria-label="Review notes"
                  placeholder="Enter clinical rationale or notes for this review decision..."
                  className="mt-1.5 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 p-3 text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
                />
              </label>

              <p className="text-[11px] text-brand-muted leading-relaxed">
                Use the request action when the declaration or clinical context cannot be confirmed without a document. A vague condition entry must also be corrected before approval. The user stays blocked from meal planning until this profile is approved.
              </p>

              <div className="flex flex-wrap gap-2.5 pt-1">
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
          </div>
        )}
      </ExpandableCasePanel>
    </div>
  );
}
