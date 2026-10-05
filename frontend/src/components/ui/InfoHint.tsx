'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/** Readable on hover, keyboard focus or tap, including inside a modal. */
export default function InfoHint({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
    position: 'absolute' | 'fixed';
  }>({ left: 8, top: 8, width: 304, position: 'fixed' });
  const cancelLeave = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }, []);
  const close = useCallback(() => {
    cancelLeave();
    pinned.current = false;
    setOpen(false);
  }, [cancelLeave]);
  const leave = () => {
    cancelLeave();
    leaveTimer.current = setTimeout(() => {
      if (!pinned.current && document.activeElement !== trigger.current) setOpen(false);
    }, 150);
  };
  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    []
  );

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(304, window.innerWidth - 16);
      const height = panel.current?.offsetHeight || 200;
      const below = rect.bottom + 8;
      const dialog = trigger.current?.closest<HTMLElement>('[role="dialog"]');
      const dialogRect = dialog?.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const top = Math.max(
        8,
        Math.min(below + height > window.innerHeight ? rect.top - height - 8 : below, window.innerHeight - height - 8)
      );
      setPosition({
        width,
        // Account for the modal's containing block and scroll offset.
        position: dialog ? 'absolute' : 'fixed',
        left: dialogRect ? left - dialogRect.left + dialog!.scrollLeft : left,
        top: dialogRect ? top - dialogRect.top + dialog!.scrollTop : top,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('pointerdown', outside);
    // Window capture runs before a parent modal's document Escape handler.
    window.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', escape, true);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        className="relative ml-1 inline-flex h-6 w-6 align-middle items-center justify-center rounded-full text-brand-muted hover:bg-brand-green/10 hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green after:absolute after:-inset-2.5 after:content-['']"
        onPointerEnter={(event) => {
          if (event.pointerType === 'touch') return;
          cancelLeave();
          setOpen(true);
        }}
        onPointerLeave={leave}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (!pinned.current) close();
        }}
        onClick={() => {
          cancelLeave();
          if (pinned.current) close();
          else {
            pinned.current = true;
            setOpen(true);
          }
        }}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {open &&
        trigger.current &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="tooltip"
            className="fixed z-[150] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-2xl border border-brand-border bg-brand-surface p-4 text-left text-xs leading-relaxed text-brand-text shadow-xl"
            style={position}
            onPointerEnter={cancelLeave}
            onPointerLeave={leave}
          >
            {children}
          </div>,
          trigger.current.closest('[role="dialog"]') ?? document.body
        )}
    </>
  );
}
