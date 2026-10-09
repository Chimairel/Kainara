'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import DocumentViewer from '@/components/shared/DocumentViewer';
import Button from '@/components/ui/Button';

/** Queue adapter: inspection uses the shared reader; live decisions stay outside its zoomed paper. */
export default function RndQueueDocument({
  title,
  contentKey,
  expanded,
  onExpandedChange,
  onBack,
  actions,
  children,
  decision,
}: {
  title: string;
  contentKey: string;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  onBack: () => void;
  actions: ReactNode;
  children: ReactNode;
  decision?: ReactNode;
}) {
  const decisionRef = useRef<HTMLElement>(null);
  const focusDecisionAfterExit = useRef(false);
  const focusDecision = () => {
    decisionRef.current?.scrollIntoView?.({ block: 'nearest' });
    decisionRef.current?.focus();
  };
  return (
    <div className="space-y-4">
      <DocumentViewer
        title={title}
        contentKey={contentKey}
        expanded={expanded}
        onExpandedChange={onExpandedChange}
        onExitFullscreen={() => {
          if (!focusDecisionAfterExit.current) return;
          focusDecisionAfterExit.current = false;
          focusDecision();
        }}
        actions={
          <>
            <button
              type="button"
              aria-label="Back to queue"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-green/10 focus-visible:outline focus-visible:outline-brand-green"
              onClick={() => {
                onExpandedChange(false);
                onBack();
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {actions}
            {decision && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (expanded) {
                    focusDecisionAfterExit.current = true;
                    onExpandedChange(false);
                  } else focusDecision();
                }}
              >
                Review decision
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-8">{children}</div>
      </DocumentViewer>
      {decision && (
        <section
          ref={decisionRef}
          tabIndex={-1}
          aria-label="Review decision"
          className="space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
        >
          {decision}
        </section>
      )}
    </div>
  );
}

/** White paper stays readable in both portal themes, just like the nutrition report. */
export function ReviewDocumentPage({
  page,
  title,
  subtitle,
  children,
}: {
  page: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <article
      data-document-page={page}
      aria-label={title}
      className="flex min-h-[1123px] w-full flex-col bg-white p-14 text-[#0d2820] shadow-[0_4px_30px_rgba(0,0,0,0.35)] [overflow-wrap:anywhere]"
      style={
        {
          colorScheme: 'light',
          '--brand-bg': '#faf8f5',
          '--brand-bg-alt': '#f3efe8',
          '--brand-surface': '#ffffff',
          '--brand-border': '#dce4e0',
          '--brand-text': '#0d2820',
          '--brand-muted': '#5a746a',
          '--brand-green': '#08705b',
          '--status-verified-text': '#14532d',
        } as CSSProperties
      }
    >
      <header className="mb-6 border-b border-[#dce4e0] pb-4">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#1B4332]">
          KAINARA · RND review record
        </p>
        <h2 className="mt-1 text-[26px] font-bold tracking-tight text-[#1B4332]">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] text-slate-600">{subtitle}</p>}
      </header>
      <div className="flex-1 space-y-6">{children}</div>
      <footer className="mt-8 flex justify-between gap-4 border-t border-[#dce4e0] pt-3 text-xs text-slate-500">
        <span>Inspection record · approval is recorded separately</span>
        <span>Page {page}</span>
      </footer>
    </article>
  );
}
