'use client';

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search, X, ArrowRight } from '@/components/ui/icons';
import { docsChapters } from './DocsChapters';
import { searchDocs } from './docs-search';

const SearchContext = createContext<{ query: string; setQuery: (query: string) => void } | null>(null);
export function DocsSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}
export function useDocsSearch() {
  const context = useContext(SearchContext);
  if (!context) throw new Error('Docs search requires its provider.');
  return context;
}
export default function DocsSearch() {
  const { query, setQuery } = useDocsSearch();
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchDocs(docsChapters, query).flatMap((chapter) => chapter.sections.map((section) => ({ chapter, section }))), [query]);
  const searching = Boolean(query.trim());
  return <div className="mt-7 max-w-2xl">
    <label htmlFor="docs-search" className="sr-only">Search the guide and FAQs</label>
    <div className="relative rounded-2xl border border-brand-border bg-brand-surface shadow-lg shadow-black/10 dark:shadow-black/30 focus-within:ring-2 focus-within:ring-brand-green/40">
      <Search className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-brand-muted" />
      <input ref={input} id="docs-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder="Search the guide and FAQs" aria-controls="docs-search-results"
        className="h-14 w-full rounded-2xl bg-transparent pl-12 pr-14 text-base text-brand-text outline-none placeholder:text-brand-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden" />
      {query && <button type="button" aria-label="Clear search" className="absolute right-1 top-1 flex h-12 w-12 items-center justify-center rounded-xl text-brand-muted hover:text-brand-text"
        onClick={() => { setQuery(''); input.current?.focus(); }}><X className="h-4 w-4" /></button>}
    </div>
    <div id="docs-search-results" hidden={!searching} className="mt-3 rounded-2xl bg-brand-surface p-4 sm:p-5">
      <p role="status" className="mb-3 text-sm text-brand-muted">{results.length ? `${results.length} matching ${results.length === 1 ? 'section' : 'sections'}` : 'No matching sections. Try “allergy”, “grocery”, or “notifications”.'}</p>
      <ul className="max-h-72 overflow-y-auto">{results.map(({ chapter, section }) => <li key={section.id}>
        <a href={`#${section.id}`} onClick={() => { setQuery(''); if (window.location.hash === `#${section.id}`) window.dispatchEvent(new HashChangeEvent('hashchange')); }} className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-brand-bg focus-visible:bg-brand-bg">
          <span><span className="block text-xs text-brand-muted">{chapter.shortTitle}</span><span className="mt-1 block text-sm font-semibold">{section.title}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-brand-green" />
        </a>
      </li>)}</ul>
    </div>
  </div>;
}
