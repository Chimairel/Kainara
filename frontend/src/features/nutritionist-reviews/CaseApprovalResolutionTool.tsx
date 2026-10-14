'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ConcernResolution from './ConcernResolution';
import type { DetailData } from './review-types';

export default function CaseApprovalResolutionTool({ concern, planId, canWrite, onUpdated }: {
  concern: NonNullable<DetailData['flagConcerns']>[number]; planId: string; canWrite: boolean; onUpdated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [note, setNote] = useState(''), [resolved, setResolved] = useState(false);
  async function submit() {
    if (!canWrite || busy || !resolved || note.trim().length < 20) return;
    setBusy(true);
    try {
      await api.post(`/nutritionist/case-approvals/${concern.approvalId}/resolve`, { mealPlanId: planId, expectedVersion: concern.expectedVersion, rationale: note });
      await onUpdated(); setOpen(false); toast.success('Concern resolved. Review and approve the current meal separately.');
    } catch (error) { toast.error(getApiErrorMessage(error, 'The concern could not be resolved. Reopen the current case.')); }
    finally { setBusy(false); }
  }
  return <><Button variant="secondary" size="sm" disabled={!canWrite} onClick={() => setOpen(true)}>Resolve flagged case</Button>
    <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} layer="canvas" size="xl" title="Resolve approval concern"
      footer={<Button disabled={busy || !resolved} isLoading={busy} onClick={() => void submit()}>Record resolution</Button>}>
      <ConcernResolution concern={concern} note={note} resolved={resolved} canWrite={canWrite && !busy}
        onNote={value => { setNote(value); setResolved(false); }} onResolve={() => setResolved(true)} />
    </Modal></>;
}
