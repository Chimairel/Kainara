'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import CaseReviewDocument, { type ReviewContext } from './CaseReviewDocument';
export default function CaseReviewContext({ auditId, ownerId }: { auditId: string; ownerId: string | undefined }) {
  const scope = JSON.stringify([auditId, ownerId]);
  const liveScope = useRef(scope);
  liveScope.current = scope;
  const request = useRef<symbol | null>(null);
  const [loaded, setLoaded] = useState<{ scope: string; data: ReviewContext } | null>(null);
  const data = loaded?.scope === scope ? loaded.data : null;
  useEffect(() => {
    request.current = null;
    setLoaded(null);
    setError(null);
    setBusy(false);
  }, [ownerId, auditId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open() {
    if (request.current) return;
    const token = Symbol(scope);
    request.current = token;
    setBusy(true);
    setError(null);
    try {
      const result = await api.get(`/admin/audit-history/${encodeURIComponent(auditId)}/review-context`);
      const value = result.data?.data;
      if (
        !result.data?.success ||
        !value ||
        typeof value !== 'object' ||
        !Array.isArray(value.clinicalEvidence) ||
        !value.clinicalEvidence.every((item: unknown) => item != null && typeof item === 'object') ||
        (value.historicalInformation != null && typeof value.historicalInformation !== 'string') ||
        (value.selectedDecisionId != null && typeof value.selectedDecisionId !== 'string') ||
        (value.recipe && !Array.isArray(value.recipe.history))
      )
        throw new Error('Review context could not be loaded.');
      if (liveScope.current === scope && request.current === token) setLoaded({ scope, data: value });
    } catch (err) {
      if (liveScope.current !== scope || request.current !== token) return;
      setError(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          'Review context could not be loaded.'
      );
    } finally {
      if (liveScope.current === scope && request.current === token) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section className="space-y-3 border-t border-brand-border pt-3">
      {!data && (
        <Button variant="secondary" size="sm" isLoading={busy} onClick={() => void open()}>
          Open related review details
        </Button>
      )}
      {error && !data && (
        <p role="alert" className="text-xs text-status-error-text">
          {error}
        </p>
      )}
      {data && (
        <>
          <CaseReviewDocument
            data={data}
            error={error}
            onDownload={async (record) => {
              try {
                const result = await api.get(
                  `/admin/audit-history/${encodeURIComponent(auditId)}/review-context/documents/${encodeURIComponent(record.id!)}/file`,
                  { responseType: 'blob' }
                );
                if (liveScope.current !== scope) return;
                const url = URL.createObjectURL(result.data);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = record.originalFileName || 'clinical-evidence';
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 30_000);
              } catch {
                if (liveScope.current !== scope) return;
                setError('The related original record could not be loaded. It may have been withdrawn.');
              }
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => setLoaded(null)}>
            Close case details
          </Button>
        </>
      )}
    </section>
  );
}
