'use client';

import { useEffect, type ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

export default function ExpandableCasePanel({ children, className, expanded, onExpandedChange, canExpand = true }: {
  children: ReactNode;
  className?: string;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  canExpand?: boolean;
}) {
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExpandedChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded, onExpandedChange]);
  return <div className={`${className ?? ''} ${expanded ? 'fixed inset-0 z-50 !flex h-screen w-screen flex-col overflow-y-auto bg-brand-bg p-6' : ''}`}>
    {canExpand && <button type="button" onClick={() => onExpandedChange(!expanded)} aria-label={expanded ? 'Back to split view' : 'Expand case details'} className="mb-3 ml-auto flex items-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-brand-text">
      {expanded ? <><Minimize2 className="h-4 w-4" /> Back to split view</> : <><Maximize2 className="h-4 w-4" /> Expand</>}
    </button>}
    {children}
  </div>;
}
