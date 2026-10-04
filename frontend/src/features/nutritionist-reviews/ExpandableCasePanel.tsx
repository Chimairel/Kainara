'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function ExpandableCasePanel({
  children,
  className,
  contentClassName,
  expanded,
  onExpandedChange,
  canExpand = true,
  headerLeft,
  onBack,
  expandTitle = 'Full screen case inspection',
  expandAriaLabel = 'Expanded case view',
  backLabel = 'Back to queue',
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  canExpand?: boolean;
  headerLeft?: ReactNode;
  onBack?: () => void;
  expandTitle?: string;
  expandAriaLabel?: string;
  backLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExpandedChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [expanded, onExpandedChange]);

  const miniNavbar = (canExpand || headerLeft || onBack) ? (
    <header className="shrink-0 flex items-center justify-between min-h-14 border-b border-brand-border/80 bg-brand-surface px-4 py-2.5 sm:px-6 shadow-xs z-20">
      <div className="flex items-center gap-2.5 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            title={backLabel}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-border/80 bg-brand-surface text-brand-muted shadow-sm transition hover:border-brand-accent/60 hover:text-brand-accent md:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {headerLeft}
      </div>
      {canExpand && (
        <button
          type="button"
          onClick={() => onExpandedChange(true)}
          aria-label="Expand case details"
          title="Expand full screen"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-border/80 bg-brand-surface/95 text-brand-muted shadow-sm backdrop-blur-md transition-all hover:border-brand-accent/60 hover:bg-brand-surface hover:text-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </header>
  ) : null;

  if (expanded && mounted) {
    return (
      <>
        {/* Placeholder in document flow so original layout is preserved */}
        <div className="hidden" aria-hidden="true" />
        {createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={expandAriaLabel}
            className="fixed inset-0 z-[100] flex h-screen w-screen flex-col overflow-y-auto bg-brand-bg text-brand-text"
          >
            {/* Top Navigation Bar with Back Arrow */}
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-border/70 bg-brand-surface/95 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-6 md:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onExpandedChange(false)}
                  aria-label="Back to split view"
                  className="group inline-flex items-center gap-2.5 rounded-xl border border-brand-border/80 bg-brand-bgAlt/60 px-3.5 py-2 text-xs font-bold text-brand-text shadow-sm transition hover:border-brand-accent/60 hover:bg-brand-surface hover:text-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent"
                >
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                  <span>Back to split view</span>
                </button>
                <span className="hidden text-xs font-semibold text-brand-muted sm:inline-block">
                  {expandTitle}
                </span>
                {headerLeft && (
                  <div className="hidden sm:flex items-center pl-3 border-l border-brand-border/70">
                    {headerLeft}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <ThemeToggle size="sm" />
                <span className="hidden text-[11px] font-medium text-brand-muted md:inline-block">
                  Press <kbd className="rounded border border-brand-border bg-brand-bg px-1.5 py-0.5 font-mono text-[10px] text-brand-text">Esc</kbd> to exit
                </span>
                <button
                  type="button"
                  onClick={() => onExpandedChange(false)}
                  aria-label="Exit full screen"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-border/80 bg-brand-bgAlt/60 text-brand-muted transition hover:border-brand-accent/50 hover:bg-brand-surface hover:text-brand-text"
                  title="Exit full view (Esc)"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* Full Screen Content Canvas */}
            <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 md:p-8 custom-scrollbar">
              {children}
            </main>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className={className}>
      {miniNavbar}
      <div className={contentClassName ?? 'flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar sm:p-6'}>
        {children}
      </div>
    </div>
  );
}
