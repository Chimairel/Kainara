'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import MealImage from '@/components/user/MealImage';
import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';
import { CheckCircle, ChefHat, Eye, RefreshCw, ShieldCheck } from 'lucide-react';

type MealCandidate = {
  kind: 'LIBRARY_MEAL' | 'RAW_RECIPE' | 'GENERATED_RECIPE';
  id: string;
  revisionKey: string;
  name: string;
  description: string | null;
  mealType: string;
  source: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  ingredients: unknown;
  status: 'PENDING' | 'REJECTED';
  claimedByMe: boolean;
  claimedByOther: boolean;
};

function ingredientText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const entry = item as Record<string, unknown>;
          return [entry.name ?? entry.ingredientName, entry.quantity, entry.unit].filter(Boolean).join(' ');
        }
        return '';
      })
      .filter(Boolean)
      .join(', ');
  }
  return 'Ingredient details are unavailable.';
}

export default function MealVerificationPanel() {
  const [queue, setQueue] = useState<MealCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/nutritionist/meal-verification');
      setQueue(response.data.data ?? []);
      setError(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Meal verification queue could not be loaded.'));
    }
  }, []);

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
      if (action === 'decision') {
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
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          isLoading={busy}
          onClick={() => void act('release')}
          className="ml-1 text-[11px] h-7 px-2.5 rounded-lg border-brand-green/30 hover:border-brand-green/50"
        >
          Release claim
        </Button>
      </div>
    ) : (
      <Button
        variant="primary"
        size="sm"
        disabled={busy || selected.claimedByOther}
        isLoading={busy}
        onClick={() => void act('claim')}
        className="rounded-xl shadow-md text-xs font-bold px-3.5 py-2"
      >
        <ChefHat className="mr-1.5 h-3.5 w-3.5" />
        Claim verification
      </Button>
    )
  ) : null;

  return (
    <section className="flex md:h-[calc(100vh-270px)] md:min-h-[640px] flex-col overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface text-left shadow-sm md:flex-row">
      {/* Master Queue List Panel */}
      <div
        className={`${selected ? 'hidden md:flex' : 'flex'} ${expanded ? '!hidden' : ''} h-full w-full min-w-0 flex-col border-brand-border/70 bg-brand-surface/75 p-5 md:w-[38%] md:min-w-[280px] md:border-r`}
      >
        <div className="shrink-0 mb-3 rounded-2xl border border-brand-border/80 bg-brand-surface/90 p-5 text-brand-text shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-green">
              Base recipe verification
            </span>
            <Badge variant="pending" className="text-[9px]">
              {queue.length} pending
            </Badge>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <h2 className="font-display text-lg font-black tracking-tight text-brand-text">
              Meal verification
            </h2>
            <button
              type="button"
              onClick={() => void load()}
              disabled={busy}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-border/60 bg-brand-bgAlt/60 text-brand-muted transition hover:border-brand-green/30 hover:bg-brand-green/10 hover:text-brand-green outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:opacity-50"
              title="Refresh queue"
              aria-label="Refresh queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-brand-muted">
            Verify proposed recipes are real, edible preparations. Patient health approvals and planning data are checked separately.
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
                No base meals await verification in this queue.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {queue.map((item) => {
              const isSelected = selectedId === `${item.kind}:${item.id}`;
              return (
                <button
                  key={`${item.kind}:${item.id}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedId(`${item.kind}:${item.id}`);
                    setRationale('');
                    setExpanded(false);
                  }}
                  className={`w-full rounded-2xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-brand-green/40 cursor-pointer ${
                    isSelected
                      ? 'border-brand-green/40 bg-brand-green/[0.08] shadow-md'
                      : 'border-brand-border/70 bg-brand-surface hover:-translate-y-0.5 hover:border-brand-green/25'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold text-brand-green">{item.mealType}</span>
                    <Badge variant="pending" className="text-xs">
                      {item.status.toLowerCase()}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-brand-text truncate mb-1">{item.name}</h3>
                  <div className="mb-2 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wide">
                    <span className="rounded-md border border-brand-border px-2 py-1 text-brand-muted">
                      {item.source.replaceAll('_', ' ')}
                    </span>
                    {item.calories !== null && (
                      <span className="rounded-md border border-brand-green/25 bg-brand-green/10 px-2 py-1 text-brand-green">
                        {item.calories} kcal
                      </span>
                    )}
                  </div>
                  {item.claimedByOther && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-[#8c3b00] dark:text-[#ff8a3d] font-bold">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Being reviewed by another nutritionist</span>
                    </div>
                  )}
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
        canExpand={Boolean(selected)}
        headerLeft={claimHeader}
        onBack={() => {
          setSelectedId(null);
          setRationale('');
          setExpanded(false);
        }}
        className={`${selected ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent`}
      >

        {!selected ? (
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
                  Inspect proposed recipes to verify kitchen preparation feasibility, macro estimates, and clean ingredient formulations before dishes enter the verified library.
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
        ) : (
          <div className="space-y-6">
            {error && (
              <div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-400">
                {error}
              </div>
            )}



            {selected.claimedByMe && (
              <div className="flex items-center gap-2.5 rounded-xl border border-brand-green/20 bg-brand-green/10 p-3 text-xs text-brand-green">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>
                  30-minute exclusive verification lock active. Submit before expiry to prevent automatic release.
                </span>
              </div>
            )}

            {/* Recipe Header & Details */}
            <div className="space-y-4 rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border pb-3">
                <span className="inline-block rounded-full bg-brand-accent/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-accent">
                  {selected.mealType} · {selected.source.replaceAll('_', ' ')}
                </span>
                <Badge variant={selected.status === 'PENDING' ? 'pending' : 'rejected'} className="text-[10px]">
                  {selected.status}
                </Badge>
              </div>
              <div>
                <h2 className="font-display text-2xl font-black tracking-tight text-brand-text">{selected.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                  {selected.description || 'No description recorded.'}
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-brand-border/60">
                <MealImage
                  mealName={selected.name}
                  mealType={selected.mealType}
                  variant="card"
                  className="h-44 w-full sm:h-52"
                  showAttributionLinks
                />
              </div>

              {/* Nutritional Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Calories</span>
                  <p className="text-base font-black text-brand-text mt-0.5">
                    {selected.calories ?? '—'} <span className="text-xs font-normal text-brand-muted">kcal</span>
                  </p>
                </div>
                <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Protein</span>
                  <p className="text-base font-black text-brand-text mt-0.5">
                    {selected.proteinG ?? '—'} <span className="text-xs font-normal text-brand-muted">g</span>
                  </p>
                </div>
                <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Carbs</span>
                  <p className="text-base font-black text-brand-text mt-0.5">
                    {selected.carbsG ?? '—'} <span className="text-xs font-normal text-brand-muted">g</span>
                  </p>
                </div>
                <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Fat</span>
                  <p className="text-base font-black text-brand-text mt-0.5">
                    {selected.fatG ?? '—'} <span className="text-xs font-normal text-brand-muted">g</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Recorded Ingredients */}
            <div className="rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card space-y-2">
              <h3 className="font-display text-sm font-bold text-brand-text">Recorded ingredients</h3>
              <p className="text-xs text-brand-muted leading-relaxed">{ingredientText(selected.ingredients)}</p>
            </div>

            <div className="rounded-xl border border-[#a64600]/30 bg-[#8c3b00]/10 p-3.5 text-xs text-[#8c3b00] dark:text-[#ff8a3d] font-semibold leading-relaxed">
              Verification confirms the base dish only. It does not certify nutrition amounts or permit use for a health condition.
            </div>

            {/* Decision Section */}
            {selected.claimedByMe && (
              <div className="rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card space-y-4">
                <label className="block text-xs font-bold text-brand-text">
                  Review rationale
                  <textarea
                    value={rationale}
                    onChange={(event) => setRationale(event.target.value)}
                    rows={3}
                    placeholder="Document clinical observations or verification notes (at least 10 characters)..."
                    className="mt-2 block w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 p-3 text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  />
                </label>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <Button
                    variant="primary"
                    disabled={busy || rationale.trim().length < 10}
                    isLoading={busy}
                    onClick={() => void act('decision', 'VERIFIED')}
                  >
                    Verify base meal
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy || rationale.trim().length < 10}
                    onClick={() => void act('decision', 'REJECTED')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </ExpandableCasePanel>
    </section>
  );
}
