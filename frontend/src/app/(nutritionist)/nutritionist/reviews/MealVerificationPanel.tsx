'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';

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

  return <section className="m-4 grid min-h-[70vh] gap-4 rounded-3xl border border-brand-border bg-brand-surface p-4 text-brand-text lg:grid-cols-[320px_1fr]">
    <div className="space-y-3 border-r border-brand-border pr-4">
      <h1 className="font-display text-xl font-bold">Meal verification</h1>
      <p className="text-xs text-brand-muted">Verify that a proposed recipe is a real, edible preparation. Patient health approvals and planning data are checked separately.</p>
      <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
      {queue.map((item) => <button key={`${item.kind}:${item.id}`} type="button" onClick={() => { setSelectedId(`${item.kind}:${item.id}`); setRationale(''); }} className={`block w-full rounded-xl border p-3 text-left ${selectedId === `${item.kind}:${item.id}` ? 'border-brand-green' : 'border-brand-border'}`}>
        <strong className="block text-sm">{item.name}</strong>
        <span className="text-xs text-brand-muted">{item.source.replaceAll('_', ' ')} · {item.status.toLowerCase()}</span>
        {item.claimedByOther && <span className="block text-xs text-amber-400">Being reviewed by another nutritionist</span>}
      </button>)}
      {!queue.length && <p className="text-sm text-brand-muted">No base meals await verification.</p>}
    </div>
    <div className="space-y-4 overflow-y-auto p-2">
      {error && <p role="alert" className="rounded-lg border border-red-500/40 p-3 text-sm text-red-300">{error}</p>}
      {selected ? <>
        <div><p className="text-xs uppercase text-brand-muted">{selected.mealType} · {selected.source.replaceAll('_', ' ')}</p><h2 className="font-display text-2xl font-bold">{selected.name}</h2><p className="mt-2 text-sm text-brand-muted">{selected.description || 'No description recorded.'}</p></div>
        <div className="rounded-xl border border-brand-border p-4 text-sm">{selected.calories ?? 'Unknown'} kcal · {selected.proteinG ?? 'Unknown'} g protein · {selected.carbsG ?? 'Unknown'} g carbs · {selected.fatG ?? 'Unknown'} g fat</div>
        <div><h3 className="font-bold">Recorded ingredients</h3><p className="mt-2 text-sm text-brand-muted">{ingredientText(selected.ingredients)}</p></div>
        <p className="text-xs text-amber-300">Verification confirms the base dish only. It does not certify nutrition amounts or permit use for a health condition.</p>
        {selected.claimedByMe ? <>
          <Button variant="secondary" disabled={busy} onClick={() => void act('release')}>Release claim</Button>
          <label className="block text-sm">Review rationale<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} className="mt-2 block w-full rounded-xl border border-brand-border bg-brand-bg p-3" /></label>
          <div className="flex gap-2"><Button disabled={busy || rationale.trim().length < 10} onClick={() => void act('decision', 'VERIFIED')}>Verify base meal</Button><Button variant="secondary" disabled={busy || rationale.trim().length < 10} onClick={() => void act('decision', 'REJECTED')}>Reject</Button></div>
        </> : <Button disabled={busy || selected.claimedByOther} onClick={() => void act('claim')}>Claim verification</Button>}
      </> : <p className="text-sm text-brand-muted">Choose a recipe to inspect its details.</p>}
    </div>
  </section>;
}
