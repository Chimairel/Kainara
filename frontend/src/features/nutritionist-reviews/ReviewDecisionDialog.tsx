'use client';

import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

/** Shared confirmation form; the dock itself never contains clinical input fields. */
export default function ReviewDecisionDialog({
  action,
  onClose,
  onConfirm,
  note,
  onNoteChange,
  busy,
  error,
  required = false,
  approvalLabel = 'Confirm approval',
  children,
}: {
  action: 'approve' | 'reject' | null;
  onClose: () => void;
  onConfirm: () => void;
  note: string;
  onNoteChange: (note: string) => void;
  busy: boolean;
  error?: string | null;
  required?: boolean;
  approvalLabel?: string;
  children?: React.ReactNode;
}) {
  const reject = action === 'reject';
  const needsNote = reject || required;
  return (
    <Modal
      isOpen={action !== null}
      onClose={() => {
        if (!busy) onClose();
      }}
      layer="canvas"
      title={reject ? 'Reject this meal?' : 'Approve this meal?'}
      description={
        reject
          ? 'Record the concern and any suggested corrections.'
          : 'Confirm the exact recorded meal after reviewing its evidence.'
      }
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={reject ? 'danger' : 'primary'}
            disabled={busy || (needsNote && note.trim().length < (required ? 10 : 1))}
            isLoading={busy}
            onClick={onConfirm}
          >
            {reject ? 'Confirm rejection' : approvalLabel}
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-500">
          {error}
        </p>
      )}
      {children}
      <label className="block text-xs font-bold">
        {reject ? 'Rejection reason' : required ? 'Review rationale' : 'Member note (optional)'}
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          disabled={busy}
          maxLength={1000}
          rows={4}
          placeholder={
            needsNote
              ? 'Explain your decision and supporting observations.'
              : 'Advice for the member, such as reducing an ingredient if possible.'
          }
          className="mt-2 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm font-normal"
        />
      </label>
      <p className="mt-2 text-xs text-brand-muted">
        Notes do not change the saved ingredients or nutrition.{required ? ' At least 10 characters are required.' : ''}
      </p>
    </Modal>
  );
}
