'use client';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import ReviewDecisionPage from '@/features/nutritionist-reviews/ReviewDecisionPage';
import CanvasToolButton from '@/features/nutritionist-reviews/CanvasToolButton';
import Button from '@/components/ui/Button';
import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';
import BaseMealEvidenceSheets from '@/features/nutritionist-reviews/BaseMealEvidenceSheets';
import RndQueueDocument from '@/features/nutritionist-reviews/RndQueueDocument';
import MealVerificationQueue, { type MealCandidate } from '@/features/nutritionist-reviews/MealVerificationQueue';
import { ChefHat, ShieldCheck, Check, X, LogOut } from '@/components/ui/icons';
import { useAuth } from '@/hooks/useAuth';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

export default function MealVerificationPanel() {
  const ownerId = useAuth().user?.userId;
  const cachedQueue = readSessionResource<MealCandidate[]>(ownerId, 'nutritionist-meal-verification-queue', 30_000);
  const [queue, setQueue] = useState<MealCandidate[]>(cachedQueue ?? []);
  const [isLoading, setIsLoading] = useState(!cachedQueue);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'approve' | 'reject' | null>(null);
  useEffect(() => setDecisionAction(null), [selectedId]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await api.get('/nutritionist/meal-verification', signal ? { signal } : undefined);
        if (signal?.aborted) return;
        const next = response.data.data ?? [];
        setQueue(next);
        writeSessionResource(ownerId, 'nutritionist-meal-verification-queue', next);
        setError(null);
      } catch (cause) {
        if (!signal?.aborted) setError(getApiErrorMessage(cause, 'Meal verification queue could not be loaded.'));
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId]
  );

  useVisiblePolling(
    async (signal) => {
      await load(signal);
    },
    { enabled: !busy, immediate: false, scopeKey: ownerId }
  );
  useEffect(() => {
    void load();
  }, [load]);

  const selected = queue.find((item) => `${item.kind}:${item.id}` === selectedId);

  const act = async (action: 'claim' | 'release' | 'decision', decision?: 'VERIFIED' | 'REJECTED') => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/nutritionist/meal-verification/${selected.kind}/${selected.id}/${action}`,
        action === 'decision' ? { decision, rationale } : {}
      );
      if (action === 'decision' || action === 'release') {
        setDecisionAction(null);
        setSelectedId(null);
        setExpanded(false);
        setRationale('');
      }
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'The review could not be saved. Refresh and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const claimHeader = selected ? (
    selected.claimedByMe ? (
      <div className="flex items-center gap-2 rounded-xl border border-brand-green/35 bg-brand-surface/95 px-3 py-1.5 text-xs text-brand-green shadow-md backdrop-blur-md">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-green" />
        <span className="font-semibold text-xs text-brand-text">Claim active</span>
        <CanvasToolButton aria-label="Release claim" title="Release claim"
          disabled={busy}
          onClick={() => void act('release')}
        >
          <LogOut aria-hidden="true" className="h-5 w-5" />
        </CanvasToolButton>
      </div>
    ) : (
      <Button size="sm" aria-label={selected.authoredByMe ? 'Independent reviewer required' : 'Claim verification'}
        title={selected.authoredByMe ? 'Independent reviewer required' : 'Claim verification'}
        disabled={busy || selected.claimedByOther || selected.authoredByMe}
        onClick={() => void act('claim')}
      >
        <ChefHat aria-hidden="true" className="mr-2 h-4 w-4" />
        {selected.authoredByMe ? 'Independent reviewer required' : 'Claim verification'}
      </Button>
    )
  ) : null;

  return (
    <section className="flex md:h-[calc(100vh-270px)] md:min-h-[640px] flex-col overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface text-left shadow-sm md:flex-row">
      <MealVerificationQueue
        queue={queue}
        selectedId={selectedId}
        expanded={expanded}
        busy={busy}
        isLoading={isLoading}
        error={error}
        onRetry={() => void load()}
        onSelect={(id) => {
          setSelectedId(id);
          setRationale('');
          setExpanded(false);
        }}
      />

      {/* Details View Panel */}
      <div
        className={`${selected ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col overflow-y-auto p-3 custom-scrollbar sm:p-4`}
      >
        {!selected ? (
          <ExpandableCasePanel
            expanded={expanded}
            onExpandedChange={setExpanded}
            canExpand={false}
            headerLeft={claimHeader}
            onBack={() => {
              setSelectedId(null);
              setRationale('');
              setExpanded(false);
            }}
            className={`${selected ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent`}
          >
            <div className="space-y-6 py-2">
              <div className="rounded-3xl border border-brand-border/80 bg-brand-surface/90 p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent">
                  <ChefHat className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-black tracking-tight text-brand-text">
                    A clear path to meal verification
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                    Inspect proposed recipes to verify kitchen preparation feasibility, macro estimates, and clean
                    ingredient formulations before dishes enter the verified library.
                  </p>
                </div>
                <div className="grid gap-3 pt-2">
                  {[
                    {
                      step: '01',
                      title: 'Inspect an available dish',
                      desc: 'Preview preparation instructions, estimated calories and macros, and parsed ingredient quantities.',
                    },
                    {
                      step: '02',
                      title: 'Claim verification review',
                      desc: 'Secure exclusive evaluation lock when you are ready to evaluate ingredients and culinary safety.',
                    },
                    {
                      step: '03',
                      title: 'Verify or reject with clinical notes',
                      desc: 'Confirm the base dish for clinical library usage or reject with specific corrective instructions.',
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
          </ExpandableCasePanel>
        ) : (
          <div className="space-y-4">
            <RndQueueDocument
              key={selectedId}
              title={`Meal verification · ${selected.name}`}
              contentKey={`${selected.kind}:${selected.id}:${selected.revisionKey}`}
              expanded={expanded}
              onExpandedChange={setExpanded}
              onBack={() => {
                setSelectedId(null);
                setRationale('');
              }}
              actions={claimHeader}
              hideDecisionDock
              focusSheet={decisionAction ? { title: decisionAction === 'approve' ? 'Verification rationale' : 'Rejection rationale', request: decisionAction === 'approve' ? 1 : 2 } : undefined}
              tools={
                selected ? (
                  <>
                    <div role="toolbar" aria-label="Meal review actions" className="flex items-center gap-2">
                      <CanvasToolButton aria-label="Approve" title="Verify base meal" aria-pressed={decisionAction === 'approve'} disabled={busy || !selected.claimedByMe} onClick={() => setDecisionAction('approve')}>
                        <Check aria-hidden="true" className="h-5 w-5" />
                      </CanvasToolButton>
                      <CanvasToolButton aria-label="Reject" title="Reject base meal" aria-pressed={decisionAction === 'reject'} className="text-red-700 dark:text-red-400" disabled={busy || !selected.claimedByMe} onClick={() => setDecisionAction('reject')}>
                        <X aria-hidden="true" className="h-5 w-5" />
                      </CanvasToolButton>
                    </div>
                  </>
                ) : undefined
              }
            >
              {BaseMealEvidenceSheets({ selected, error })}
              {decisionAction && selected.claimedByMe && <ReviewDecisionPage action={decisionAction}
                title={decisionAction === 'approve' ? 'Verification rationale' : 'Rejection rationale'} page={3}
                onClose={() => setDecisionAction(null)} busy={busy} error={error} note={rationale}
                onNoteChange={setRationale} required approvalLabel="Verify base meal"
                onConfirm={() => void act('decision', decisionAction === 'reject' ? 'REJECTED' : 'VERIFIED')} />}
            </RndQueueDocument>
          </div>
        )}
      </div>
    </section>
  );
}
