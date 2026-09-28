'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';

type QueueItem = {
  id: string; area: string; documentType: string; status: string; originalFileName: string;
  createdAt: string; factCount: number; user: { name: string; conditions: string[] };
  claimStatus: { active: boolean; claimedByName: string | null };
};
type Fact = { id: string; code: string; valueText: string | null; valueNumber: number | null; unit: string | null; reviewStatus: string };
type Detail = QueueItem & { facts: Fact[]; user: QueueItem['user'] & { allergies: string[]; contexts: Array<{ area: string; responses: Record<string, unknown> }> } };
const factCodes: Record<string, string[]> = {
  KIDNEY_DISEASE: ['CKD_STAGE', 'EGFR'],
  HEART_CONDITION: ['HEART_DIAGNOSIS'],
  DIABETES: ['DIABETES_MEDICATION'],
};

export default function ClinicalEvidenceReviewPanel() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<'SUFFICIENT' | 'NEEDS_CLARIFICATION' | 'UNUSABLE'>('NEEDS_CLARIFICATION');
  const [rationale, setRationale] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [confirmedFactIds, setConfirmedFactIds] = useState<string[]>([]);
  const [factCode, setFactCode] = useState('');
  const [factValue, setFactValue] = useState('');
  const [confirmedFacts, setConfirmedFacts] = useState<Array<{ code: string; valueText: string }>>([]);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/nutritionist/clinical-evidence');
      setQueue(response.data.data);
    } catch (cause) { setError(getApiErrorMessage(cause, 'The clinical queue could not be loaded.')); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const claim = async (id: string) => {
    setBusy(true); setError(null);
    try {
      const response = await api.get(`/nutritionist/clinical-evidence/${id}`);
      setDetail(response.data.data);
      setConfirmedFactIds([]); setConfirmedFacts([]); setRationale(''); setValidUntil('');
      setFactCode(factCodes[response.data.data.area]?.[0] ?? 'OTHER');
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not claim this document.')); }
    finally { setBusy(false); }
  };

  const download = async () => {
    if (!detail) return;
    setError(null);
    try {
      const response = await api.get(`/nutritionist/clinical-evidence/${detail.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = detail.originalFileName; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not open the claimed document.')); }
  };

  const submit = async () => {
    if (!detail) return;
    setBusy(true); setError(null);
    try {
      await api.patch(`/nutritionist/clinical-evidence/${detail.id}`, {
        decision, rationale, validUntil: decision === 'SUFFICIENT' ? validUntil : null,
        confirmedFactIds, unclearFactIds: [], confirmedFacts,
      });
      setDetail(null);
      await refresh();
    } catch (cause) { setError(getApiErrorMessage(cause, 'The clinical review could not be saved.')); }
    finally { setBusy(false); }
  };

  return (
    <div className="overflow-y-auto rounded-3xl border border-brand-border/70 bg-brand-surface p-6 text-brand-text shadow-card-lg backdrop-blur-xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-black text-brand-text">Clinical document review</h2>
          <p className="mt-1 text-xs text-brand-muted max-w-2xl leading-relaxed">
            Check the original record and confirm only facts relevant to nutrition planning. Sufficiency is not diagnosis or document authentication.
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
                key={item.id}
                type="button"
                disabled={busy}
                onClick={() => void claim(item.id)}
                className={`w-full rounded-2xl border p-4 text-left text-sm transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                  detail?.id === item.id
                    ? 'border-brand-accent/70 bg-brand-accent/10 shadow-sm'
                    : 'border-brand-border/70 bg-brand-surface hover:border-brand-accent/30'
                }`}
              >
                <strong className="block font-display text-sm font-bold text-brand-text">{item.user.name}</strong>
                <p className="mt-1 text-xs text-brand-muted">
                  {item.area.replace(/_/g, ' ')} · {item.documentType.replace(/_/g, ' ')}
                </p>
                <p className="mt-1 break-all font-mono text-[10px] text-brand-muted">{item.originalFileName}</p>
                <p className="mt-1 font-mono text-[10px] text-brand-muted">
                  {item.status.replace(/_/g, ' ')} · {new Date(item.createdAt).toLocaleDateString()}
                  {item.claimStatus.active ? ` · claimed by ${item.claimStatus.claimedByName}` : ''}
                </p>
              </button>
            ))
          ) : (
            <div className="p-8 text-center rounded-2xl border border-dashed border-brand-border/80 bg-brand-surface/40 text-xs text-brand-muted">
              No documents are waiting for review.
            </div>
          )}
        </div>

        {detail ? (
          <div className="space-y-5 rounded-2xl border border-brand-border/70 bg-brand-surface p-5">
            <div>
              <h3 className="font-display text-xl font-bold text-brand-text">
                {detail.user.name} · {detail.area.replace(/_/g, ' ')}
              </h3>
              <p className="mt-1 text-xs text-brand-muted">
                Declared conditions: {detail.user.conditions.join(', ') || 'none'} · Allergies: {detail.user.allergies.join(', ') || 'none'}
              </p>
              {detail.user.contexts.filter((item) => item.area === detail.area).map((item) => (
                <p key={item.area} className="mt-1 text-xs text-brand-muted">
                  Self-reported context: {Object.entries(item.responses).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`).join('; ')}
                </p>
              ))}
              <Button variant="secondary" size="sm" onClick={() => void download()} className="mt-3">
                Download original record
              </Button>
            </div>

            <div className="space-y-2 border-t border-brand-border/60 pt-3">
              <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Extracted facts</h4>
              {detail.facts.length ? (
                detail.facts.map((fact) => (
                  <label key={fact.id} className="flex items-center gap-2.5 rounded-xl border border-brand-border/60 bg-brand-bgAlt/30 p-2.5 text-xs text-brand-text">
                    <input
                      type="checkbox"
                      checked={confirmedFactIds.includes(fact.id)}
                      onChange={(event) =>
                        setConfirmedFactIds((ids) =>
                          event.target.checked ? [...ids, fact.id] : ids.filter((id) => id !== fact.id)
                        )
                      }
                      className="rounded border-brand-border text-brand-green focus:ring-brand-green"
                    />
                    <span>
                      <strong>{fact.code}</strong>: {fact.valueText ?? fact.valueNumber} {fact.unit ?? ''}{' '}
                      <small className="text-brand-muted font-mono">({fact.reviewStatus})</small>
                    </span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-brand-muted">No facts were transcribed. Add the relevant fact from the document below.</p>
              )}
            </div>

            <div className="space-y-2 border-t border-brand-border/60 pt-3">
              <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Add fact from document</h4>
              <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                <select
                  value={factCode}
                  onChange={(event) => setFactCode(event.target.value)}
                  className="rounded-xl border border-brand-border bg-brand-bgAlt/60 p-2 text-xs text-brand-text focus:border-brand-accent focus:outline-none"
                >
                  {(factCodes[detail.area] ?? ['OTHER']).map((code) => (
                    <option key={code} value={code}>
                      {code.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <input
                  value={factValue}
                  onChange={(event) => setFactValue(event.target.value)}
                  placeholder="Exact value shown in record"
                  className="rounded-xl border border-brand-border bg-brand-bgAlt/60 p-2 text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!factValue.trim()}
                  onClick={() => {
                    setConfirmedFacts((items) => [...items, { code: factCode, valueText: factValue.trim() }]);
                    setFactValue('');
                  }}
                >
                  Add fact
                </Button>
              </div>
              {confirmedFacts.length > 0 && (
                <p className="text-[11px] text-brand-muted">
                  Confirmed from record: {confirmedFacts.map((fact) => `${fact.code}: ${fact.valueText}`).join('; ')}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 border-t border-brand-border/60 pt-3">
              <label className="text-xs font-bold text-brand-text">
                Decision
                <select
                  value={decision}
                  onChange={(event) => setDecision(event.target.value as typeof decision)}
                  className="mt-1.5 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 p-2 text-xs text-brand-text focus:border-brand-accent focus:outline-none"
                >
                  <option value="NEEDS_CLARIFICATION">Needs clarification</option>
                  <option value="SUFFICIENT">Sufficient for nutrition review</option>
                  <option value="UNUSABLE">Unusable</option>
                </select>
              </label>
              {decision === 'SUFFICIENT' && (
                <label className="text-xs font-bold text-brand-text">
                  Review valid until
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 p-2 text-xs text-brand-text focus:border-brand-accent focus:outline-none"
                  />
                </label>
              )}
            </div>

            <label className="block text-xs font-bold text-brand-text">
              Review rationale
              <textarea
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
                rows={3}
                placeholder="Enter clinical document assessment rationale..."
                className="mt-1.5 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 p-3 text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
              />
            </label>

            <Button
              variant="primary"
              disabled={busy || rationale.trim().length < 3 || (decision === 'SUFFICIENT' && !validUntil)}
              isLoading={busy}
              onClick={() => void submit()}
            >
              Record review
            </Button>
          </div>
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center p-12 text-center rounded-2xl border border-dashed border-brand-border/70 bg-brand-bgAlt/20 text-brand-muted text-sm">
            Select a document to claim its review.
          </div>
        )}
      </div>
    </div>
  );
}
