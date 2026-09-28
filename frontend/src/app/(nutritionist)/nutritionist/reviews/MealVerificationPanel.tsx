'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import MealImage from '@/components/user/MealImage';

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
  if (Array.isArray(value)) return value.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      const entry = item as Record<string, unknown>;
      return [entry.name ?? entry.ingredientName, entry.quantity, entry.unit].filter(Boolean).join(' ');
    }
    return '';
  }).filter(Boolean).join(', ');
  return 'Ingredient details are unavailable.';
}

export default function MealVerificationPanel() {
  const [queue, setQueue] = useState<MealCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await api.get('/nutritionist/meal-verification');
      setQueue(response.data.data ?? []);
      setError(null);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Meal verification queue could not be loaded.')); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const selected = queue.find((item) => `${item.kind}:${item.id}` === selectedId);
  const act = async (action: 'claim' | 'release' | 'decision', decision?: 'VERIFIED' | 'REJECTED') => {
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      await api.post(`/nutritionist/meal-verification/${selected.kind}/${selected.id}/${action}`,
        action === 'decision' ? { decision, rationale } : {});
      if (action === 'decision') { setSelectedId(null); setRationale(''); }
      await load();
    } catch (cause) { setError(getApiErrorMessage(cause, 'The review could not be saved. Refresh and try again.')); }
    finally { setBusy(false); }
  };

  return (
    <section className="grid min-h-[640px] gap-6 rounded-3xl border border-brand-border/70 bg-brand-surface p-6 text-brand-text shadow-card-lg backdrop-blur-xl lg:grid-cols-[340px_1fr]">
      <div className="space-y-3.5 border-r border-brand-border/70 pr-5">
        <div className="rounded-2xl border border-brand-border/80 bg-brand-surface/90 p-4 text-brand-text shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-black tracking-tight text-brand-text">Meal verification</h2>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-brand-muted">
            Verify proposed recipes are real, edible preparations. Patient health approvals and planning data are checked separately.
          </p>
        </div>

        <div className="space-y-2.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 custom-scrollbar">
          {queue.map((item) => {
            const isSelected = selectedId === `${item.kind}:${item.id}`;
            return (
              <button
                key={`${item.kind}:${item.id}`}
                type="button"
                onClick={() => {
                  setSelectedId(`${item.kind}:${item.id}`);
                  setRationale('');
                }}
                className={`group relative block w-full rounded-2xl border p-4 text-left outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-brand-green ${
                  isSelected
                    ? 'border-brand-accent/70 bg-brand-accent/10 shadow-sm'
                    : 'border-brand-border/70 bg-brand-surface hover:border-brand-accent/30'
                }`}
              >
                <strong className="block font-display text-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors">
                  {item.name}
                </strong>
                <span className="mt-1 block text-xs text-brand-muted">
                  {item.source.replaceAll('_', ' ')} · {item.status.toLowerCase()}
                </span>
                {item.claimedByOther && (
                  <span className="mt-1.5 block text-xs font-semibold text-amber-400">
                    Being reviewed by another nutritionist
                  </span>
                )}
              </button>
            );
          })}
          {!queue.length && (
            <div className="p-8 text-center rounded-2xl border border-dashed border-brand-border/80 bg-brand-surface/40 text-xs text-brand-muted">
              No base meals await verification.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 overflow-y-auto p-2 custom-scrollbar">
        {error && (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}
        {selected ? (
          <div className="space-y-5">
            <div>
              <span className="inline-block rounded-full bg-brand-accent/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-accent">
                {selected.mealType} · {selected.source.replaceAll('_', ' ')}
              </span>
              <h2 className="mt-2 font-display text-2xl font-black tracking-tight text-brand-text">{selected.name}</h2>
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

            <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 text-sm font-display font-bold flex flex-wrap gap-4 text-brand-text">
              <span>{selected.calories ?? 'Unknown'} kcal</span>
              <span className="text-brand-muted font-normal">·</span>
              <span>{selected.proteinG ?? 'Unknown'} g protein</span>
              <span className="text-brand-muted font-normal">·</span>
              <span>{selected.carbsG ?? 'Unknown'} g carbs</span>
              <span className="text-brand-muted font-normal">·</span>
              <span>{selected.fatG ?? 'Unknown'} g fat</span>
            </div>

            <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-5 space-y-2">
              <h3 className="font-display text-sm font-bold text-brand-text">Recorded ingredients</h3>
              <p className="text-xs text-brand-muted leading-relaxed">{ingredientText(selected.ingredients)}</p>
            </div>

            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-500 font-semibold leading-relaxed">
              Verification confirms the base dish only. It does not certify nutrition amounts or permit use for a health condition.
            </div>

            {selected.claimedByMe ? (
              <div className="space-y-4 pt-2 border-t border-brand-border/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-green">Claim active</span>
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => void act('release')}>
                    Release claim
                  </Button>
                </div>
                <label className="block text-sm font-semibold text-brand-text">
                  Review rationale
                  <textarea
                    value={rationale}
                    onChange={(event) => setRationale(event.target.value)}
                    rows={3}
                    placeholder="Document clinical observations or verification notes (at least 10 characters)..."
                    className="mt-2 block w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 p-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  />
                </label>
                <div className="flex flex-wrap gap-2.5">
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
            ) : (
              <Button
                variant="primary"
                disabled={busy || selected.claimedByOther}
                isLoading={busy}
                onClick={() => void act('claim')}
              >
                Claim verification
              </Button>
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center p-12 text-center rounded-2xl border border-dashed border-brand-border/70 bg-brand-bgAlt/20 text-brand-muted text-sm">
            Choose a recipe to inspect its details.
          </div>
        )}
      </div>
    </section>
  );
}
