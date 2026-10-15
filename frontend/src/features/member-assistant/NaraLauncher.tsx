'use client';

import { useEffect, useId, useState } from 'react';
import NaraPortrait from './NaraPortrait';

const greetings = [
  'Hello! Do you have something in mind?',
  'Hi! What’s on your mind?',
  'Thinking about your next meal? Let’s chat.',
  'Have a question about your nutrition guidance?',
  'Need a hand finding a meal? I’m here.',
];

export default function NaraLauncher({ id, panelId, onOpen }: { id: string; panelId: string; onOpen: () => void }) {
  const hintId = useId();
  const [hint, setHint] = useState({ open: false, index: -1 });
  const showHint = () => setHint(current => current.open ? current : { open: true, index: (current.index + 1) % greetings.length });
  const hideHint = () => setHint(current => ({ ...current, open: false }));
  useEffect(() => {
    if (!hint.open) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setHint(current => ({ ...current, open: false })); };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [hint.open]);
  return <span className="fixed bottom-[calc(100px+env(safe-area-inset-bottom))] right-5 z-40 inline-flex md:bottom-7 md:right-7"
    onPointerEnter={event => { if (event.pointerType !== 'touch') showHint(); }} onPointerLeave={hideHint}
    onFocusCapture={event => {
      if (!event.target.hasAttribute('data-nara-restoring-focus') && event.target.matches(':focus-visible')) showHint();
    }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) hideHint(); }}
    onPointerDownCapture={hideHint}
    onKeyDownCapture={event => { if (['Enter', ' ', 'Escape'].includes(event.key)) hideHint(); }}>
    <button id={id} type="button" aria-label="Open Nara chat" aria-expanded={false} aria-controls={panelId}
      aria-describedby={hint.open ? hintId : undefined}
      onClick={() => { hideHint(); onOpen(); }}
      className="flex h-24 w-24 items-center justify-center rounded-full border-0 bg-transparent transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green motion-reduce:transform-none">
      <span className="inline-flex drop-shadow-[0_4px_7px_rgba(7,25,20,0.22)]"><NaraPortrait mood={hint.open ? 'smile' : 'follow'} size={88} /></span>
    </button>
    {hint.open ? <span id={hintId} role="tooltip"
      className="pointer-events-none absolute bottom-full right-0 mb-2 w-max max-w-[min(240px,calc(100vw-40px))] rounded-xl border border-[#173e33] bg-[#071914]/95 px-3 py-2 text-center font-display text-xs font-semibold leading-4 text-white shadow-[0_12px_34px_rgba(0,0,0,0.38)]">
      {greetings[hint.index]}
      <span aria-hidden="true" className="absolute -bottom-1 right-10 h-2 w-2 rotate-45 border-b border-r border-[#173e33] bg-[#071914]" />
    </span> : null}
  </span>;
}
