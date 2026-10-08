'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
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
  actions,
  onDownload,
  downloading = false,
  expanded,
  onExpandedChange,
  paperWidth = 794,
}: DocumentViewerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mountedCanvas, setMountedCanvas] = useState<HTMLDivElement | null>(null);
  const attachCanvas = useCallback((node: HTMLDivElement | null) => {
    canvasRef.current = node;
    setMountedCanvas(node);
  }, []);
  const paperRef = useRef<HTMLDivElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const scrollPosition = useRef({ top: 0, left: 0 });
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [sheets, setSheets] = useState<Array<{ node: HTMLElement; height: number }>>([]);
  const [previewRevision, setPreviewRevision] = useState(0);
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
      const renderedSheets = Array.from(paper.querySelectorAll<HTMLElement>('[data-document-page]'));
      setPageCount(Math.max(1, renderedSheets.length));
      setSheets((previous) => {
        const next = renderedSheets.map((node) => ({ node, height: node.offsetHeight || 1123 }));
        return previous.length === next.length &&
          previous.every((sheet, index) => sheet.node === next[index].node && sheet.height === next[index].height)
          ? previous
          : next;
      });
      if (!fit || !canvas.clientWidth) return;
      const widthScale = (canvas.clientWidth - 32) / paperWidth;
      const heightScale = (canvas.clientHeight - 32) / (renderedSheets[page - 1]?.offsetHeight || 1123);
      setScale(Math.max(0.1, fit === 'page' ? Math.min(widthScale, heightScale) : widthScale));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(canvas);
    observer?.observe(paper);
    const mutations = new MutationObserver(() => {
      measure();
      setPreviewRevision((revision) => revision + 1);
    });
    mutations.observe(paper, { subtree: true, childList: true, characterData: true });
    return () => {
      observer?.disconnect();
      mutations.disconnect();
    };
  }, [contentKey, expanded, outlineOpen, fit, paperWidth, page, mountedCanvas]);
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
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-green/10 hover:text-brand-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-green disabled:pointer-events-none disabled:opacity-40';
  const reader = (
    <div
      role="region"
      aria-label="Document viewer"
      className={`relative isolate flex min-w-0 flex-col overflow-hidden border-[6px] border-b-[16px] border-brand-surface bg-brand-bgAlt text-brand-text ${expanded ? 'h-full w-full' : 'z-0 h-[clamp(24rem,calc(100dvh-20rem),46rem)] w-full rounded-2xl shadow-card-lg'}`}
    >
      <header className="relative z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-brand-border bg-brand-surface p-2 sm:px-4">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
          <button
            type="button"
            className={`${iconButton} aria-expanded:bg-brand-green/10 aria-expanded:text-brand-green`}
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
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 border-t border-brand-border pt-2">
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
              className="h-10 rounded-lg px-2 font-mono text-brand-text hover:bg-brand-green/10 focus-visible:outline focus-visible:outline-brand-green"
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
              aria-label={fit === 'page' ? 'Fit to width' : 'Fit to page'}
              title={fit === 'page' ? 'Fit to width' : 'Fit to page'}
              onClick={() => setFit(fit === 'page' ? 'width' : 'page')}
            >
              {fit === 'page' ? <Shrink className="h-4 w-4" /> : <StretchHorizontal className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {outlineOpen && (
          <aside
            aria-label="Document page navigation"
            className="custom-scrollbar w-28 shrink-0 overflow-y-auto border-r border-brand-border bg-brand-bg p-2 sm:w-48 sm:p-3"
          >
            <p className="mb-3 text-xs font-semibold text-brand-muted">Pages</p>
            {sheets.map((sheet, index) => (
              <button
                key={index}
                type="button"
                aria-current={page === index + 1 ? 'page' : undefined}
                aria-label={`Page ${index + 1}`}
                className="mb-3 flex min-h-11 w-full flex-col items-center gap-2 rounded-lg border-2 border-transparent p-1 text-sm hover:bg-brand-green/10 focus-visible:outline focus-visible:outline-brand-green aria-[current=page]:border-brand-accent aria-[current=page]:bg-brand-green/10 aria-[current=page]:text-brand-green"
                onClick={() => {
                  jump(index + 1);
                }}
              >
                <PageThumbnail
                  source={sheet.node}
                  height={sheet.height}
                  paperWidth={paperWidth}
                  contentKey={contentKey}
                  revision={previewRevision}
                />
                <span>{index + 1}</span>
              </button>
            ))}
          </aside>
        )}
        <div
          ref={attachCanvas}
          role="region"
          aria-label="Document pages scroll area"
          tabIndex={0}
          onScroll={rememberScroll}
          className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green"
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

/** A noninteractive scaled copy of the rendered sheet, with no duplicate document IDs. */
function PageThumbnail({
  source,
  height,
  paperWidth,
  contentKey,
  revision,
}: {
  source: HTMLElement;
  height: number;
  paperWidth: number;
  contentKey: string;
  revision: number;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(80);
  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const copy = source.cloneNode(true) as HTMLElement;
    [copy, ...copy.querySelectorAll<HTMLElement>('*')].forEach((node) => {
      node.removeAttribute('id');
      node.removeAttribute('data-document-page');
    });
    preview.replaceChildren(copy);
    return () => preview.replaceChildren();
  }, [source, height, contentKey, revision]);
  const containerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      if (container.clientWidth) setWidth(container.clientWidth);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(container);
    return () => observer?.disconnect();
  }, []);
  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      inert
      className="pointer-events-none relative w-full max-w-[120px] overflow-hidden bg-white shadow-md"
      style={{ height: (height * width) / paperWidth }}
    >
      <div
        ref={previewRef}
        data-document-thumbnail
        style={{ width: paperWidth, transform: `scale(${width / paperWidth})`, transformOrigin: 'top left' }}
      />
    </div>
  );
}
