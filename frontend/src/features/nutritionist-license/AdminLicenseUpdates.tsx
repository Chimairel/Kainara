'use client';
import { useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
import HeaderRefreshAction from '@/components/shared/HeaderRefreshAction';
import LicenseUpdateHistory from './LicenseUpdateHistory';
import { useLicenseDocument } from './useLicenseDocument';
import { licenseDate, type LicenseUpdate, type LicenseUpdatesPage } from './types';

export default function AdminLicenseUpdates({ onChanged }: { onChanged: () => void }) {
  const ownerId = useAuth().user?.userId;
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const [view, setView] = useState<'pending' | 'history'>('pending'),
    [page, setPage] = useState(1);
  const query = useSessionQuery<LicenseUpdatesPage>({
    ownerId,
    resource: `admin-license-updates:${view}:${page}`,
    pollIntervalMs: 60000,
    errorMessage: 'License updates could not be loaded. Please try again.',
    fetcher: async () =>
      (
        await api.get('/admin/license-updates', {
          params: { page, ...(view === 'pending' ? { status: 'PENDING' } : {}) },
        })
      ).data.data,
  });
  const document = useLicenseDocument(ownerId, 'admin');
  const [selected, setSelected] = useState<LicenseUpdate | null>(null),
    [reason, setReason] = useState('');
  const [reviewedDocument, setReviewedDocument] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  async function download(record: LicenseUpdate) {
    if ((await document.download(record)) && currentOwner.current === ownerId) setReviewedDocument(record.id);
  }
  async function decide(decision: 'APPROVED' | 'REJECTED') {
    if (!selected || busy || reason.trim().length < 10) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.post(`/admin/license-updates/${encodeURIComponent(selected.id)}/decision`, {
        decision,
        reason: reason.trim(),
      });
      if (currentOwner.current !== ownerId) return;
      setSelected(null);
      setNotice(`License update ${decision.toLowerCase()}. The decision is recorded in its history.`);
      await query.refetch();
      onChanged();
    } catch (cause) {
      if (currentOwner.current === ownerId) {
        setError(getApiErrorMessage(cause, 'The license decision could not be saved. Please reload and try again.'));
        await query.refetch();
      }
    } finally {
      if (currentOwner.current === ownerId) setBusy(false);
    }
  }
  return (
    <section className="space-y-5" aria-labelledby="admin-license-updates-heading">
      <div className="flex items-center gap-1">
        <h3 id="admin-license-updates-heading" className="font-display text-xl font-bold">
          License updates
        </h3>
        <HeaderRefreshAction label="Refresh license updates" busy={query.isLoading} onRefresh={query.refetch} />
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-brand-muted">
        Check the submitted PRC evidence before approving a renewal or record correction. Approval changes the
        credential only; it does not restore a suspended account.
      </p>
      <WorkspaceTabs
        label="License update views"
        value={view}
        onChange={(value) => {
          setView(value);
          setPage(1);
        }}
        tone="accentSoft"
        size="sm"
        items={[
          { value: 'pending', label: `Pending (${query.data?.pending ?? '…'})` },
          { value: 'history', label: 'All update history' },
        ]}
      />
      {(query.error || document.error) && (
        <p role="alert" className="text-sm text-status-error-text">
          {query.error || document.error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-brand-green">
          {notice}
        </p>
      )}
      {query.isLoading && !query.data && (
        <p role="status" className="text-sm text-brand-muted">
          Loading license updates…
        </p>
      )}
      {query.data && (
        <>
          <LicenseUpdateHistory
            rows={query.data.rows}
            admin
            busyId={document.busy}
            onDownload={(record) => void download(record)}
            onReview={(record) => {
              setSelected(record);
              setReason('');
              setError(null);
            }}
          />
          {query.data.totalPages > 1 && (
            <Pagination page={page} pageCount={query.data.totalPages} busy={query.isLoading} onPageChange={setPage} />
          )}
        </>
      )}
      {query.error && (
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Retry license updates
        </Button>
      )}
      <Modal
        isOpen={!!selected}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
        title="Verify license update"
      >
        {selected && (
          <div className="space-y-5">
            <div>
              <p className="font-semibold">{selected.nutritionistProfile?.user.name}</p>
              <p className="mt-1 break-all text-xs text-brand-muted">{selected.nutritionistProfile?.user.email}</p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-brand-muted">Currently recorded</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {selected.previousLicenseNumber}
                  <br />
                  {licenseDate(selected.previousLicenseExpiry)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-brand-muted">Submitted {selected.purpose.toLowerCase()}</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {selected.proposedLicenseNumber}
                  <br />
                  {licenseDate(selected.proposedLicenseExpiry)}
                </dd>
              </div>
            </dl>
            <p className="text-sm leading-relaxed">{selected.submissionReason}</p>
            <div className="space-y-2">
              <Button variant="secondary" disabled={!!document.busy || busy} onClick={() => void download(selected)}>
                Download license document
              </Button>
              <p className="text-xs text-brand-muted">
                {reviewedDocument === selected.id
                  ? 'Document downloaded. Verify its identity, license number and expiry before approving.'
                  : 'Download and check the evidence to enable approval.'}
              </p>
            </div>
            <label className="block space-y-2 text-sm font-semibold">
              <span>Administrator decision reason</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={busy}
                minLength={10}
                maxLength={1500}
                rows={3}
                className="w-full rounded-xl border border-brand-border bg-brand-surface p-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-status-error-text">
                {error}
              </p>
            )}
            {document.error && (
              <p role="alert" className="text-sm text-status-error-text">
                {document.error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={busy || reason.trim().length < 10 || reviewedDocument !== selected.id || !!document.busy}
                onClick={() => void decide('APPROVED')}
              >
                Approve license update
              </Button>
              <Button
                variant="secondary"
                disabled={busy || reason.trim().length < 10}
                onClick={() => void decide('REJECTED')}
              >
                Reject update
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
