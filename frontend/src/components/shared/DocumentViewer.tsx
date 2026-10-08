'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Menu,
  Minimize2,
  Minus,
  Plus,
  Shrink,
  StretchHorizontal,
} from 'lucide-react';

export interface DocumentViewerProps {
  title: string;
  /** Pages declare data-document-page. Change contentKey when the displayed record changes. */
  contentKey: string;
  children: React.ReactNode;
  versionControl?: React.ReactNode;
  actions?: React.ReactNode;
  onDownload?: () => void;
  downloading?: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  paperWidth?: number;
}

/** HTML document reader. The caller supplies PDF export independently of this preview. */
export default function DocumentViewer({
  title,
  contentKey,
  children,
  versionControl,
  actions,
  onDownload,
  downloading = false,
  expanded,
  onExpandedChange,
  paperWidth = 794,
}: DocumentViewerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const scrollPosition = useRef({ top: 0, left: 0 });
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [scale, setScale] = useState(1);
  const previousScale = useRef(1);
  const [fit, setFit] = useState<'width' | 'page' | null>('width');
  const pages = () => Array.from(paperRef.current?.querySelectorAll<HTMLElement>('[data-document-page]') ?? []);
  const jump = (index: number) => {
    const canvas = canvasRef.current;
    const target = pages()[index - 1];
    if (!canvas || !target) return;
    canvas.scrollTop = Math.max(
      0,
      canvas.scrollTop + target.getBoundingClientRect().top - canvas.getBoundingClientRect().top - 16
    );
    scrollPosition.current.top = canvas.scrollTop;
    setPage(index);
  };
  useLayoutEffect(() => {
    scrollPosition.current = { top: 0, left: 0 };
    setPage(1);
    if (canvasRef.current) {
      canvasRef.current.scrollTop = 0;
      canvasRef.current.scrollLeft = 0;
    }
  }, [contentKey]);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const paper = paperRef.current;
    if (!canvas || !paper) return;
    canvas.scrollTop = scrollPosition.current.top;
    canvas.scrollLeft = scrollPosition.current.left;
    const measure = () => {
      const sheets = Array.from(paper.querySelectorAll<HTMLElement>('[data-document-page]'));
      setPageCount(Math.max(1, sheets.length));
      if (!fit || !canvas.clientWidth) return;
      const widthScale = (canvas.clientWidth - 32) / paperWidth;
      const heightScale = (canvas.clientHeight - 32) / (sheets[0]?.offsetHeight || 1123);
      setScale(Math.max(0.1, Math.min(1, widthScale, fit === 'page' ? heightScale : 1)));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(canvas);
    observer?.observe(paper);
    return () => observer?.disconnect();
  }, [contentKey, expanded, outlineOpen, fit, paperWidth]);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && previousScale.current !== scale) {
      const ratio = scale / previousScale.current;
      canvas.scrollTop *= ratio;
      canvas.scrollLeft *= ratio;
      scrollPosition.current = { top: canvas.scrollTop, left: canvas.scrollLeft };
    }
    previousScale.current = scale;
  }, [scale]);
  const rememberScroll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    scrollPosition.current = { top: canvas.scrollTop, left: canvas.scrollLeft };
    const anchor = canvas.getBoundingClientRect().top + Math.min(100, canvas.clientHeight / 3);
    let current = 1;
    pages().forEach((sheet, index) => {
      if (sheet.getBoundingClientRect().top <= anchor) current = index + 1;
    });
    setPage(current);
  };
  const zoom = (value: number) => {
    setFit(null);
    setScale(Math.max(0.1, Math.min(2, value)));
  };
  const iconButton =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white disabled:opacity-40';
  const reader = (
    <div
      ref={viewerRef}
      role="region"
      aria-label="Document viewer"
      className={`relative isolate flex min-w-0 flex-col overflow-hidden bg-[#323639] text-white ${expanded ? 'h-full w-full' : 'z-0 h-[clamp(24rem,calc(100dvh-20rem),46rem)] w-full rounded-2xl border border-white/10 shadow-xl'}`}
    >
      <header className="relative z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#202124] p-2 sm:px-4">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
          <button
            type="button"
            className={iconButton}
            aria-label="Document pages"
            aria-expanded={outlineOpen}
            onClick={() => setOutlineOpen(!outlineOpen)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="min-w-0 truncate text-sm font-semibold" title={title}>
            {title}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {actions}
          {onDownload && (
            <button
              type="button"
              className={iconButton}
              aria-label="Download PDF"
              disabled={downloading}
              onClick={onDownload}
            >
              {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            </button>
          )}
          <button
            ref={expanded ? undefined : expandRef}
            type="button"
            className={iconButton}
            aria-label={expanded ? 'Exit fullscreen' : 'Expand document'}
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
          {versionControl && <div className="min-w-0 max-w-full flex-1 basis-48 sm:max-w-sm">{versionControl}</div>}
          <div className="flex max-w-full flex-wrap items-center gap-1 text-xs">
            <button
              type="button"
              className={iconButton}
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => jump(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span aria-live="polite" aria-atomic="true" className="font-mono">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              className={iconButton}
              aria-label="Next page"
              disabled={page >= pageCount}
              onClick={() => jump(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label="Zoom out"
              disabled={scale <= 0.1}
              onClick={() => zoom(scale - 0.1)}
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="h-10 rounded-lg px-2 font-mono hover:bg-white/10 focus-visible:outline"
              aria-label="Reset zoom to 100%"
              onClick={() => zoom(1)}
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label="Zoom in"
              disabled={scale >= 2}
              onClick={() => zoom(scale + 0.1)}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label="Fit to width"
              aria-pressed={fit === 'width'}
              onClick={() => setFit('width')}
            >
              <StretchHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label="Fit to page"
              aria-pressed={fit === 'page'}
              onClick={() => setFit('page')}
            >
              <Shrink className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {outlineOpen && (
          <aside
            aria-label="Document page navigation"
            className="absolute inset-y-0 left-0 z-10 w-36 overflow-y-auto border-r border-white/10 bg-[#202124] p-3 sm:static sm:shrink-0"
          >
            <p className="mb-3 text-xs font-semibold text-slate-300">Pages</p>
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                aria-current={page === index + 1 ? 'page' : undefined}
                className="mb-2 block min-h-11 w-full rounded-lg border border-white/20 px-3 text-left text-sm hover:bg-white/10 aria-[current=page]:bg-white/20"
                onClick={() => {
                  jump(index + 1);
                  setOutlineOpen(false);
                }}
              >
                Page {index + 1}
              </button>
            ))}
          </aside>
        )}
        <div
          ref={canvasRef}
          role="region"
          aria-label="Document pages scroll area"
          tabIndex={0}
          onScroll={rememberScroll}
          className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <div ref={paperRef} style={{ width: paperWidth, zoom: scale }} className="mx-auto origin-top">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <Dialog.Root open={expanded} onOpenChange={onExpandedChange}>
      {!expanded && reader}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            if (viewerRef.current?.querySelector('[role="combobox"][aria-expanded="true"]')) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            expandRef.current?.focus();
          }}
          className="fixed inset-0 z-[81] h-[100dvh] w-screen outline-none"
        >
          <Dialog.Title className="sr-only">{title} — fullscreen</Dialog.Title>
          {expanded && reader}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
