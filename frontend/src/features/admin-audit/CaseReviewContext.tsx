'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import CaseReviewDocument, { type ReviewContext } from './CaseReviewDocument';
export default function CaseReviewContext({ auditId, ownerId }: { auditId: string; ownerId: string | undefined }) {
  const scope = JSON.stringify([auditId, ownerId]);
  const liveScope = useRef(scope);
  liveScope.current = scope;
  const [loaded, setLoaded] = useState<{ scope: string; data: ReviewContext } | null>(null);
  const data = loaded?.scope === scope ? loaded.data : null;
  useEffect(() => {
    setLoaded(null);
    setError(null);
    setBusy(false);
  }, [ownerId, auditId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.get(`/admin/audit-history/${encodeURIComponent(auditId)}/review-context`);
      if (!result.data?.success || !result.data.data) throw new Error('Review context could not be loaded.');
      if (liveScope.current === scope) setLoaded({ scope, data: result.data.data });
    } catch (err) {
      if (liveScope.current !== scope) return;
      setError(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          'Review context could not be loaded.'
      );
    } finally {
      if (liveScope.current === scope) setBusy(false);
    }
  }
  return (
    <section className="space-y-3 border-t border-brand-border pt-3">
      {!data && (
        <Button variant="secondary" size="sm" isLoading={busy} onClick={() => void open()}>
          Open related review details
        </Button>
      )}
      {error && (
        <p role="alert" className="text-xs text-status-error-text">
          {error}
        </p>
      )}
      {data && (
        <>
          <CaseReviewDocument
            data={data}
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
