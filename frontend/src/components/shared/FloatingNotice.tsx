'use client';

import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function FloatingNotice({
  title,
  kind,
  onClose,
  children,
}: {
  title: string;
  kind: 'auth' | 'install' | 'membership';
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  return createPortal(
    <aside
      role="region"
      aria-labelledby={titleId}
      data-floating-notice={kind}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-[60] w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-brand-border bg-brand-surface p-4 text-sm text-brand-text shadow-xl md:bottom-4 md:right-4"
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const touch = event.changedTouches[0];
        touchStart.current = null;
        if (start && touch && Math.abs(touch.clientX - start.x) > 70 && Math.abs(touch.clientY - start.y) < 50)
          onClose();
      }}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 id={titleId} className="font-bold" aria-live="polite">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Dismiss ${title}`}
          className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-brand-muted hover:bg-brand-bgAlt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2 text-xs leading-5">{children}</div>
    </aside>,
    document.body
  );
}
