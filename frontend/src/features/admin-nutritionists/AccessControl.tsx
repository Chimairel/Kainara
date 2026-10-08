'use client';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { professionalAccessLabel, type NutritionistRow } from './model';

export default function AccessControl({
  professional,
  busy,
  onChange,
}: {
  professional: NutritionistRow;
  busy: boolean;
  onChange: (suspended: boolean, reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const revoked = !!professional.user.isSuspended;
  if (professional.user.role && professional.user.role !== 'NUTRITIONIST') {
    return (
      <div className="mt-3 border-t border-brand-border pt-3 text-xs text-brand-muted">
        <p className="font-bold">{professionalAccessLabel(professional)}</p>
        <p className="mt-2">
          Retained professional record. Professional access requires application verification. Account access is managed
          in the Accounts tab.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-3 border-t border-brand-border pt-3">
      <p className={`text-xs font-bold ${revoked ? 'text-red-500' : 'text-brand-green'}`}>
        {professionalAccessLabel(professional)}
      </p>
      {revoked && professional.user.suspensionReason && (
        <p className="mt-1 text-xs text-brand-muted">{professional.user.suspensionReason}</p>
      )}
      <Button variant="secondary" className="mt-2" disabled={busy} onClick={() => setOpen(true)}>
        {revoked ? 'Restore access' : 'Revoke access'}
      </Button>
      <Modal
        isOpen={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={revoked ? 'Restore RND access' : 'Revoke RND access'}
        description="Past reviews and audit records are preserved."
      >
        <p>
          {professional.user.name}
          {revoked
            ? ' will be able to sign in again. Review access still requires current credentials.'
            : ' will be signed out and unable to use the RND workspace.'}
        </p>
        {!revoked && (
          <label className="mt-4 block">
            Reason
            <textarea
              maxLength={240}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-3"
            />
          </label>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || (!revoked && reason.trim().length < 3)}
            onClick={async () => {
              await onChange(!revoked, reason.trim());
              setOpen(false);
              setReason('');
            }}
          >
            {busy ? 'Saving…' : revoked ? 'Restore access' : 'Confirm revocation'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
