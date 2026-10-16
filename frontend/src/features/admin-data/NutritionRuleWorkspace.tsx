'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/api-error';

type Source = { id: string; code: string; title: string; canonicalUrl: string };
type Policy = { id: string; condition: string; policyVersion: string; state: string; impactReport: unknown; approvals: { decision: string }[] };
const inputClass = 'w-full rounded-lg border border-brand-green/25 bg-brand-surface px-3 py-2 text-sm text-brand-text focus-visible:outline focus-visible:outline-brand-green';
export default function NutritionRuleWorkspace({ role }: { role: 'admin' | 'nutritionist' }) {
  const [sources, setSources] = useState<Source[]>([]), [policies, setPolicies] = useState<Policy[]>([]);
  const [draft, setDraft] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), [reason, setReason] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [detail, setDetail] = useState<{ id: string; content: string } | null>(null);
  const base = `/${role}/nutrition-rules`;
  const load = useCallback(async () => {
    const response = await api.get(base); setSources(response.data.data.sources); setPolicies(response.data.data.policies); setLoaded(true);
  }, [base]);
  useEffect(() => { let current = true; api.get(base).then(response => {
    if (current) { setSources(response.data.data.sources); setPolicies(response.data.data.policies); setLoaded(true); }
  }).catch(err => { if (current) setError(getApiErrorMessage(err, 'Could not load screening policies.')); }); return () => { current = false; }; }, [base]);
  const perform = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await action(); await load(); setNotice(success); }
    catch (err) { setError(getApiErrorMessage(err, 'The action could not be completed.')); }
    finally { setBusy(false); }
  };
  return <section aria-label="Nutrition screening policies" className="space-y-6 text-brand-text">
    <div><h2 className="font-display text-xl font-semibold">Nutrition screening policies</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">Versioned limits and ingredient checks. Drafts do not affect planning. Activation requires a recorded impact check and the existing independent nutritionist approvals. Passing a rule does not establish medical suitability.</p></div>
    {error && <p role="alert" className="text-sm text-brand-error">{error}</p>}
    {notice && <p role="status" className="text-sm text-brand-green">{notice}</p>}
    {!loaded && !error && <p role="status" className="text-sm text-brand-muted">Loading screening policies…</p>}
    <details><summary className="cursor-pointer text-sm font-semibold">Registered current sources ({sources.length})</summary>
      <ul className="mt-3 space-y-3 text-sm">{sources.map(source => <li key={source.id}>
        <a href={source.canonicalUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{source.title}</a>
        <p className="mt-1 break-all font-mono text-xs text-brand-muted">Source ID: {source.id}</p>
      </li>)}</ul>
    </details>
    <div className="space-y-4 border-y border-brand-green/20 py-5">
      <h3 className="font-semibold">Create a new draft version</h3>
      <Button variant="secondary" size="sm" disabled={busy || !sources.length} onClick={() => setDraft(JSON.stringify({
        condition: 'HYPERTENSION', ingredientRules: [], nutrientRules: [{ nutrient: 'SODIUM_MG', operator: 'LESS_THAN_OR_EQUAL',
          threshold: null, unit: 'mg', basis: 'DAILY_TOTAL', severity: 'FLAG', evidenceSourceId: sources[0].id,
          evidenceLocator: '', applicablePopulation: '', requiredInputs: { completeDailyTotal: true },
          exclusionsAndCaveats: '', rationale: '', evaluationScope: 'DAY' }],
      }, null, 2))}>Load draft template</Button>
      <p className="text-sm text-brand-muted">Include condition, nutrientRules and ingredientRules. Each rule needs a registered evidenceSourceId, evidenceLocator, applicablePopulation, requiredInputs, exclusionsAndCaveats, rationale, severity and evaluationScope. Nutrient rules also need nutrient, operator, threshold, unit and basis; ingredient rules need ingredientCategory and matchingTerms.</p>
      <label className="block text-sm">Policy JSON<textarea value={draft} onChange={event => { setDraft(event.target.value); setNotice(''); }} rows={12} spellCheck={false} className={`${inputClass} mt-2 font-mono text-xs`} /></label>
      <Button disabled={busy || !draft.trim()} onClick={() => void perform(async () => { const parsed: unknown = JSON.parse(draft); await api.post(base, parsed); }, 'Draft saved. It remains inactive until reviewed.')}>Save inactive draft</Button>
    </div>
    {role === 'nutritionist' && <label className="block max-w-3xl text-sm">Review rationale<textarea className={`${inputClass} mt-2`} rows={2} value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={1000} /></label>}
    <ul className="divide-y divide-brand-green/20" aria-label="Policy versions">{policies.map(policy => <li key={policy.id} className="space-y-3 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">{policy.condition.replaceAll('_', ' ')}</h3><span className="text-xs text-brand-muted">{policy.state} · {policy.approvals.length} recorded decisions</span></div>
      <p className="break-all font-mono text-xs text-brand-muted">{policy.policyVersion}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void perform(async () => {
          const response = await api.get(`${base}/${policy.id}`); setDetail({ id: policy.id, content: JSON.stringify(response.data.data, null, 2) });
        }, '')}>Inspect rules</Button>
        {role === 'nutritionist' && (policy.state === 'DRAFT' ? ['impact', 'approve', 'decline'] : policy.state === 'ACTIVE' ? ['suspend'] : []).map(action => <Button key={action} size="sm" variant="secondary" disabled={busy || reason.trim().length < 10 || action === 'approve' && !policy.impactReport} onClick={() => void perform(() => api.post(`${base}/${policy.id}/${action}`, { reason }), action === 'approve' ? 'Decision recorded. Activation follows the existing policy approval requirements.' : 'Policy action recorded.')}>
          {{ impact: 'Run impact check', approve: 'Approve version', decline: 'Decline version', suspend: 'Suspend version' }[action]}
        </Button>)}
      </div>
      {detail?.id === policy.id && <pre tabIndex={0} className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-brand-bg p-4 text-xs">{detail.content}</pre>}
    </li>)}</ul>
    {loaded && !policies.length && <p className="text-sm text-brand-muted">No screening policy versions recorded.</p>}
  </section>;
}
