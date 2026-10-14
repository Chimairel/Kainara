'use client';
import type { ReactNode } from 'react';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import Button from '@/components/ui/Button';
import { ReviewDocumentPage } from './RndQueueDocument';

/** A decision is drafted on paper; only the explicit submit button records it. */
export default function ReviewDecisionPage({ action, title, page, onClose, onConfirm, note, onNoteChange, busy,
  error, required = true, readOnly = false, approvalLabel = 'Confirm approval', rejectionLabel = 'Confirm rejection', children }: {
  action: 'approve' | 'reject'; title: string; page: number; onClose: () => void; onConfirm: () => void;
  note: string; onNoteChange: (note: string) => void; busy: boolean; error?: string | null; required?: boolean;
  approvalLabel?: string; rejectionLabel?: string; children?: ReactNode;
  readOnly?: boolean;
}) {
  const reject = action === 'reject';
  const minimum = required ? 10 : reject ? 1 : 0;
  return <ReviewDocumentPage title={title} page={page} subtitle={readOnly ? 'Recorded decision · read only' : 'Draft · not submitted'}
    footer={readOnly ? 'Saved approval rationale' : 'Your decision is recorded only after you confirm it.'}>
    <form className="space-y-6" onSubmit={event => { event.preventDefault(); if (!readOnly && !busy && note.trim().length >= minimum) onConfirm(); }}>
      <p className="text-sm leading-6 text-[#5a746a]">{reject ? 'Explain the concern and any suggested corrections.' : 'Record your reasoning for approving this exact meal and serving.'}</p>
      {error && <FeedbackNotice variant="inline">{error}</FeedbackNotice>}
      {children}
      <label className="block text-sm font-semibold">
        {reject ? 'Rejection reason' : 'Review rationale'}
        <textarea value={note} onChange={event => onNoteChange(event.target.value)} disabled={busy} readOnly={readOnly}
          required={minimum > 0} minLength={minimum} maxLength={1000} rows={8}
          placeholder="Explain your decision and supporting observations."
          className="mt-2 block w-full rounded-xl border border-[#dce4e0] bg-[#faf8f5] p-4 text-base font-normal leading-7 text-[#0d2820] outline-none focus:ring-2 focus:ring-inset focus:ring-[#08705b]" />
      </label>
      <p className="text-xs text-[#5a746a]">Notes do not change the ingredients or nutrition.{minimum === 10 ? ' Write at least 10 characters.' : ''}</p>
      {!readOnly && <div className="flex flex-wrap gap-3 border-t border-[#dce4e0] pt-5">
        <Button type="submit" variant={reject ? 'danger' : 'primary'} disabled={busy || note.trim().length < minimum} isLoading={busy}>
          {reject ? rejectionLabel : approvalLabel}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
      </div>}
    </form>
  </ReviewDocumentPage>;
}
