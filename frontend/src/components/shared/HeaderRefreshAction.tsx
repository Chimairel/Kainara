'use client';

import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw } from 'lucide-react';

/** A tab's own query can place its action beside the enclosing workspace title. */
export const HeaderRefreshTarget = createContext<HTMLElement | null | undefined>(undefined);

export default function HeaderRefreshAction({
  label = 'Refresh',
  onRefresh,
  busy = false,
  disabled = false,
  active = true,
}: {
  label?: string;
  onRefresh: () => unknown;
  busy?: boolean;
  disabled?: boolean;
  active?: boolean;
}) {
  const target = useContext(HeaderRefreshTarget);
  if (!active || target === null) return null;
  const action = (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-busy={busy}
      disabled={disabled || busy}
      onClick={() => void onRefresh()}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-muted transition-colors hover:bg-brand-bg-alt hover:text-brand-text focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
    >
      <span className={busy ? 'motion-safe:animate-spin' : undefined}>
        <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </span>
    </button>
  );
  return target ? createPortal(action, target) : action;
}
