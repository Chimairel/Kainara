'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
} from 'react';
import { Hand, MousePointer2, Maximize2, Minimize2, Minus, Plus, RotateCcw, Scan, Square } from 'lucide-react';

type Point = { x: number; y: number };
const WIDTH = 794;
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
}: {
  title: string;
  contentKey: string;
  children: ReactNode;
  actions?: ReactNode;
  decision?: ReactNode;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
}) {
  const pages = Children.toArray(children).filter((child): child is ReactElement<{ title?: string }> =>
    isValidElement<{ title?: string }>(child)
  );
  const pageCount = pages.length;
  const initialPositions = () => pages.map((_, i) => ({ x: i * (WIDTH + 56), y: 0 }));
  const [positions, setPositions] = useState<Point[]>(initialPositions);
  const [mode, setMode] = useState<'hand' | 'select'>('select');
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState({ x: 24, y: 24, scale: 0.45 });
  const [heights, setHeights] = useState<number[]>([]);
  const root = useRef<HTMLDivElement>(null),
    viewport = useRef<HTMLDivElement>(null);
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
      Math.min(1.5, (node.clientWidth - 48) / (right - left), (node.clientHeight - 48) / (bottom - top))
    );
    setView({
      scale,
      x: (node.clientWidth - (right - left) * scale) / 2 - left * scale,
      y: (node.clientHeight - (bottom - top) * scale) / 2 - top * scale,
    });
    if (reset) setPositions(layout);
  };
  useLayoutEffect(() => {
    setPositions(initialPositions());
    setSelected(0);
    setMode('select');
    didFit.current = false;
    resetPending.current = true;
  }, [contentKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    setPositions((previous) =>
      Array.from({ length: pageCount }, (_, i) => previous[i] ?? { x: i * (WIDTH + 56), y: 0 })
    );
    setSelected((previous) => Math.min(previous, Math.max(0, pageCount - 1)));
    sheets.current.length = pageCount;
    didFit.current = false;
  }, [pageCount]);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => {
      setHeights((previous) => {
        const next = sheets.current.map((sheet) => sheet?.offsetHeight ?? 1123);
        return next.every((height, i) => previous[i] === height) ? previous : next;
      });
      if (!didFit.current && node.clientWidth) {
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
  }, [contentKey, expanded, pages.length, positions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
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
  }, []);
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
    const node = viewport.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (drag.current) return;
      const rect = node.getBoundingClientRect();
      setView((previous) => {
        if (!event.ctrlKey && !event.metaKey)
          return { ...previous, x: previous.x - event.deltaX, y: previous.y - event.deltaY };
        const scale = Math.max(0.1, Math.min(2, previous.scale * Math.exp(-event.deltaY * 0.002)));
        const x = event.clientX - rect.left,
          y = event.clientY - rect.top;
        return {
          scale,
          x: x - ((x - previous.x) * scale) / previous.scale,
          y: y - ((y - previous.y) * scale) / previous.scale,
        };
      });
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [expanded]);
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
      aria-label="RND review canvas"
      className={`relative isolate flex min-w-0 flex-col overflow-hidden border-[6px] border-b-[16px] border-brand-surface bg-brand-bgAlt text-brand-text ${expanded ? 'h-full w-full' : 'h-[calc(100dvh-19rem)] min-h-[640px] w-full rounded-2xl shadow-card-lg'}`}
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
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </header>
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-brand-border bg-brand-surface px-3 py-2"
        role="toolbar"
        aria-label="Canvas tools"
      >
        <button
          type="button"
          className={iconClass}
          aria-label="Hand tool (H)"
          aria-pressed={mode === 'hand'}
          onClick={() => setMode('hand')}
        >
          <Hand className="h-4 w-4" /> <span className="ml-2 text-xs">H</span>
        </button>
        <button
          type="button"
          className={iconClass}
          aria-label="Select tool (V)"
          aria-pressed={mode === 'select'}
          onClick={() => setMode('select')}
        >
          <MousePointer2 className="h-4 w-4" />
          <span className="ml-2 text-xs">V</span>
        </button>
        <span className="mx-1 h-5 border-l border-brand-border" />
        <button type="button" className={iconClass} aria-label="Zoom out" onClick={() => zoom(view.scale - 0.1)}>
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-12 text-center font-mono text-xs" aria-live="polite">
          {Math.round(view.scale * 100)}%
        </span>
        <button type="button" className={iconClass} aria-label="Zoom in" onClick={() => zoom(view.scale + 0.1)}>
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" className={iconClass} onClick={() => fit(true)} aria-label="Fit all sheets">
          <Scan className="h-4 w-4" />
          <span className="ml-2 text-xs">Fit all</span>
        </button>
        <button type="button" className={iconClass} onClick={() => fit(false)} aria-label="Fit selected sheet">
          <Square className="h-4 w-4" />
          <span className="ml-2 text-xs">Fit selected</span>
        </button>
        <button type="button" className={iconClass} onClick={() => fit(true, true)} aria-label="Reset sheet layout">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label="Review canvas viewport"
        className={`relative min-h-0 flex-1 overflow-hidden overscroll-contain bg-[radial-gradient(var(--brand-border)_1px,transparent_1px)] [background-size:20px_20px] ${mode === 'hand' ? 'cursor-grab select-none' : 'cursor-default'}`}
        onPointerDownCapture={(event) => {
          if (mode === 'hand') start(event, 'pan');
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
          if (mode === 'hand') {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <div
          data-canvas-world
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }}
        >
          {pages.map((page, index) => {
            const label = typeof page.props.title === 'string' ? page.props.title : `Sheet ${index + 1}`;
            return (
              <div
                key={page.key ?? index}
                ref={(node) => {
                  sheets.current[index] = node;
                }}
                data-canvas-sheet={index}
                style={{
                  position: 'absolute',
                  width: WIDTH,
                  left: positions[index]?.x ?? 0,
                  top: positions[index]?.y ?? 0,
                }}
                className={selected === index ? 'outline outline-2 outline-brand-accent outline-offset-4' : ''}
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
                  className="absolute bottom-full left-0 mb-3 cursor-move rounded-lg bg-brand-surface px-3 py-2 text-sm font-bold text-brand-text shadow-sm"
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
      <footer
        role="region"
        className="z-10 max-h-[35dvh] shrink-0 overflow-y-auto border-t border-brand-border bg-brand-surface p-3 custom-scrollbar"
        aria-label="Review decisions"
      >
        {decision ?? (
          <p className="text-xs text-brand-muted">
            Claim this review to make a decision. H pans the canvas; V selects. Recipe evidence is read-only.
          </p>
        )}
      </footer>
    </div>
  );
  return (
    <Dialog.Root open={expanded} onOpenChange={onExpandedChange}>
      {!expanded && canvas}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[81] h-[100dvh] w-screen outline-none"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            expandButton.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">{title} — fullscreen</Dialog.Title>
          {expanded && canvas}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
