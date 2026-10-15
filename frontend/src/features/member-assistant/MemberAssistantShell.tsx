'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { useAuth } from '@/hooks/useAuth';
import NaraPortrait from './NaraPortrait';
import { useMemberAssistant, type MemberAssistantModel } from './useMemberAssistant';

const AssistantConversation = dynamic(() => import('./AssistantConversation'));

type MemberPortrait = { name: string; image?: string | null };
export function DesktopAssistantPanel({ model, titleId, member, width, onWidthChange }: {
  model: MemberAssistantModel; titleId: string; member?: MemberPortrait; width: number; onWidthChange: (width: number) => void;
}) {
  const present = useIsPresent();
  const reducedMotion = useReducedMotion();
  const [maxWidth, setMaxWidth] = useState(800);
  const drag = useRef<{ id: number; x: number; width: number } | null>(null);
  useEffect(() => {
    const resize = () => {
      // The exiting desktop panel can receive a resize after mobile takes over.
      const max = Math.max(360, Math.min(800, window.innerWidth - 320));
      setMaxWidth(max);
      if (width > max) onWidthChange(max);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [width, onWidthChange]);
  const resizeTo = (next: number) => onWidthChange(Math.min(maxWidth, Math.max(360, next)));
  return <motion.aside id={`${titleId}-panel`} aria-labelledby={titleId} aria-hidden={!present} inert={!present}
    initial={reducedMotion ? false : { x: '100%' }}
    animate={{ x: 0 }}
    exit={{ x: reducedMotion ? 0 : '100%', transition: { duration: reducedMotion ? 0 : 0.18, ease: [0.4, 0, 1, 1] } }}
    transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
    style={{ width }}
    className="fixed bottom-0 right-0 top-[88px] z-20 overflow-hidden rounded-tl-[28px] border-l border-t border-brand-border shadow-card-lg">
    <div role="separator" tabIndex={0} aria-label="Resize Nara chat" aria-orientation="vertical"
      aria-controls={`${titleId}-panel`} aria-valuemin={360} aria-valuemax={maxWidth} aria-valuenow={width}
      title="Drag to resize · Arrow keys to adjust"
      className="absolute inset-y-0 left-0 z-10 flex w-3 touch-none cursor-col-resize items-center justify-center outline-none hover:bg-brand-green/10 focus-visible:bg-brand-green/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault(); event.currentTarget.focus();
        drag.current = { id: event.pointerId, x: event.clientX, width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (drag.current && drag.current.id === event.pointerId) resizeTo(drag.current.width + drag.current.x - event.clientX);
      }}
      onPointerUp={event => {
        if (drag.current?.id !== event.pointerId) return;
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onLostPointerCapture={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        resizeTo(event.key === 'Home' ? 360 : event.key === 'End' ? maxWidth : width + (event.key === 'ArrowLeft' ? 24 : -24));
      }}>
      <span aria-hidden="true" className="h-10 w-1 rounded-full bg-brand-border" />
    </div>
    <AssistantConversation model={model} titleId={titleId} member={member} />
  </motion.aside>;
}

export default function MemberAssistantShell({ ready, children }: { ready: boolean; children: ReactNode }) {
  const model = useMemberAssistant(ready);
  const { user } = useAuth();
  const { open, setOpen } = model;
  const titleId = useId();
  const [docked, setDocked] = useState(false);
  const [width, setWidth] = useState(420);
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
    {model.enabled && !opened ? <button id={`${titleId}-trigger`} type="button" aria-label="Open Nara chat" aria-expanded={false} aria-controls={`${titleId}-panel`}
      title="Chat with Nara" onClick={() => { model.setOpen(true); model.refreshAllowance(); }}
      className="fixed bottom-[calc(100px+env(safe-area-inset-bottom))] right-5 z-40 flex h-24 w-24 items-center justify-center rounded-full border-0 bg-transparent transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green md:bottom-7 md:right-7 motion-reduce:transform-none">
      <span className="inline-flex drop-shadow-[0_4px_7px_rgba(7,25,20,0.22)]"><NaraPortrait mood="follow" size={88} /></span>
    </button> : null}
    <AnimatePresence initial={false}>
      {opened && docked ? <DesktopAssistantPanel key="desktop-assistant" model={model} titleId={titleId} member={user ?? undefined} width={width} onWidthChange={setWidth} /> : null}
    </AnimatePresence>
    <Dialog.Root open={opened && !docked} onOpenChange={model.setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-brand-bg" />
        <Dialog.Content id={`${titleId}-panel`} className="fixed inset-0 z-[71] h-dvh outline-none" aria-describedby={undefined}>
          <AssistantConversation model={model} titleId={titleId} member={user ?? undefined} modal />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
