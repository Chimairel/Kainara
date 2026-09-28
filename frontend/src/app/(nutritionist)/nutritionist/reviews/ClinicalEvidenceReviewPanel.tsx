'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { ArrowLeft, CheckCircle, Download, FileCheck, RefreshCw } from 'lucide-react';

type QueueItem = {
  id: string;
  area: string;
  documentType: string;
  status: string;
  originalFileName: string;
  createdAt: string;
  factCount: number;
  user: { name: string; conditions: string[] };
  claimStatus: { active: boolean; claimedByName: string | null };
};

type Fact = {
  id: string;
  code: string;
  valueText: string | null;
  valueNumber: number | null;
  unit: string | null;
  reviewStatus: string;
};

type Detail = QueueItem & {
  facts: Fact[];
  user: QueueItem['user'] & {
    allergies: string[];
    contexts: Array<{ area: string; responses: Record<string, unknown> }>;
  };
};

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
      setQueue(response.data.data ?? []);
      setError(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'The clinical queue could not be loaded.'));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const claim = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.get(`/nutritionist/clinical-evidence/${id}`);
      setDetail(response.data.data);
      setConfirmedFactIds([]);
      setConfirmedFacts([]);
      setRationale('');
      setValidUntil('');
      setFactCode(factCodes[response.data.data.area]?.[0] ?? 'OTHER');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not claim this document.'));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!detail) return;
    setError(null);
    try {
      const response = await api.get(`/nutritionist/clinical-evidence/${detail.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = detail.originalFileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not open the claimed document.'));
    }
  };

  const submit = async () => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/nutritionist/clinical-evidence/${detail.id}`, {
        decision,
        rationale,
        validUntil: decision === 'SUFFICIENT' ? validUntil : null,
        confirmedFactIds,
        unclearFactIds: [],
        confirmedFacts,
      });
      setDetail(null);
      await refresh();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'The clinical review could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex md:h-[calc(100vh-270px)] md:min-h-[640px] flex-col overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface text-left shadow-card-lg backdrop-blur-xl md:flex-row">
      {/* Master Queue List Panel */}
      <div
        className={`${detail ? 'hidden md:flex' : 'flex'} h-full w-full min-w-0 flex-col border-brand-border/70 bg-brand-surface/75 p-5 md:w-[38%] md:min-w-[280px] md:border-r`}
      >
        <div className="shrink-0 mb-3 rounded-2xl border border-brand-border/80 bg-brand-surface/90 p-5 text-brand-text shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-green">
              Document evidence queue
            </span>
            <Badge variant="pending" className="text-[9px]">
              {queue.length} pending
            </Badge>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <h2 className="font-display text-lg font-black tracking-tight text-brand-text">
              Clinical documents
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
            Check the original record and confirm only facts relevant to nutrition planning.
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
                No documents are waiting for review in this queue.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {queue.map((item) => {
              const isSelected = detail?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void claim(item.id)}
                  className={`w-full rounded-2xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-brand-green/40 cursor-pointer ${
                    isSelected
                      ? 'border-brand-green/40 bg-brand-green/[0.08] shadow-md'
                      : 'border-brand-border/70 bg-brand-surface hover:-translate-y-0.5 hover:border-brand-green/25'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold text-brand-green">{item.user.name}</span>
                    <Badge variant="pending" className="text-xs">
                      {item.status.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wide">
                    <span className="rounded-md border border-brand-border px-2 py-0.5 text-brand-muted">
                      {item.area.replace(/_/g, ' ')}
                    </span>
                    <span className="rounded-md border border-brand-border px-2 py-0.5 text-brand-muted">
                      {item.documentType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mb-1 truncate font-mono text-[10px] text-brand-muted">{item.originalFileName}</p>
                  <p className="text-[10px] text-brand-muted">
                    {new Date(item.createdAt).toLocaleDateString()}
                    {item.claimStatus.active ? ` · claimed by ${item.claimStatus.claimedByName}` : ''}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Details View Panel */}
      <div
        className={`${detail ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col overflow-y-auto bg-transparent p-4 custom-scrollbar sm:p-6`}
      >
        {detail && (
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="mb-4 inline-flex w-fit items-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs font-bold text-brand-text outline-none transition hover:border-brand-green/35 focus-visible:ring-2 focus-visible:ring-brand-green/40 md:hidden"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to document queue
          </button>
        )}

        {!detail ? (
          <div className="space-y-6 py-2">
            <div className="rounded-3xl border border-brand-border/80 bg-brand-surface/90 p-6 sm:p-8 shadow-card-lg backdrop-blur-xl space-y-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent">
                <FileCheck className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-black tracking-tight text-brand-text">
                  A clear path to document review
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                  Inspect uploaded medical records, lab tests, and clinical evidence to extract planning-relevant parameters.
                </p>
              </div>
              <div className="grid gap-3 pt-2">
                {[
                  {
                    step: '01',
                    title: 'Download and review original file',
                    desc: 'Inspect the patient’s uploaded PDF or image medical report in full resolution.',
                  },
                  {
                    step: '02',
                    title: 'Transcribe and confirm clinical facts',
                    desc: 'Verify extracted diagnostic facts (e.g. eGFR, CKD stage, diabetes medications) against the document.',
                  },
                  {
                    step: '03',
                    title: 'Record sufficiency decision',
                    desc: 'Certify the document as sufficient with a validity period, or request further clarification.',
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

            {/* Document Header Card */}
            <div className="space-y-4 rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border pb-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-brand-text">
                    {detail.user.name} · {detail.area.replace(/_/g, ' ')}
                  </h3>
                  <p className="mt-0.5 text-xs text-brand-muted">
                    Declared conditions: {detail.user.conditions.join(', ') || 'none'} · Allergies: {detail.user.allergies.join(', ') || 'none'}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void download()}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download original record
                </Button>
              </div>

              {detail.user.contexts.filter((item) => item.area === detail.area).map((item) => (
                <div key={item.area} className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-xs text-brand-muted">
                  <strong className="text-brand-text font-bold">Self-reported context: </strong>
                  {Object.entries(item.responses).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`).join('; ')}
                </div>
              ))}
            </div>

            {/* Extracted Facts */}
            <div className="rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card space-y-3">
              <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Extracted facts</h4>
              {detail.facts.length ? (
                <div className="space-y-2">
                  {detail.facts.map((fact) => (
                    <label key={fact.id} className="flex items-center gap-2.5 rounded-xl border border-brand-border/60 bg-brand-bgAlt/30 p-2.5 text-xs text-brand-text cursor-pointer hover:border-brand-green/30">
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
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-muted">No facts were transcribed. Add the relevant fact from the document below.</p>
              )}
            </div>

            {/* Add Fact from Document */}
            <div className="rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card space-y-3">
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

            {/* Decision Controls */}
            <div className="rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
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

              <div className="pt-1">
                <Button
                  variant="primary"
                  disabled={busy || rationale.trim().length < 3 || (decision === 'SUFFICIENT' && !validUntil)}
                  isLoading={busy}
                  onClick={() => void submit()}
                >
                  Record review
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
