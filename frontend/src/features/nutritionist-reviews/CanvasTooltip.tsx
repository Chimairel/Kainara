'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** Canvas controls share the sidebar's short hover/focus labels, without native-title delay. */
export default function CanvasTooltip({ label, placement = 'top', align = 'center', children }: {
  label: string; placement?: 'top' | 'bottom'; align?: 'start' | 'center' | 'end'; children: (descriptionId: string | undefined) => ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      if (!trigger.current?.contains(event.target as Node) ||
        trigger.current.querySelector('[role="combobox"][aria-expanded="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
    };
    // Run before Radix's document capture listener, so dismissing a hint keeps fullscreen open.
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [open]);
  return <span ref={trigger} className="relative inline-flex shrink-0"
    onPointerEnter={event => { if (event.pointerType !== 'touch') setOpen(true); }}
    onPointerLeave={() => setOpen(false)}
    onFocusCapture={event => setOpen(event.currentTarget.contains(event.target))}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onClickCapture={() => setOpen(false)}
    onKeyDownCapture={event => {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) setOpen(false);
    }}>
    {children(open ? id : undefined)}
    {open && <span id={id} role="tooltip"
      className={`pointer-events-none absolute z-50 w-max max-w-60 rounded-xl border border-[#173e33] bg-[#071914]/95 px-3 py-2 text-center font-display text-xs font-semibold leading-4 text-white shadow-[0_12px_34px_rgba(0,0,0,0.38)] ${align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'} ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
      {label}
    </span>}
  </span>;
}
