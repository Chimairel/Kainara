'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import NativeSelect from '@/components/ui/NativeSelect';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import { useCredentialStatus } from './NutritionistCredentialGate';
import LicenseUpdateHistory from './LicenseUpdateHistory';
import { useLicenseDocument } from './useLicenseDocument';
import { licenseDate, type CredentialStatus, type LicenseUpdatesPage } from './types';

export default function RndLicenseUpdates() {
  const ownerId = useAuth().user?.userId;
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const status = useCredentialStatus();
  const [page, setPage] = useState(1);
  const query = useSessionQuery<LicenseUpdatesPage>({
    ownerId,
    resource: `rnd-license-updates:${page}`,
    pollIntervalMs: 60000,
    errorMessage: 'Your license updates could not be loaded. Please try again.',
    fetcher: async () => (await api.get('/nutritionist/license-updates', { params: { page } })).data.data,
  });
  const document = useLicenseDocument(ownerId, 'nutritionist');
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <section id="license-update" className="scroll-mt-6 space-y-5" aria-labelledby="license-updates-heading">
      <div className="space-y-2">
        <h2 id="license-updates-heading" className="font-display text-xl font-bold">
          License renewal or correction
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-brand-muted">
          Submit your current PRC document when renewing your license or correcting a recorded detail. An administrator
          checks the evidence before changing your credential.
        </p>
        {status?.data && (
          <p className={`text-sm ${status.data.eligible ? 'text-brand-muted' : 'text-status-warning-text'}`}>
            {status.data.eligible ? 'Current license valid through' : 'Recorded license expiry:'}{' '}
            {licenseDate(status.data.expiryDate)}.{!status.data.eligible && ' Review actions are unavailable.'}
          </p>
        )}
      </div>
      {(status?.error || query.error || document.error) && (
        <FeedbackNotice variant="inline">{status?.error || query.error || document.error}</FeedbackNotice>
      )}
      {notice && (
        <p role="status" className="text-sm text-brand-green">
          {notice}
        </p>
      )}
      {query.isLoading && !query.data && (
        <p role="status" className="text-sm text-brand-muted">
          Loading license update history…
        </p>
      )}
      {!!query.data?.pending && (
        <p role="status" className="rounded-xl bg-brand-bgAlt p-4 text-sm leading-relaxed">
          Your update is awaiting administrator review. Your currently approved credential stays unchanged. If it
          expires, review access remains blocked until a current update is approved.
        </p>
      )}
      {status?.data?.canSubmitUpdate && query.data && !query.data.pending && (
        <LicenseUpdateForm
          key={ownerId}
          status={status.data}
          onSubmitted={async () => {
            if (currentOwner.current !== ownerId) return;
            setNotice('License update submitted for administrator review.');
            await query.refetch();
            await status.refetch();
          }}
        />
      )}
      {query.data && (
        <>
          <LicenseUpdateHistory
            rows={query.data.rows}
            busyId={document.busy}
            onDownload={(record) => void document.download(record)}
          />
          {query.data.totalPages > 1 && (
            <Pagination page={page} pageCount={query.data.totalPages} busy={query.isLoading} onPageChange={setPage} />
          )}
        </>
      )}
      {query.error && (
        <Button variant="secondary" onClick={() => void query.refetch()} disabled={query.isLoading}>
          Retry license history
        </Button>
      )}
    </section>
  );
}
function LicenseUpdateForm({ status, onSubmitted }: { status: CredentialStatus; onSubmitted: () => Promise<void> }) {
  const ownerId = useAuth().user?.userId;
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const file = data.get('document');
    if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024) {
      setError('Choose one PDF, JPG or PNG license document up to 4 MB.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/nutritionist/license-updates', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (currentOwner.current !== ownerId) return;
      await onSubmitted();
    } catch (cause) {
      if (currentOwner.current === ownerId)
        setError(getApiErrorMessage(cause, 'The license update could not be submitted. Please try again.'));
    } finally {
      if (currentOwner.current === ownerId) setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-5">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">
          <span>Update type</span>
          <NativeSelect name="purpose" defaultValue="RENEWAL">
            <option value="RENEWAL">License renewal</option>
            <option value="CORRECTION">Correct recorded details</option>
          </NativeSelect>
        </label>
        <Input
          label="PRC license number"
          name="licenseNumber"
          defaultValue={status.licenseNumber ?? ''}
          required
          maxLength={80}
        />
        <Input label="Correct license expiry" name="expiryDate" type="date" required />
        <label className="space-y-2 text-sm font-semibold">
          <span>Current license document</span>
          <input
            type="file"
            name="document"
            accept="application/pdf,image/jpeg,image/png"
            required
            className="block min-h-11 w-full rounded-xl border border-brand-border p-2 text-xs text-brand-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-bgAlt file:px-3 file:py-2 file:font-semibold file:text-brand-text"
          />
          <span className="block text-xs font-normal text-brand-muted">
            PDF, JPG or PNG · up to 4 MB · visible to you and administrators.
          </span>
        </label>
        <label className="space-y-2 text-sm font-semibold sm:col-span-2">
          <span>Reason for the update</span>
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={1500}
            rows={3}
            className="w-full rounded-xl border border-brand-border bg-brand-surface p-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          />
        </label>
        <label className="flex items-start gap-2 text-sm font-normal leading-relaxed sm:col-span-2">
          <input name="consentAccepted" type="checkbox" value="true" required className="mt-1 accent-brand-green" />I
          confirm these details reflect my current PRC credential and consent to administrator review of the uploaded
          document.
        </label>
      </fieldset>
      {error && <FeedbackNotice variant="inline">{error}</FeedbackNotice>}
      <Button type="submit" isLoading={busy}>
        Submit license update
      </Button>
    </form>
  );
}
