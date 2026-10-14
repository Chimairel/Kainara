'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type ReactElement,
} from 'react';
import { Hand, MousePointer2, Maximize2, Minimize2, Minus, Plus, RotateCcw, Scan, Square } from '@/components/ui/icons';
import CanvasMenu from './CanvasMenu';
import { useDesktopWorkspaceVisible } from '@/lib/desktop-workspace-visibility';

type Point = { x: number; y: number };
export type ReviewCanvasLayout = {
  version: 1;
  sheets: Array<Point & { title: string }>;
  view: Point & { scale: number };
  selected: number;
  mode: 'hand' | 'select';
};
const WIDTH = 794;
const compactSnapshot = () => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 639px)').matches;
const subscribeCompact = (listener: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia('(max-width: 639px)');
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
};
const flattenSheets = (children: ReactNode): ReactElement<{ title?: string }>[] => Children.toArray(children).flatMap(child => {
  if (!isValidElement<{ title?: string; children?: ReactNode }>(child)) return [];
  return child.type === Fragment ? flattenSheets(child.props.children) : [child];
});
const editableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]'));

/** Desktop inspection board. Sheet positions and viewport transforms are presentation only. */
export default function ReviewCanvas({
  title,
  contentKey,
  children,
  actions,
  decision,
  expanded,
  onExpandedChange,
  readOnly = false,
  className = '',
  focusSheet,
  tools,
  initialLayout,
  onLayoutChange,
  restoreLayout,
  hideDecisionDock = false,
  stackOnMobile = false,
}: {
  title: string;
  contentKey: string;
  children: ReactNode;
  actions?: ReactNode;
  decision?: ReactNode;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  readOnly?: boolean;
  hideDecisionDock?: boolean;
  stackOnMobile?: boolean;
  className?: string;
  focusSheet?: { title: string; request: number };
  tools?: ReactNode;
  initialLayout?: ReviewCanvasLayout | null;
  onLayoutChange?: (layout: ReviewCanvasLayout) => void;
  restoreLayout?: { layout: ReviewCanvasLayout; request: number } | null;
}) {
  const desktopVisible = useDesktopWorkspaceVisible();
  const narrow = useSyncExternalStore(subscribeCompact, compactSnapshot, () => false);
  const compact = stackOnMobile && narrow;
  const pages = flattenSheets(children);
  const pageCount = pages.length;
  const initialPositions = () => pages.map((_, i) => ({ x: i * (WIDTH + 56), y: 0 }));
  const [positions, setPositions] = useState<Point[]>(initialPositions);
  const [mode, setMode] = useState<'hand' | 'select'>('select');
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState({ x: 24, y: 24, scale: 0.45 });
  const [heights, setHeights] = useState<number[]>([]);
  const root = useRef<HTMLDivElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null);
  const bindViewport = useCallback((node: HTMLDivElement | null) => { viewport.current = node; setViewportNode(node); }, []);
  const sheets = useRef<Array<HTMLDivElement | null>>([]),
    expandButton = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ pointer: number; kind: 'pan' | 'sheet'; index: number; start: Point; origin: Point } | null>(
    null
  );
  const didFit = useRef(false);
  const resetPending = useRef(true);
  const fit = (all: boolean, reset = false) => {
    const node = viewport.current;
    if (!node || !pages.length) return;
    const layout = reset
      ? initialPositions()
      : Array.from({ length: pageCount }, (_, i) => positions[i] ?? { x: i * (WIDTH + 56), y: 0 });
    const indexes = all ? layout.map((_, i) => i) : [selected];
    const left = Math.min(...indexes.map((i) => layout[i]?.x ?? 0));
    const top = Math.min(...indexes.map((i) => layout[i]?.y ?? 0));
    const right = Math.max(...indexes.map((i) => (layout[i]?.x ?? 0) + WIDTH));
    const bottom = Math.max(
      ...indexes.map((i) => (layout[i]?.y ?? 0) + (sheets.current[i]?.offsetHeight || heights[i] || 1123))
    );
    const scale = Math.max(
      0.1,
      Math.min(1.5, (node.clientWidth - 48) / (right - left), (node.clientHeight - 128) / (bottom - top))
    );
    setView({
      scale,
      x: Math.max(24, (node.clientWidth - (right - left) * scale) / 2) - left * scale,
      y: Math.max(24, (node.clientHeight - 80 - (bottom - top) * scale) / 2) - top * scale,
    });
    if (reset) setPositions(layout);
  };
  useLayoutEffect(() => {
    setPositions(pages.map((page, index) => initialLayout && initialLayout.sheets[index]?.title === page.props.title
      ? initialLayout.sheets[index] : initialPositions()[index]));
    setSelected(initialLayout?.selected ?? 0);
    setMode(initialLayout?.mode ?? 'select');
    if (initialLayout) setView(initialLayout.view);
    didFit.current = Boolean(initialLayout);
    resetPending.current = !initialLayout;
  }, [contentKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    setPositions((previous) =>
      Array.from({ length: pageCount }, (_, i) => previous[i] ?? { x: i * (WIDTH + 56), y: 0 })
    );
    setSelected((previous) => Math.min(previous, Math.max(0, pageCount - 1)));
    sheets.current.length = pageCount;
    didFit.current = Boolean(initialLayout);
  }, [pageCount]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    onLayoutChange?.({ version: 1, sheets: pages.map((page, index) => ({
      title: page.props.title ?? `Sheet ${index + 1}`, ...(positions[index] ?? { x: index * (WIDTH + 56), y: 0 }),
    })), view, selected, mode });
  }, [positions, view, selected, mode, pageCount, onLayoutChange]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => {
      setHeights((previous) => {
        const next = sheets.current.map((sheet) => sheet?.offsetHeight ?? 1123);
        return next.every((height, i) => previous[i] === height) ? previous : next;
      });
      if (!compact && !didFit.current && node.clientWidth) {
        didFit.current = true;
        fit(true, resetPending.current);
        resetPending.current = false;
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    sheets.current.forEach((sheet) => sheet && observer.observe(sheet));
    return () => observer.disconnect();
  }, [contentKey, expanded, pages.length, positions.length, viewportNode, compact]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!focusSheet) return;
    const index = pages.findIndex(page => page.props.title === focusSheet.title);
    const node = viewport.current;
    if (index < 0 || !node) return;
    const position = positions[index] ?? { x: index * (WIDTH + 56), y: 0 };
    if (compact) {
      node.scrollTop = sheets.current[index]?.offsetTop ?? 0;
      setSelected(index); return;
    }
    // Open references at a readable width, keeping their top in view.
    const scale = Math.max(0.1, Math.min(1, (node.clientWidth - 48) / WIDTH));
    setSelected(index);
    setMode('select');
    setView({ scale, x: Math.max(24, (node.clientWidth - WIDTH * scale) / 2) - position.x * scale,
      y: 64 - position.y * scale });
    didFit.current = true;
  }, [focusSheet?.title, focusSheet?.request, pageCount, viewportNode, compact]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!restoreLayout) return;
    setPositions(restoreLayout.layout.sheets.slice(0, pageCount));
    setView(restoreLayout.layout.view);
    setSelected(Math.min(restoreLayout.layout.selected, pageCount - 1));
    setMode(restoreLayout.layout.mode);
    didFit.current = true;
  }, [restoreLayout?.request]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (!desktopVisible) return;
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || editableTarget(event.target))
        return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[role="dialog"]') && !root.current?.contains(target)) return;
      if (event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setMode('hand');
      }
      if (event.key.toLowerCase() === 'v') {
        event.preventDefault();
        setMode('select');
      }
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault();
        const current = drag.current;
        if (current.kind === 'pan') setView((previous) => ({ ...previous, ...current.origin }));
        else
          setPositions((previous) => previous.map((position, i) => (i === current.index ? current.origin : position)));
        drag.current = null;
      }
    };
    document.addEventListener('keydown', shortcuts);
    return () => document.removeEventListener('keydown', shortcuts);
  }, [desktopVisible]);
  const zoom = (scale: number, at?: Point) => {
    const node = viewport.current;
    if (!node) return;
    const center = at ?? { x: node.clientWidth / 2, y: node.clientHeight / 2 };
    setView((previous) => {
      const next = Math.max(0.1, Math.min(2, scale));
      return {
        scale: next,
        x: center.x - ((center.x - previous.x) * next) / previous.scale,
        y: center.y - ((center.y - previous.y) * next) / previous.scale,
      };
    });
  };
  useEffect(() => {
    // Fullscreen moves the viewport into a delayed Radix portal. Resolve live refs
    // for each wheel event so no listener is stranded on the previous DOM node.
    const wheel = (event: WheelEvent) => {
      if (compact) return;
      const node = viewport.current,
        canvasNode = root.current;
      const target = event.target;
      if (!node || !canvasNode || !(target instanceof Node) || !canvasNode.contains(target)) return;
      const zooming = event.ctrlKey || event.metaKey;
      const overViewport = node.contains(target);
      // Reference tables scroll within their paper; modified wheel still zooms the canvas.
      if (!zooming && target instanceof Element && target.closest('[data-canvas-scroll]')) return;
      // Ordinary wheel scrolling in the toolbar/decision dock stays native.
      if (!zooming && !overViewport) return;
      event.preventDefault();
      event.stopPropagation();
      if (drag.current) return;
      const rect = node.getBoundingClientRect();
      setView((previous) => {
        if (!zooming) return { ...previous, x: previous.x - event.deltaX, y: previous.y - event.deltaY };
        const scale = Math.max(0.1, Math.min(2, previous.scale * Math.exp(-event.deltaY * 0.002)));
        const x = overViewport ? event.clientX - rect.left : node.clientWidth / 2,
          y = overViewport ? event.clientY - rect.top : node.clientHeight / 2;
        return {
          scale,
          x: x - ((x - previous.x) * scale) / previous.scale,
          y: y - ((y - previous.y) * scale) / previous.scale,
        };
      });
    };
    // Capture before portal scroll locks and disable passive handling so the
    // browser's page zoom is cancelled synchronously, including trackpad pinch.
    document.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => document.removeEventListener('wheel', wheel, { capture: true });
  }, [compact]);
  const start = (event: React.PointerEvent, kind: 'pan' | 'sheet', index = 0) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      kind,
      index,
      start: { x: event.clientX, y: event.clientY },
      origin: kind === 'pan' ? view : positions[index],
    };
    if (kind === 'sheet') setSelected(index);
  };
  const move = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const dx = event.clientX - current.start.x,
      dy = event.clientY - current.start.y;
    if (current.kind === 'pan')
      setView((previous) => ({ ...previous, x: current.origin.x + dx, y: current.origin.y + dy }));
    else
      setPositions((previous) =>
        previous.map((position, i) =>
          i === current.index
            ? { x: current.origin.x + dx / view.scale, y: current.origin.y + dy / view.scale }
            : position
        )
      );
  };
  const iconClass =
    'flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-brand-muted hover:bg-brand-green/10 aria-pressed:bg-brand-green/15 aria-pressed:text-brand-green focus-visible:outline focus-visible:outline-brand-green';
  const canvas = (
    <div
      ref={root}
      role="region"
      aria-label={readOnly ? 'Admin review canvas' : 'RND review canvas'}
      className={`relative isolate flex min-w-0 flex-col overflow-hidden border-[6px] border-b-[16px] border-brand-surface bg-brand-bgAlt text-brand-text ${expanded ? 'h-full w-full' : `h-[calc(100dvh-19rem)] min-h-[640px] w-full rounded-2xl shadow-card-lg ${className}`}`}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-brand-border bg-brand-surface p-3">
        <h2 className="min-w-0 max-w-[50%] truncate text-sm font-bold" title={title}>
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button
            ref={expanded ? undefined : expandButton}
            type="button"
            className={iconClass}
            aria-label={expanded ? 'Exit fullscreen' : 'Expand canvas'}
            title={expanded ? 'Exit fullscreen' : 'Expand canvas'}
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </header>
      <div
        className={`${compact ? 'hidden' : 'flex'} shrink-0 flex-wrap items-center gap-2 border-b border-brand-border bg-brand-surface px-3 py-2`}
        role="toolbar"
        aria-label="Canvas view controls"
      >
        <button type="button" className={iconClass} title="Zoom out" aria-label="Zoom out" onClick={() => zoom(view.scale - 0.1)}>
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-12 text-center font-mono text-xs" aria-live="polite">
          {Math.round(view.scale * 100)}%
        </span>
        <button type="button" className={iconClass} title="Zoom in" aria-label="Zoom in" onClick={() => zoom(view.scale + 0.1)}>
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" className={iconClass} title="Fit all sheets" onClick={() => fit(true)} aria-label="Fit all sheets">
          <Scan className="h-4 w-4" />
        </button>
        <button type="button" className={iconClass} title="Fit selected sheet" onClick={() => fit(false)} aria-label="Fit selected sheet">
          <Square className="h-4 w-4" />
        </button>
        <button type="button" className={iconClass} title="Reset sheet layout" onClick={() => fit(true, true)} aria-label="Reset sheet layout">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={bindViewport}
        tabIndex={0}
        role="region"
        aria-label="Review canvas viewport"
        className={`relative min-h-0 flex-1 ${compact ? 'overflow-y-auto p-3' : 'overflow-hidden'} overscroll-contain bg-[radial-gradient(var(--brand-border)_1px,transparent_1px)] [background-size:20px_20px] ${!compact && mode === 'hand' ? 'cursor-grab select-none' : 'cursor-default'}`}
        onPointerDownCapture={(event) => {
          if (!compact && mode === 'hand') start(event, 'pan');
        }}
        onPointerMove={move}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onClickCapture={(event) => {
          if (!compact && mode === 'hand') {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <div
          data-canvas-world
          className={compact ? 'space-y-5' : undefined}
          style={compact ? undefined : { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }}
        >
          {pages.map((page, index) => {
            const label = typeof page.props.title === 'string' ? page.props.title : `Sheet ${index + 1}`;
            return (
              <div
                key={`${index}:${page.key ?? "sheet"}`}
                ref={(node) => {
                  sheets.current[index] = node;
                }}
                data-canvas-sheet={index}
                style={compact ? undefined : {
                  position: 'absolute',
                  width: WIDTH,
                  left: positions[index]?.x ?? 0,
                  top: positions[index]?.y ?? 0,
                }}
                className={compact ? 'relative [&>article]:min-h-0 [&>article]:p-5 [&_h2]:text-2xl' : selected === index ? 'outline outline-2 outline-brand-accent outline-offset-4' : ''}
                onPointerDown={() => {
                  if (mode === 'select') setSelected(index);
                }}
              >
                <button
                  type="button"
                  aria-label={`Move ${label} sheet`}
                  title="Drag this title to move the sheet. Arrow keys also move it."
                  onFocus={() => {
                    if (mode === 'select') setSelected(index);
                  }}
                  className={`${compact ? 'hidden' : ''} absolute bottom-full left-0 mb-3 cursor-move rounded-lg bg-brand-surface px-3 py-2 text-sm font-bold text-brand-text shadow-sm`}
                  onPointerDown={(event) => {
                    if (mode === 'select') start(event, 'sheet', index);
                  }}
                  onPointerMove={move}
                  onPointerUp={() => {
                    drag.current = null;
                  }}
                  onKeyDown={(event) => {
                    const deltas: Record<string, Point> = {
                      ArrowLeft: { x: -20, y: 0 },
                      ArrowRight: { x: 20, y: 0 },
                      ArrowUp: { x: 0, y: -20 },
                      ArrowDown: { x: 0, y: 20 },
                    };
                    const delta = deltas[event.key];
                    if (delta && mode === 'select') {
                      event.preventDefault();
                      setSelected(index);
                      setPositions((previous) =>
                        previous.map((p, i) => (i === index ? { x: p.x + delta.x, y: p.y + delta.y } : p))
                      );
                    }
                  }}
                >
                  {label}
                </button>
                {page}
              </div>
            );
          })}
        </div>
      </div>
      <div
        role="toolbar"
        aria-label="Canvas tools"
        className={`${compact ? 'hidden' : 'flex'} absolute bottom-4 left-1/2 z-20 w-max max-w-[calc(100%-32px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-2xl bg-brand-surface p-2 shadow-card-lg`}
      >
        <CanvasMenu label={mode === 'hand' ? 'Hand tool (H)' : 'Move tool (V)'} value={mode}
          icon={mode === 'hand' ? <Hand aria-hidden="true" className="h-5 w-5" /> : <MousePointer2 aria-hidden="true" className="h-5 w-5" />}
          onSelect={value => setMode(value as 'hand' | 'select')}
          items={[{ value: 'select', label: 'Move (V)', icon: <MousePointer2 className="h-4 w-4" /> },
            { value: 'hand', label: 'Hand tool (H)', icon: <Hand className="h-4 w-4" /> }]} />
        {tools && <><span aria-hidden="true" className="mx-1 h-5 border-l border-brand-border" />{tools}</>}
      </div>
      {!readOnly && !hideDecisionDock && (
        <footer
          role="region"
          className={`absolute ${compact ? 'bottom-4' : 'bottom-24'} left-1/2 z-10 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-2xl border border-brand-border bg-brand-surface p-2 shadow-card-lg`}
          aria-label="Review decisions"
        >
          {decision ?? (
            <p className="text-xs text-brand-muted">
              Claim this review to make a decision. H pans the canvas; V selects. Recipe evidence is read-only.
            </p>
          )}
        </footer>
      )}
    </div>
  );
  return (
    <Dialog.Root open={expanded && desktopVisible} onOpenChange={(open) => { if (desktopVisible) onExpandedChange(open); }}>
      {(!expanded || !desktopVisible) && canvas}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[81] h-[100dvh] w-screen outline-none"
          onEscapeKeyDown={(event) => {
            if (event.target instanceof Element && event.target.closest('[role="combobox"][aria-expanded="true"]')) {
              event.preventDefault();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (desktopVisible) expandButton.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">{title} — fullscreen</Dialog.Title>
          {expanded && canvas}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
