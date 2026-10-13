'use client';
import { useEffect, useState, type ComponentProps } from 'react';
import Modal from '@/components/ui/Modal';
import CanvasToolButton from '@/features/nutritionist-reviews/CanvasToolButton';
import RndClarifications from './RndClarifications';

export default function ClarificationTool(props: ComponentProps<typeof RndClarifications>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setOpen(false), [props.userId, props.profileRevision, props.scopeKey]);
  if (!props.workspace?.enabled) return null;
  return <>
    <CanvasToolButton onClick={() => setOpen(true)} aria-expanded={open}>Questions</CanvasToolButton>
    <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} layer="canvas" size="xl"
      title="Member questions" description="Send questions or review submitted answers. Saved forms remain on the canvas.">
      <RndClarifications {...props} onBusyChange={setBusy} embedded
        onUpdated={async () => { await props.onUpdated(); setOpen(false); }} />
    </Modal>
  </>;
}
