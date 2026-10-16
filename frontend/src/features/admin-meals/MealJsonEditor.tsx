'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';

function highlight(text: string) {
  if (text.length > 100_000) return text;
  const pattern =
    /"(?:\\.|[^"\\])*"\s*(?=:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
  const nodes = [];
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index!;
    nodes.push(text.slice(offset, index));
    const token = match[0];
    const key = token.startsWith('"') && /^\s*:/.test(text.slice(index + token.length));
    nodes.push(
      <span
        key={index}
        className={
          key
            ? 'text-[#7b3e99] dark:text-[#dfb7f3]'
            : token.startsWith('"')
              ? 'text-[#17634d] dark:text-[#9bd9b9]'
              : 'text-[#9a4619] dark:text-[#f0b58c]'
        }
      >
        {token}
      </span>
    );
    offset = index + token.length;
  }
  nodes.push(text.slice(offset));
  return nodes;
}

export default function MealJsonEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const code = useRef<HTMLPreElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const highlighted = useMemo(() => highlight(value), [value]);
  const lines = useMemo(() => value.split('\n').length, [value]);
  const first = Math.floor(scrollTop / 24);
  useLayoutEffect(() => {
    if (!area.current || document.activeElement === area.current) return;
    area.current.scrollTop = 0;
    area.current.scrollLeft = 0;
    area.current.setSelectionRange(0, 0);
    if (code.current) {
      code.current.scrollTop = 0;
      code.current.scrollLeft = 0;
    }
    setScrollTop(0);
    setPosition({ line: 1, column: 1 });
  }, [value]);
  function cursor() {
    const prefix = value.slice(0, area.current?.selectionStart ?? 0).split('\n');
    setPosition({ line: prefix.length, column: prefix[prefix.length - 1].length + 1 });
  }
  return (
    <div className="min-w-0 bg-brand-surface">
      <div className="grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] font-mono text-[13px] leading-6">
        <div
          aria-hidden="true"
          className="relative h-[420px] overflow-hidden border-r border-brand-border bg-brand-bgAlt/50 text-right text-brand-muted sm:h-[540px]"
        >
          <div className="absolute inset-x-0 pr-3" style={{ top: 16 - (scrollTop % 24) }}>
            {Array.from({ length: Math.min(25, Math.max(0, lines - first)) }, (_, index) => (
              <div key={first + index}>{first + index + 1}</div>
            ))}
          </div>
        </div>
        <div className="relative min-w-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand-green">
          <pre
            ref={code}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-4 font-mono text-[13px] leading-6 text-brand-text [tab-size:2] [scrollbar-gutter:stable]"
          >
            {highlighted}
            {'\n'}
          </pre>
          <textarea
            ref={area}
            aria-label="Recipe JSON"
            aria-describedby="meal-json-keyboard-help"
            value={value}
            disabled={disabled}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onChange={(event) => onChange(event.target.value)}
            onSelect={cursor}
            onScroll={(event) => {
              const target = event.currentTarget;
              setScrollTop(target.scrollTop);
              if (code.current) {
                code.current.scrollTop = target.scrollTop;
                code.current.scrollLeft = target.scrollLeft;
              }
            }}
            className="relative block h-[420px] w-full resize-none overflow-auto whitespace-pre border-0 bg-transparent p-4 font-mono text-[13px] leading-6 text-transparent caret-brand-text outline-none selection:bg-brand-accent/25 [tab-size:2] [scrollbar-gutter:stable] sm:h-[540px] disabled:cursor-wait"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-border bg-brand-bgAlt/50 px-4 py-2 font-mono text-[11px] text-brand-muted">
        <span>
          Ln {position.line}, Col {position.column}
        </span>
        <span>
          JSON · UTF-8 · {lines} {lines === 1 ? 'line' : 'lines'}
        </span>
      </div>
      <p id="meal-json-keyboard-help" className="sr-only">
        JSON editor. Use normal text editing and clipboard shortcuts. Tab moves to the next control.
      </p>
    </div>
  );
}
