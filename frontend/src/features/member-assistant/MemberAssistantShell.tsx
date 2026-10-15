'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { MessageSquare } from '@/components/ui/icons';
import { useMemberAssistant, type MemberAssistantModel } from './useMemberAssistant';

const AssistantConversation = dynamic(() => import('./AssistantConversation'));

function DesktopAssistantPanel({ model, titleId }: { model: MemberAssistantModel; titleId: string }) {
  const present = useIsPresent();
  const reducedMotion = useReducedMotion();
  return <motion.aside id={`${titleId}-panel`} aria-labelledby={titleId} aria-hidden={!present} inert={!present}
    initial={reducedMotion ? false : { x: '100%' }}
    animate={{ x: 0 }}
    exit={{ x: reducedMotion ? 0 : '100%', transition: { duration: reducedMotion ? 0 : 0.18, ease: [0.4, 0, 1, 1] } }}
    transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
    className="fixed bottom-0 right-0 top-[88px] z-20 w-[420px] overflow-hidden rounded-tl-[28px] border-l border-t border-brand-border shadow-card-lg">
    <AssistantConversation model={model} titleId={titleId} />
  </motion.aside>;
}

export default function MemberAssistantShell({ ready, children }: { ready: boolean; children: ReactNode }) {
  const model = useMemberAssistant(ready);
  const { open, setOpen } = model;
  const titleId = useId();
  const [docked, setDocked] = useState(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !model.open) document.getElementById(`${titleId}-trigger`)?.focus();
    wasOpen.current = model.open;
  }, [model.open, titleId]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)');
    const update = () => setDocked(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!docked || !open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        setOpen(false);
        document.getElementById(`${titleId}-trigger`)?.focus();
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [docked, open, setOpen, titleId]);
  const opened = model.enabled && model.open;
  return <div className="portal-shell flex h-screen w-full p-0 md:p-4">
    {children}
    {model.enabled && !opened ? <button id={`${titleId}-trigger`} type="button" aria-label="Open assistant" aria-expanded={false} aria-controls={`${titleId}-panel`}
      title="Open assistant" onClick={() => { model.setOpen(true); model.refreshAllowance(); }}
      className="fixed bottom-[calc(100px+env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent text-[#071914] shadow-card-lg transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green md:bottom-7 md:right-7 motion-reduce:transform-none">
      <MessageSquare className="h-6 w-6" />
    </button> : null}
    <AnimatePresence initial={false}>
      {opened && docked ? <DesktopAssistantPanel key="desktop-assistant" model={model} titleId={titleId} /> : null}
    </AnimatePresence>
    <Dialog.Root open={opened && !docked} onOpenChange={model.setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-brand-bg" />
        <Dialog.Content id={`${titleId}-panel`} className="fixed inset-0 z-[71] h-dvh outline-none" aria-describedby={undefined}>
          <AssistantConversation model={model} titleId={titleId} modal />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
