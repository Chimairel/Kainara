'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { useAuth } from '@/hooks/useAuth';
import NaraLauncher from './NaraLauncher';
import { useMemberAssistant, type MemberAssistantModel } from './useMemberAssistant';
import { preserveComposerEscape } from './assistant-composer.policy';

const AssistantConversation = dynamic(() => import('./AssistantConversation'));

function restoreLauncherFocus(id: string) {
  const trigger = document.getElementById(id);
  if (!trigger) return;
  trigger.setAttribute('data-nara-restoring-focus', '');
  trigger.focus({ preventScroll: true });
  trigger.removeAttribute('data-nara-restoring-focus');
}

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
  const { user } = useAuth();
  const model = useMemberAssistant(ready, user?.userId);
  const { open, setOpen } = model;
  const titleId = useId();
  const [docked, setDocked] = useState(false);
  const [width, setWidth] = useState(420);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !model.open) restoreLauncherFocus(`${titleId}-trigger`);
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
        restoreLauncherFocus(`${titleId}-trigger`);
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [docked, open, setOpen, titleId]);
  const opened = model.enabled && model.open;
  return <div className="portal-shell flex h-screen w-full p-0 md:p-4">
    {children}
    {model.enabled && !opened ? <NaraLauncher id={`${titleId}-trigger`} panelId={`${titleId}-panel`}
      onOpen={() => { model.setOpen(true); model.refreshAllowance(); }} /> : null}
    <AnimatePresence initial={false}>
      {opened && docked ? <DesktopAssistantPanel key="desktop-assistant" model={model} titleId={titleId} member={user ?? undefined} width={width} onWidthChange={setWidth} /> : null}
    </AnimatePresence>
    <Dialog.Root open={opened && !docked} onOpenChange={model.setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-brand-bg" />
        <Dialog.Content id={`${titleId}-panel`} className="fixed inset-0 z-[71] h-dvh outline-none" aria-describedby={undefined} onEscapeKeyDown={preserveComposerEscape}>
          <AssistantConversation model={model} titleId={titleId} member={user ?? undefined} modal />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
