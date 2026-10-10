'use client';

import { Fragment, useEffect, useRef, type ReactNode } from 'react';

export type WorkspaceTableColumn<Row> = {
  key: string;
  header: ReactNode;
  cell?: (row: Row, index: number) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  sortDirection?: 'ascending' | 'descending';
};

type Props<Row> = {
  label: string;
  rows: Row[];
  columns: WorkspaceTableColumn<Row>[];
  rowKey: (row: Row, index: number) => string;
  cells?: (row: Row, index: number) => ReactNode[];
  rowClassName?: (row: Row, index: number) => string;
  expandedContent?: (row: Row) => ReactNode;
  emptyMessage?: string;
  footer?: ReactNode;
};

/** Shared grocery-style surface; callers own columns, selection, sorting and data. */
export default function WorkspaceTable<Row>({
  label,
  rows,
  columns,
  rowKey,
  cells,
  rowClassName,
  expandedContent,
  emptyMessage = 'No records match these filters.',
  footer,
}: Props<Row>) {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      if (element.clientWidth > 0) element.style.setProperty('--workspace-table-width', `${element.clientWidth}px`);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-brand-border/70 bg-brand-surface shadow-xs">
      <div
        ref={viewport}
        className="max-h-[720px] overflow-auto scrollbar-thin"
        role="region"
        aria-label={`${label} scroll area`}
        tabIndex={0}
      >
        <table className="w-full border-collapse text-left text-xs" aria-label={label}>
          <thead className="sticky top-0 z-20 select-none border-b border-brand-border/70 bg-brand-surface/95 text-[11px] font-bold text-brand-muted backdrop-blur-md dark:bg-[#0e271f]/95">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sortDirection}
                  className={`border-r border-brand-border/40 px-3 py-3 text-brand-text last:border-r-0 ${column.headerClassName ?? ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/40 font-medium">
            {rows.map((row, index) => {
              const details = expandedContent?.(row);
              const rowCells = cells?.(row, index);
              return (
                <Fragment key={rowKey(row, index)}>
                  <tr
                    className={`group transition-colors duration-100 ${rowClassName?.(row, index) ?? (index % 2 === 0 ? 'bg-brand-surface hover:bg-brand-green/[0.035] dark:hover:bg-white/[0.025]' : 'bg-brand-bgAlt/25 hover:bg-brand-green/[0.035] dark:hover:bg-white/[0.025]')}`}
                  >
                    {columns.map((column, columnIndex) => (
                      <td
                        key={column.key}
                        className={`break-words border-r border-brand-border/30 px-3 py-2.5 align-middle last:border-r-0 ${column.cellClassName ?? ''}`}
                      >
                        {rowCells ? rowCells[columnIndex] : column.cell?.(row, index)}
                      </td>
                    ))}
                  </tr>
                  {details != null && (
                    <tr>
                      <td colSpan={columns.length} className="p-2 sm:p-4">
                        <div
                          className="sticky left-0 max-w-full"
                          style={{ width: 'calc(var(--workspace-table-width, 100%) - 2rem)' }}
                        >
                          {details}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-sm text-brand-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer != null && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-border/70 bg-brand-bgAlt/30 px-4 py-2.5 text-[11px] font-semibold text-brand-muted">
          {footer}
        </div>
      )}
    </div>
  );
}
