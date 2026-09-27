'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';

type QueueItem = {
  userId: string; name: string; profileRevision: number; conditions: string[]; allergies: string[];
  needsClarification: boolean; status: string;
};
type Detail = QueueItem & {
  age: number | null; goal: string | null; dietaryPreference: string | null;
  dailyCalorieTarget: number | null; customConditions: string[]; customFoodRestrictions: string[];
  requirements: Array<{ area: string; state: string; message: string }>;
  documents: Array<{ id: string; area: string; status: string; originalFileName: string }>;
};

export default function ClinicalProfileReviewPanel() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notes, setNotes] = useState('');
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
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not open this profile.')); }
    finally { setBusy(false); }
  };
  const decide = async (decision: 'APPROVED' | 'DECLINED') => {
    if (!detail) return;
    setBusy(true); setError(null);
    try {
      await api.post(`/nutritionist/profile-reviews/${detail.userId}/decision`, { decision, notes });
      setDetail(null); setNotes('');
      await refresh();
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not save this profile review.')); }
    finally { setBusy(false); }
  };
  const blocked = detail?.needsClarification || detail?.requirements.some((item) => item.state !== 'READY');

  return <div className="m-3 overflow-y-auto rounded-2xl border border-brand-border bg-brand-surface p-5 text-brand-text">
    <div className="mb-5 flex items-center justify-between gap-3"><div><h1 className="font-display text-xl font-bold">Health profile review</h1><p className="text-sm text-brand-muted">Review declared conditions and allergies before meal candidates are prepared. Confirming this planning context does not verify a diagnosis; each restricted meal still needs its own case approval.</p></div><button type="button" onClick={() => void refresh()} className="rounded-xl border border-brand-border px-3 py-2 text-sm">Refresh</button></div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/30 p-3 text-sm text-red-400">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-[minmax(240px,360px)_1fr]">
      <div className="space-y-2">{queue.length ? queue.map((item) => <button key={item.userId} type="button" disabled={busy} onClick={() => void select(item.userId)} className={`w-full rounded-xl border p-3 text-left text-sm ${detail?.userId === item.userId ? 'border-brand-green' : 'border-brand-border'}`}><strong>{item.name}</strong><p>Conditions: {item.conditions.filter((value) => value !== 'NONE').join(', ') || 'none'} · Allergies: {item.allergies.filter((value) => value !== 'NONE').join(', ') || 'none'}</p><p className="mt-1 text-xs text-brand-muted">{item.status.replaceAll('_', ' ').toLowerCase()} · profile revision {item.profileRevision}</p></button>) : <p className="text-sm text-brand-muted">No restricted profiles are awaiting review.</p>}</div>
      {detail ? <div className="space-y-4 rounded-xl border border-brand-border p-4">
        <div><h2 className="font-bold">{detail.name}</h2><p className="text-sm text-brand-muted">Age {detail.age ?? 'not recorded'} · {detail.goal ?? 'no goal'} · {detail.dietaryPreference ?? 'no diet preference'} · {detail.dailyCalorieTarget ?? 'no target'} kcal/day</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><h3 className="text-sm font-bold">Conditions</h3><p className="text-sm">{[...detail.conditions.filter((value) => value !== 'NONE'), ...detail.customConditions].join(', ') || 'None declared'}</p></div><div><h3 className="text-sm font-bold">Allergies and food restrictions</h3><p className="text-sm">{[...detail.allergies.filter((value) => value !== 'NONE'), ...detail.customFoodRestrictions].join(', ') || 'None declared'}</p></div></div>
        {detail.needsClarification && <p className="rounded-lg border border-amber-500/40 p-3 text-sm text-amber-400">A restriction needs clarification before this profile can be approved.</p>}
        <div><h3 className="text-sm font-bold">Clinical context</h3>{detail.requirements.length ? detail.requirements.map((item) => <p key={item.area} className={`mt-1 text-sm ${item.state === 'READY' ? 'text-brand-muted' : 'text-amber-400'}`}>{item.area.replaceAll('_', ' ')}: {item.message}</p>) : <p className="text-sm text-brand-muted">No clinical document requirement.</p>}</div>
        {detail.documents.length > 0 && <div><h3 className="text-sm font-bold">Submitted documents</h3>{detail.documents.map((item) => <p key={item.id} className="text-sm text-brand-muted">{item.area.replaceAll('_', ' ')} · {item.originalFileName} · {item.status.replaceAll('_', ' ')}</p>)}<p className="mt-1 text-xs text-brand-muted">Open Clinical documents to claim and review the original file.</p></div>}
        <label className="block text-sm">Review notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg p-2" /></label>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || blocked || notes.trim().length < 10} onClick={() => void decide('APPROVED')} className="rounded-xl bg-brand-green px-4 py-2 text-sm font-bold text-[#07100d] disabled:opacity-50">Confirm for planning</button><button type="button" disabled={busy || notes.trim().length < 10} onClick={() => void decide('DECLINED')} className="rounded-xl border border-brand-border px-4 py-2 text-sm font-bold disabled:opacity-50">Needs correction</button></div>
      </div> : <p className="text-sm text-brand-muted">Select a profile to review its declared context.</p>}
    </div>
  </div>;
}
