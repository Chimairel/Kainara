'use client';
import Dropdown from '@/components/ui/Dropdown';

import Button from '@/components/ui/Button';

import { factCodes } from './ProfileWorkPanel.shared';
import type { useProfileWorkPanelModel } from './useProfileWorkPanelModel';
type Model = Extract<ReturnType<typeof useProfileWorkPanelModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'selectedDocument'
    | 'documentDetail'
    | 'fileUrl'
    | 'confirmedFactIds'
    | 'setConfirmedFactIds'
    | 'factCode'
    | 'setFactCode'
    | 'factValue'
    | 'setFactValue'
    | 'setConfirmedFacts'
    | 'confirmedFacts'
    | 'decision'
    | 'setDecision'
    | 'validUntil'
    | 'setValidUntil'
    | 'rationale'
    | 'setRationale'
    | 'busy'
    | 'decideDocument'
  >;
};
export default function ProfileDocumentReview({ model }: SectionProps) {
  const {
    selectedDocument,
    documentDetail,
    fileUrl,
    confirmedFactIds,
    setConfirmedFactIds,
    factCode,
    setFactCode,
    factValue,
    setFactValue,
    setConfirmedFacts,
    confirmedFacts,
    decision,
    setDecision,
    validUntil,
    setValidUntil,
    rationale,
    setRationale,
    busy,
    decideDocument,
  } = model;
  return (
    <>
      {selectedDocument && documentDetail && (
        <>
          <div className="rounded-xl border border-brand-border bg-brand-bgAlt/40 p-3 text-xs text-brand-muted">
            Claimed document: {selectedDocument.originalFileName} · {selectedDocument.status.replace(/_/g, ' ')}. Access
            to the original is recorded and the claim expires after 30 minutes.
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
              <p key={item.area} className="rounded-xl border border-brand-border p-3 text-xs text-brand-muted">
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
                <Dropdown
                  aria-label="Fact code"
                  value={factCode}
                  onChange={(event) => setFactCode(event)}
                  className="rounded-lg border border-brand-border bg-brand-surface p-2"
                >
                  {(factCodes[documentDetail.area] ?? ['OTHER']).map((code) => (
                    <option key={code} value={code}>
                      {code.replace(/_/g, ' ')}
                    </option>
                  ))}
                </Dropdown>
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
                <Dropdown
                  value={decision}
                  onChange={(event) => setDecision(event as typeof decision)}
                  className="mt-1 block w-full rounded-lg border border-brand-border bg-brand-surface p-2"
                >
                  <option value="NEEDS_CLARIFICATION">Needs clarification</option>
                  <option value="SUFFICIENT">Sufficient for nutrition review</option>
                  <option value="UNUSABLE">Unusable</option>
                </Dropdown>
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
    </>
  );
}
