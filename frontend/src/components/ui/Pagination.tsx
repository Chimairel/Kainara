import type { ReactNode } from 'react';

export default function Pagination({
  page,
  pageCount,
  onPageChange,
  busy = false,
  label = 'Pages',
  detail,
  showNumbers = false,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  busy?: boolean;
  label?: string;
  detail?: ReactNode;
  showNumbers?: boolean;
}) {
  if (pageCount <= 1) return null;
  const numbers = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);
  return (
    <nav
      aria-label={label}
      aria-busy={busy}
      className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold"
    >
      <button
        type="button"
        disabled={busy || page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="min-h-11 rounded-xl border border-brand-border bg-brand-surface px-4 text-brand-text transition hover:border-brand-green disabled:opacity-40"
      >
        Previous
      </button>
      <span role="status" className="text-brand-muted">
        Page {page} of {pageCount}
        {detail}
      </span>
      {showNumbers &&
        numbers.map((value, index) => (
          <span key={value} className="inline-flex items-center gap-2">
            {index > 0 && value - numbers[index - 1] > 1 && <span aria-hidden="true">…</span>}
            <button
              type="button"
              aria-label={`Go to page ${value}`}
              aria-current={value === page ? 'page' : undefined}
              disabled={busy}
              onClick={() => onPageChange(value)}
              className={`min-h-11 min-w-11 rounded-xl border px-3 ${page === value ? 'border-brand-green bg-brand-green text-white' : 'border-brand-border text-brand-text'} disabled:opacity-40`}
            >
              {value}
            </button>
          </span>
        ))}
      <button
        type="button"
        disabled={busy || page >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        className="min-h-11 rounded-xl border border-brand-border bg-brand-surface px-4 text-brand-text transition hover:border-brand-green disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}
