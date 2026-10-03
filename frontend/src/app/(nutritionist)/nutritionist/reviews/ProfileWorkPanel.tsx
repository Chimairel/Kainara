'use client';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';

import { useCallback, useEffect, useState } from 'react';
import { FileText, RefreshCw, UserCheck } from 'lucide-react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuth } from '@/hooks/useAuth';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import type { NutritionReport } from '@/types';
import Button from '@/components/ui/Button';
import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';
import NutritionGuidancePaper, { type GuidanceProfileSnapshot } from '@/features/reports/NutritionGuidancePaper';

type Person = {
  userId: string;
  name: string;
  conditions: string[];
  allergies: string[];
  profileStatus: string | null;
  documentCount: number;
  documentIds: string[];
};
type Report = {
  id: string;
  version: number;
  generatedAt: string;
  acknowledgedAt: string | null;
  profileRevision: number;
  profileSnapshot: unknown;
  content: NutritionReport;
  isCurrent: boolean;
  isPlanningReport?: boolean;
};
type DocumentItem = {
  id: string;
  area: string;
  documentType: string;
  status: string;
  originalFileName: string;
  mimeType: string;
  createdAt: string;
  pending: boolean;
  latestReview: { decision: string; rationale: string } | null;
};
type ProfileReview = {
  profileRevision: number;
  scopeKey: string;
  claim?: { active: boolean; mine: boolean; expiresAt: string | null };
  healthDetails?: Array<{ area: string; responses: Record<string, unknown> }>;
  needsClarification: boolean;
  previousReview: { notes: string | null } | null;
  requirements: Array<{ area: string; state: string; message: string }>;
  availableAreas: string[];
};
type PersonDetail = {
  userId: string;
  name: string;
  profileStatus: string | null;
  activePlanningReportVersion?: number | null;
  currentProfile: {
    revision: number | null;
    age: number | null;
    goal: string | null;
    dailyCalorieTarget: number | null;
    conditions: string[];
    allergies: string[];
  };
  profileReview: ProfileReview | null;
  reports: Report[];
  documents: DocumentItem[];
  requirements: Array<{ area: string; state: string; message: string }>;
  availableAreas: string[];
};
type DocumentDetail = {
  id: string;
  area: string;
  originalFileName: string;
  mimeType: string;
  facts: Array<{
    id: string;
    code: string;
    valueText: string | null;
    valueNumber: number | null;
    unit: string | null;
    reviewStatus: string;
  }>;
  user: { contexts: Array<{ area: string; responses: Record<string, unknown> }> };
};

const factCodes: Record<string, string[]> = {
  KIDNEY_DISEASE: ['CKD_STAGE', 'EGFR'],
  HEART_CONDITION: ['HEART_DIAGNOSIS'],
  DIABETES: ['DIABETES_MEDICATION'],
};

function savedProfile(report: Report, name: string): GuidanceProfileSnapshot {
  const root =
    report.profileSnapshot && typeof report.profileSnapshot === 'object' && !Array.isArray(report.profileSnapshot)
      ? (report.profileSnapshot as Record<string, unknown>)
      : {};
  const profile =
    root.profile && typeof root.profile === 'object' && !Array.isArray(root.profile)
      ? (root.profile as Record<string, unknown>)
      : {};
  const strings = (value: unknown) =>
    typeof value === 'string' && value.trim()
      ? [value.trim()]
      : Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item !== 'NONE')
        : [];
  return {
    name,
    goal: typeof profile.goal === 'string' ? profile.goal : 'Not recorded',
    dailyCalorieTarget: typeof profile.dailyCalorieTarget === 'number' ? profile.dailyCalorieTarget : null,
    conditions: [...strings(root.conditions), ...strings(root.otherConditions)],
    foodRestrictions: [...strings(root.allergens), ...strings(root.otherAllergies)],
  };
}

export default function ProfileWorkPanel() {
  const ownerId = useAuth().user?.userId;
  const [people, setPeople] = useState<Person[]>(
    readSessionResource<Person[]>(ownerId, 'nutritionist-profile-work', 30_000) ?? []
  );
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [selection, setSelection] = useState<{ kind: 'report' | 'document'; id: string } | null>(null);
  const [documentDetail, setDocumentDetail] = useState<DocumentDetail | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [requestArea, setRequestArea] = useState('');
  const [decision, setDecision] = useState<'SUFFICIENT' | 'NEEDS_CLARIFICATION' | 'UNUSABLE'>('NEEDS_CLARIFICATION');
  const [rationale, setRationale] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [confirmedFactIds, setConfirmedFactIds] = useState<string[]>([]);
  const [factCode, setFactCode] = useState('OTHER');
  const [factValue, setFactValue] = useState('');
  const [confirmedFacts, setConfirmedFacts] = useState<Array<{ code: string; valueText: string }>>([]);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await api.get('/nutritionist/profile-work', signal ? { signal } : undefined);
        if (signal?.aborted) return null;
        const next: Person[] = response.data.data ?? [];
        setPeople(next);
        writeSessionResource(ownerId, 'nutritionist-profile-work', next);
        setError(null);
        window.dispatchEvent(new Event('nutrimind:review-work-updated'));
        return next;
      } catch (cause) {
        if (!signal?.aborted) setError(getApiErrorMessage(cause, 'The profile queue could not be loaded.'));
        return null;
      }
    },
    [ownerId]
  );
  useVisiblePolling(
    async (signal) => {
      await refresh(signal);
      if (!signal.aborted && detail) {
        const response = await api.get(`/nutritionist/profile-work/${detail.userId}`, { signal });
        if (!signal.aborted) setDetail(response.data.data);
      }
    },
    { enabled: !busy, immediate: false, scopeKey: `${ownerId}:${detail?.userId}` }
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(
    () => () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    },
    [fileUrl]
  );

  const openPerson = async (userId: string, preserveSelection = false) => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.get(`/nutritionist/profile-work/${userId}`);
      const next: PersonDetail = response.data.data;
      setDetail(next);
      if (!preserveSelection) {
        setSelection(next.reports.length ? { kind: 'report', id: next.reports[0].id } : null);
        setDocumentDetail(null);
        setFileUrl(null);
        setExpanded(false);
      }
      setRequestArea(next.availableAreas[0] ?? '');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not open this profile.'));
    } finally {
      setBusy(false);
    }
  };

  const openDocument = async (item: DocumentItem) => {
    if (!detail || item.status === 'WITHDRAWN') return;
    setBusy(true);
    setError(null);
    setDocumentDetail(null);
    setFileUrl(null);
    try {
      // The first request obtains the 30-minute document claim; the file endpoint checks
      // that claim again and records access before sending any bytes.
      const path = item.pending
        ? `/nutritionist/clinical-evidence/${item.id}`
        : `/nutritionist/profile-work/${detail.userId}/documents/${item.id}`;
      const claimed = await api.get(path);
      const file = await api.get(`${path}/file`, { responseType: 'blob' });
      setDocumentDetail(claimed.data.data);
      setFileUrl(URL.createObjectURL(new Blob([file.data], { type: item.mimeType })));
      setSelection({ kind: 'document', id: item.id });
      setRationale('');
      setValidUntil('');
      setDecision('NEEDS_CLARIFICATION');
      setConfirmedFactIds([]);
      setConfirmedFacts([]);
      setFactValue('');
      setFactCode(factCodes[item.area]?.[0] ?? 'OTHER');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not claim or open this document.'));
    } finally {
      setBusy(false);
    }
  };

  const afterDecision = async () => {
    const next = await refresh();
    if (detail && next?.some((person) => person.userId === detail.userId)) {
      await openPerson(detail.userId, true);
    } else {
      setDetail(null);
      setSelection(null);
      setDocumentDetail(null);
      setFileUrl(null);
      setExpanded(false);
    }
  };
  const claimProfile = async (release = false) => {
    if (!detail || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.post(
        `/nutritionist/profile-reviews/${detail.userId}/${release ? 'release' : 'claim'}`
      );
      setDetail((current) => (current ? { ...current, profileReview: response.data.data } : current));
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not claim this profile.'));
    } finally {
      setBusy(false);
    }
  };
  const decideProfile = async (outcome: 'APPROVED' | 'DECLINED' | 'REQUEST_DETAILS') => {
    if (!detail?.profileReview) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/nutritionist/profile-reviews/${detail.userId}/decision`, {
        decision: outcome,
        notes,
        profileRevision: detail.profileReview.profileRevision,
        scopeKey: detail.profileReview.scopeKey,
        ...(outcome === 'REQUEST_DETAILS' ? { area: requestArea } : {}),
      });
      setNotes('');
      await afterDecision();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not record the profile decision.'));
    } finally {
      setBusy(false);
    }
  };
  const decideDocument = async () => {
    if (!documentDetail) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/nutritionist/clinical-evidence/${documentDetail.id}`, {
        decision,
        rationale,
        validUntil: decision === 'SUFFICIENT' ? validUntil : null,
        confirmedFactIds,
        unclearFactIds: [],
        confirmedFacts,
      });
      setDocumentDetail(null);
      setFileUrl(null);
      setSelection(detail?.reports.length ? { kind: 'report', id: detail.reports[0].id } : null);
      await afterDecision();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not record the document review.'));
    } finally {
      setBusy(false);
    }
  };

  const selectedReport = selection?.kind === 'report' ? detail?.reports.find((item) => item.id === selection.id) : null;
  const selectedDocument =
    selection?.kind === 'document' ? detail?.documents.find((item) => item.id === selection.id) : null;
  const profileBlocked =
    detail?.profileReview?.needsClarification || detail?.requirements.some((item) => item.state !== 'READY');

  return (
    <div className="flex h-[calc(100vh-270px)] min-h-[640px] overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface shadow-sm">
      <aside
        className={`${detail ? 'hidden lg:flex' : 'flex'} ${expanded ? '!hidden' : ''} w-full lg:w-[27%] shrink-0 flex-col border-r border-brand-border/70 p-5`}
      >
        <div className="mb-4 rounded-2xl border border-brand-border/80 bg-brand-surface p-5">
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-brand-green">
            Member profile queue
          </p>
          <div className="mt-2 flex items-center justify-between">
            <h2 className="font-display text-lg font-black">Members awaiting review</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              aria-label="Refresh profile queue"
              className="rounded-xl border border-brand-border p-2"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-brand-muted">
            One person can have a profile task, documents to review, or both.
          </p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
          {people.map((person) => (
            <button
              key={person.userId}
              type="button"
              disabled={busy}
              onClick={() => void openPerson(person.userId)}
              aria-pressed={detail?.userId === person.userId}
              className={`w-full rounded-2xl border p-4 text-left text-xs ${detail?.userId === person.userId ? 'border-brand-green bg-brand-green/10' : 'border-brand-border/70 hover:border-brand-green/40'}`}
            >
              <strong className="block text-sm text-brand-text">{person.name}</strong>
              <span className="mt-1 block text-brand-muted">
                Conditions: {person.conditions.filter((item) => item !== 'NONE').join(', ') || 'none'} · Allergies:{' '}
                {person.allergies.filter((item) => item !== 'NONE').join(', ') || 'none'}
              </span>
              <span className="mt-2 block font-semibold text-brand-green">
                {person.profileStatus
                  ? `Profile: ${person.profileStatus.replace(/_/g, ' ').toLowerCase()}`
                  : 'Profile decision not pending'}{' '}
                · {person.documentCount} document{person.documentCount === 1 ? '' : 's'}
              </span>
            </button>
          ))}
          {!people.length && (
            <p className="rounded-2xl border border-dashed border-brand-border p-6 text-sm text-brand-muted">
              Profile queue is clear.
            </p>
          )}
        </div>
      </aside>
      <ExpandableCasePanel
        expanded={expanded}
        onExpandedChange={setExpanded}
        canExpand={!!detail}
        onBack={() => {
          setDetail(null);
          setExpanded(false);
        }}
        className={`${detail ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col overflow-hidden`}
        contentClassName="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar sm:p-6"
      >
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-red-500/30 p-3 text-sm text-red-500">
            {error}
          </p>
        )}
        {!detail ? (
          <div className="p-6 text-brand-muted">
            <UserCheck className="mb-3 h-8 w-8 text-brand-green" />
            <h2 className="font-display text-xl font-bold text-brand-text">Select a person</h2>
            <p className="mt-2 text-sm">Their saved guidance, uploaded documents, and review tasks appear here.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-black text-brand-text">{detail.name}</h2>
              <p className="text-xs text-brand-muted">
                Current profile revision {detail.currentProfile.revision ?? 'unknown'} · Conditions:{' '}
                {detail.currentProfile.conditions.filter((item) => item !== 'NONE').join(', ') || 'none'} · Allergies:{' '}
                {detail.currentProfile.allergies.filter((item) => item !== 'NONE').join(', ') || 'none'}
              </p>
              <p className="mt-2 text-xs text-brand-muted">
                {detail.activePlanningReportVersion
                  ? `Planning uses report version ${detail.activePlanningReportVersion}. Current health declarations above still apply to safety checks.`
                  : 'No report is selected for planning yet.'}
              </p>
            </div>
            <div className="grid gap-5 xl:grid-cols-[210px_minmax(0,1fr)]">
              <nav aria-label="Patient guidance and documents" className="space-y-5 text-left">
                <section>
                  <h3 className="text-sm font-bold text-brand-text">Nutrition report history</h3>
                  <p className="mt-1 text-xs text-brand-muted">Each version uses its saved profile.</p>
                  <div className="mt-3 space-y-1">
                    {detail.reports.map((report) => (
                      <button
                        type="button"
                        key={report.id}
                        onClick={() => {
                          setSelection({ kind: 'report', id: report.id });
                          setDocumentDetail(null);
                          setFileUrl(null);
                        }}
                        aria-pressed={selection?.id === report.id}
                        className={`block w-full rounded-xl px-3 py-2 text-left text-xs ${selection?.id === report.id ? 'bg-brand-bgAlt font-bold text-brand-text' : 'text-brand-muted hover:bg-brand-bgAlt/50'}`}
                      >
                        Version {report.version} · {new Date(report.generatedAt).toLocaleDateString()}{' '}
                        {report.isPlanningReport
                          ? '· Selected for planning'
                          : report.isCurrent
                            ? '· Current profile draft'
                            : ''}
                      </button>
                    ))}
                    {!detail.reports.length && <p className="text-xs text-brand-muted">No guidance prepared yet.</p>}
                  </div>
                </section>
                <section>
                  <h3 className="text-sm font-bold text-brand-text">Documentation</h3>
                  <div className="mt-3 space-y-1">
                    {detail.documents.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => void openDocument(item)}
                        disabled={busy || item.status === 'WITHDRAWN'}
                        aria-pressed={selection?.id === item.id}
                        className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-xs ${selection?.id === item.id ? 'bg-brand-bgAlt font-bold text-brand-text' : 'text-brand-muted hover:bg-brand-bgAlt/50'} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 break-all">
                          {item.originalFileName}
                          <small className="block">
                            {item.area.replace(/_/g, ' ')} ·{' '}
                            {item.pending ? 'Review pending' : item.status.replace(/_/g, ' ')}
                          </small>
                        </span>
                      </button>
                    ))}
                    {!detail.documents.length && <p className="text-xs text-brand-muted">No documents uploaded.</p>}
                  </div>
                </section>
              </nav>
              <div className="min-w-0 space-y-5">
                {selectedReport && (
                  <>
                    <div className="rounded-xl border border-brand-border bg-brand-bgAlt/40 p-3 text-xs text-brand-muted">
                      <strong className="text-brand-text">Recorded profile:</strong> revision{' '}
                      {selectedReport.profileRevision} when this guidance was prepared.{' '}
                      {selectedReport.isPlanningReport
                        ? 'Selected as the planning baseline. Compare with the latest health declarations above.'
                        : selectedReport.isCurrent
                          ? 'Matches the current profile, but is not selected for planning.'
                          : 'Historical guidance; compare with the selected planning report and current health declarations.'}
                    </div>
                    <NutritionGuidancePaper
                      report={{
                        ...selectedReport.content,
                        id: selectedReport.id,
                        version: selectedReport.version,
                        generatedAt: selectedReport.generatedAt,
                        acknowledgedAt: selectedReport.acknowledgedAt ?? undefined,
                      }}
                      activePlanningVersion={detail.activePlanningReportVersion}
                      profile={savedProfile(selectedReport, detail.name)}
                    />
                  </>
                )}
                {selectedDocument && documentDetail && (
                  <>
                    <div className="rounded-xl border border-brand-border bg-brand-bgAlt/40 p-3 text-xs text-brand-muted">
                      Claimed document: {selectedDocument.originalFileName} ·{' '}
                      {selectedDocument.status.replace(/_/g, ' ')}. Access to the original is recorded and the claim
                      expires after 30 minutes.
                    </div>
                    {fileUrl &&
                      (selectedDocument.mimeType === 'application/pdf' ? (
                        <iframe
                          src={fileUrl}
                          title={`Clinical document ${selectedDocument.originalFileName}`}
                          className="h-[620px] w-full rounded-xl border border-brand-border bg-white"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={fileUrl}
                          alt={`Clinical document ${selectedDocument.originalFileName}`}
                          className="max-h-[720px] w-full rounded-xl border border-brand-border bg-white object-contain"
                        />
                      ))}
                    {fileUrl && (
                      <a
                        href={fileUrl}
                        download={selectedDocument.originalFileName}
                        className="text-xs font-semibold text-brand-green underline"
                      >
                        Download claimed original
                      </a>
                    )}
                    {documentDetail.user.contexts
                      .filter((item) => item.area === documentDetail.area)
                      .map((item) => (
                        <p
                          key={item.area}
                          className="rounded-xl border border-brand-border p-3 text-xs text-brand-muted"
                        >
                          Self-reported context:{' '}
                          {Object.entries(item.responses)
                            .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`)
                            .join('; ')}
                        </p>
                      ))}
                    {!selectedDocument.pending && selectedDocument.latestReview && (
                      <p className="rounded-xl border border-brand-border p-3 text-xs text-brand-muted">
                        Recorded decision: {selectedDocument.latestReview.decision.replace(/_/g, ' ')}.{' '}
                        {selectedDocument.latestReview.rationale}
                      </p>
                    )}
                    {selectedDocument.pending && (
                      <section className="rounded-xl border border-brand-border p-4 text-xs">
                        <h3 className="font-bold text-brand-text">Facts from document</h3>
                        {documentDetail.facts.map((fact) => (
                          <label key={fact.id} className="mt-2 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={confirmedFactIds.includes(fact.id)}
                              onChange={(event) =>
                                setConfirmedFactIds((ids) =>
                                  event.target.checked ? [...ids, fact.id] : ids.filter((id) => id !== fact.id)
                                )
                              }
                            />
                            {fact.code}: {fact.valueText ?? fact.valueNumber} {fact.unit ?? ''} ({fact.reviewStatus})
                          </label>
                        ))}
                        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                          <select
                            aria-label="Fact code"
                            value={factCode}
                            onChange={(event) => setFactCode(event.target.value)}
                            className="rounded-lg border border-brand-border bg-brand-surface p-2"
                          >
                            {(factCodes[documentDetail.area] ?? ['OTHER']).map((code) => (
                              <option key={code} value={code}>
                                {code.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                          <input
                            aria-label="Fact value"
                            value={factValue}
                            onChange={(event) => setFactValue(event.target.value)}
                            placeholder="Exact value shown in record"
                            className="rounded-lg border border-brand-border bg-brand-surface p-2"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!factValue.trim()}
                            onClick={() => {
                              setConfirmedFacts((items) => [...items, { code: factCode, valueText: factValue.trim() }]);
                              setFactValue('');
                            }}
                          >
                            Add fact
                          </Button>
                        </div>
                        {!!confirmedFacts.length && (
                          <p className="mt-2">
                            Confirmed: {confirmedFacts.map((fact) => `${fact.code}: ${fact.valueText}`).join('; ')}
                          </p>
                        )}
                      </section>
                    )}
                    {selectedDocument.pending && (
                      <section className="space-y-3 rounded-xl border border-brand-border p-4 text-xs">
                        <h3 className="font-bold text-brand-text">Document decision</h3>
                        <label className="block">
                          Decision
                          <select
                            value={decision}
                            onChange={(event) => setDecision(event.target.value as typeof decision)}
                            className="mt-1 block w-full rounded-lg border border-brand-border bg-brand-surface p-2"
                          >
                            <option value="NEEDS_CLARIFICATION">Needs clarification</option>
                            <option value="SUFFICIENT">Sufficient for nutrition review</option>
                            <option value="UNUSABLE">Unusable</option>
                          </select>
                        </label>
                        {decision === 'SUFFICIENT' && (
                          <label className="block">
                            Review valid until
                            <input
                              type="date"
                              value={validUntil}
                              onChange={(event) => setValidUntil(event.target.value)}
                              className="mt-1 block w-full rounded-lg border border-brand-border bg-brand-surface p-2"
                            />
                          </label>
                        )}
                        <label className="block">
                          Review rationale
                          <textarea
                            value={rationale}
                            onChange={(event) => setRationale(event.target.value)}
                            rows={3}
                            className="mt-1 block w-full rounded-lg border border-brand-border bg-brand-surface p-2"
                          />
                        </label>
                        <Button
                          disabled={busy || rationale.trim().length < 3 || (decision === 'SUFFICIENT' && !validUntil)}
                          onClick={() => void decideDocument()}
                        >
                          Record document review
                        </Button>
                      </section>
                    )}
                  </>
                )}
                {!selectedReport && !selectedDocument && (
                  <p className="rounded-xl border border-dashed border-brand-border p-8 text-sm text-brand-muted">
                    Select a saved guidance version or a pending document.
                  </p>
                )}
                {detail.profileReview && (
                  <section className="space-y-3 rounded-xl border border-brand-border bg-brand-surface p-4 text-xs">
                    <h3 className="font-bold text-brand-text">Profile decision</h3>
                    <p className="text-brand-muted">
                      {detail.profileReview.claim?.mine
                        ? 'Claimed by you for 30 minutes.'
                        : detail.profileReview.claim?.active
                          ? 'Claimed by another nutritionist.'
                          : 'Claim this profile to record a decision.'}
                    </p>
                    <Button
                      disabled={busy || (!!detail.profileReview.claim?.active && !detail.profileReview.claim?.mine)}
                      onClick={() => void claimProfile(!!detail.profileReview?.claim?.mine)}
                    >
                      {detail.profileReview.claim?.mine ? 'Release profile' : 'Claim profile'}
                    </Button>
                    <h4 className="font-bold">Member-provided health details</h4>
                    {detail.profileReview.healthDetails?.map((item) => (
                      <div key={item.area} className="rounded-lg border border-brand-border p-3">
                        <p className="font-semibold">{item.area.replace(/_/g, ' ')}</p>
                        {['conditionDetails', 'medications', 'dietaryAdvice', 'recentSymptoms', 'measurements'].map(
                          (field) =>
                            typeof item.responses[field] === 'string' && item.responses[field] ? (
                              <p key={field} className="mt-2 whitespace-pre-wrap">
                                <strong>{field.replace(/([A-Z])/g, ' $1')}: </strong>
                                {String(item.responses[field])}
                              </p>
                            ) : null
                        )}
                      </div>
                    ))}
                    {detail.profileReview.previousReview?.notes && (
                      <p className="text-brand-muted">Previous review: {detail.profileReview.previousReview.notes}</p>
                    )}
                    {detail.requirements.map((item) => (
                      <p key={item.area} className={item.state === 'READY' ? 'text-brand-muted' : 'text-amber-500'}>
                        {item.area.replace(/_/g, ' ')}: {item.message}
                      </p>
                    ))}
                    {detail.availableAreas.length > 0 && (
                      <label className="block">
                        Details request area
                        <select
                          value={requestArea}
                          onChange={(event) => setRequestArea(event.target.value)}
                          className="mt-1 block w-full rounded-lg border border-brand-border bg-brand-surface p-2"
                        >
                          {detail.availableAreas.map((area) => (
                            <option key={area} value={area}>
                              {area.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="block">
                      Review notes
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={3}
                        className="mt-1 block w-full rounded-lg border border-brand-border bg-brand-surface p-2"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={
                          busy || !detail.profileReview.claim?.mine || !!profileBlocked || notes.trim().length < 10
                        }
                        onClick={() => void decideProfile('APPROVED')}
                      >
                        Confirm for planning
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy || !detail.profileReview.claim?.mine || notes.trim().length < 10}
                        onClick={() => void decideProfile('DECLINED')}
                      >
                        Needs correction
                      </Button>
                      {!!detail.availableAreas.length && (
                        <Button
                          variant="secondary"
                          disabled={busy || !detail.profileReview.claim?.mine || notes.trim().length < 10}
                          onClick={() => void decideProfile('REQUEST_DETAILS')}
                        >
                          Request details
                        </Button>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        )}
      </ExpandableCasePanel>
    </div>
  );
}
