'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/api-error';

const nutrients = ['SODIUM_MG', 'SUGAR_G', 'FIBER_G', 'POTASSIUM_MG', 'PHOSPHORUS_MG', 'PROTEIN_G', 'SATURATED_FAT_G', 'CARBOHYDRATE_G'];
const bases = ['PER_SERVING', 'DAILY_TOTAL', 'PERCENT_OF_DAILY_CALORIES', 'PER_1000_KCAL', 'PER_KG_BODY_WEIGHT_DAILY'];
type Limit = { id: string; condition: string; nutrient: string; operator: string; threshold: number; unit: string; basis: string;
  version: number; validFrom: string; validUntil: string | null; revokedAt: string | null; sourceTitle: string; sourceCitation: string };
type Rule = Omit<Limit, 'version' | 'validFrom' | 'validUntil' | 'revokedAt'>;
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const fieldClass = 'mt-1 w-full rounded-lg border border-brand-green/25 bg-brand-surface px-3 py-2 text-sm text-brand-text focus-visible:outline focus-visible:outline-brand-green';

export default function PatientNutritionLimits({ mealId, conditions }: { mealId: string; conditions: string[] }) {
  const [data, setData] = useState<{ limits: Limit[]; defaultRules: Rule[]; profileRevision: number } | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  const [condition, setCondition] = useState(conditions.find(c => c !== 'NONE') ?? '');
  const [nutrient, setNutrient] = useState('CARBOHYDRATE_G'), [basis, setBasis] = useState('PER_SERVING');
  const [replaces, setReplaces] = useState('');
  useEffect(() => {
    let current = true;
    api.get(`/nutritionist/patient-nutrition/${mealId}/limits`).then(response => {
      if (current) setData(response.data.data);
    }).catch(err => { if (current) setError(getApiErrorMessage(err, 'Could not load patient limits. Reopen your claimed case.')); });
    return () => { current = false; };
  }, [mealId]);
  const unit = basis === 'PERCENT_OF_DAILY_CALORIES' ? '%' : basis === 'PER_KG_BODY_WEIGHT_DAILY' ? 'g/kg' :
    basis === 'PER_1000_KCAL' ? (nutrient.endsWith('_MG') ? 'mg/1000kcal' : 'g/1000kcal') : nutrient.endsWith('_MG') ? 'mg' : 'g';
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!data || busy) return;
    const values = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const end = String(values.get('validUntil') ?? '');
      await api.post(`/nutritionist/patient-nutrition/${mealId}/limits`, {
        condition, nutrient, basis, unit, replacesRuleId: replaces || null,
        operator: values.get('operator'), threshold: Number(values.get('threshold')), severity: values.get('severity'),
        rationale: values.get('rationale'), sourceTitle: values.get('sourceTitle'), sourceCitation: values.get('sourceCitation'),
        validFrom: new Date(String(values.get('validFrom'))).toISOString(), validUntil: end ? new Date(end).toISOString() : null,
        expectedProfileRevision: data.profileRevision,
      });
      setSaved(true);
    } catch (err) { setError(getApiErrorMessage(err, 'Could not save the limit. Check its scope and dates.')); }
    finally { setBusy(false); }
  }
  if (saved) return <p role="status" className="border-t border-brand-green/20 py-5 text-sm text-brand-text">Patient limits updated. The member must acknowledge refreshed guidance; reopen the queue to claim the updated case.</p>;
  return <section aria-label="Patient-specific nutrition limits" className="border-t border-brand-green/20 py-5 text-brand-text">
    <h2 className="font-display text-lg font-semibold">Patient-specific limits</h2>
    <p className="mt-2 text-sm text-brand-muted">Apply a documented limit to this member. It changes the review context and requires new guidance acknowledgment. It does not approve a meal.</p>
    {error && <p role="alert" className="mt-3 text-sm text-brand-error">{error}</p>}
    {!data ? <p role="status" className="mt-3 text-sm text-brand-muted">Loading recorded limits…</p> : <>
      <ul className="my-4 space-y-3 text-sm" aria-label="Recorded patient limits">
        {data.limits.map(limit => <li key={limit.id} className="border-b border-brand-green/15 pb-3">
          <p className="font-semibold">{label(limit.condition)} · {label(limit.nutrient)} {limit.operator.replaceAll('_', ' ').toLowerCase()} {limit.threshold} {limit.unit} · {label(limit.basis)}</p>
          <p className="mt-1 text-brand-muted">Version {limit.version} · From {new Date(limit.validFrom).toLocaleString()} {limit.validUntil ? `until ${new Date(limit.validUntil).toLocaleString()}` : ''}{limit.revokedAt ? ' · Revoked' : ''}</p>
          <a className="underline underline-offset-2" href={limit.sourceCitation} target="_blank" rel="noopener noreferrer">{limit.sourceTitle}</a>
          {!limit.revokedAt && <form className="mt-2 flex flex-wrap gap-2" onSubmit={async event => {
            event.preventDefault(); if (busy) return;
            const reason = String(new FormData(event.currentTarget).get('reason') ?? '');
            setBusy(true); setError('');
            try { await api.post(`/nutritionist/patient-nutrition/${mealId}/limits/${limit.id}/revoke`, { reason }); setSaved(true); }
            catch (err) { setError(getApiErrorMessage(err, 'Could not revoke the limit.')); } finally { setBusy(false); }
          }}><label className="min-w-0 flex-1 text-xs">Reason to revoke<input name="reason" required minLength={10} maxLength={1000} className={fieldClass} /></label>
            <Button type="submit" variant="secondary" size="sm" disabled={busy} className="self-end">Revoke</Button></form>}
        </li>)}
        {!data.limits.length && <li className="text-brand-muted">No patient-specific limits recorded.</li>}
      </ul>
      {condition && <details><summary className="cursor-pointer text-sm font-semibold">Record a new limit</summary>
        <form onSubmit={save} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs">Condition<select className={fieldClass} value={condition} onChange={e => { setCondition(e.target.value); setReplaces(''); }}>{conditions.filter(c => c !== 'NONE').map(c => <option key={c} value={c}>{label(c)}</option>)}</select></label>
            <label className="text-xs">Nutrient<select className={fieldClass} value={nutrient} onChange={e => { setNutrient(e.target.value); setReplaces(''); }}>{nutrients.map(n => <option key={n} value={n}>{label(n)}</option>)}</select></label>
            <label className="text-xs">Calculation basis<select className={fieldClass} value={basis} onChange={e => { setBasis(e.target.value); setReplaces(''); }}>{bases.map(b => <option key={b} value={b}>{label(b)}</option>)}</select></label>
            <label className="text-xs">Replace a default<select className={fieldClass} value={replaces} onChange={e => setReplaces(e.target.value)}><option value="">Additional constraint</option>{data.defaultRules.filter(r => r.condition === condition && r.nutrient === nutrient && r.basis === basis).map(r => <option key={r.id} value={r.id}>{r.threshold} {r.unit} · {r.sourceTitle}</option>)}</select></label>
            <label className="text-xs">Comparison<select name="operator" className={fieldClass}><option value="LESS_THAN_OR_EQUAL">At most</option><option value="LESS_THAN">Less than</option><option value="GREATER_THAN_OR_EQUAL">At least</option><option value="GREATER_THAN">Greater than</option><option value="EQUAL">Exactly</option></select></label>
            <label className="text-xs">Limit ({unit})<input name="threshold" className={fieldClass} type="number" min="0" step="any" required /></label>
            <label className="text-xs">Outcome<select name="severity" className={fieldClass}><option value="FLAG">Require review</option><option value="HARD_BLOCK">Block conflicting selection</option></select></label>
            <label className="text-xs">Effective from (device time)<input name="validFrom" type="datetime-local" required className={fieldClass} /></label>
            <label className="text-xs">Effective until (optional, device time)<input name="validUntil" type="datetime-local" className={fieldClass} /></label>
            <label className="text-xs">Source title<input name="sourceTitle" required minLength={3} maxLength={240} className={fieldClass} /></label>
          </div>
          <label className="block text-xs">HTTPS source URL<input name="sourceCitation" type="url" required maxLength={1000} className={fieldClass} /></label>
          <label className="block text-xs">Clinical rationale<textarea name="rationale" minLength={10} maxLength={4000} required rows={3} className={fieldClass} /></label>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save patient limit'}</Button>
        </form>
      </details>}
    </>}
  </section>;
}
