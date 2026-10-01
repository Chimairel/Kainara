'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight, List } from 'lucide-react';
import { docsChapters } from './DocsChapters';

const groups = ['Start here', 'Use KAINARA', 'Review and evidence', 'Policies and help'] as const;

function chapterFor(fragment: string) {
  return (
    docsChapters.find(
      (chapter) =>
        chapter.id === fragment ||
        chapter.aliases?.includes(fragment) ||
        chapter.sections.some((section) => section.id === fragment)
    ) ?? docsChapters[0]
  );
}

function currentFragment() {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return window.location.hash.slice(1);
  }
}

export default function DocsWorkspace() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<{ id: string } | null>(null);
  const chapter = docsChapters.find((item) => item.id === activeId);

  useEffect(() => {
    const syncFromUrl = () => {
      const fragment = currentFragment();
      setActiveId(chapterFor(fragment).id);
      setScrollTarget(fragment ? { id: fragment } : null);
    };
    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  useEffect(() => {
    if (!chapter || !scrollTarget) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(scrollTarget.id) ?? document.getElementById(chapter.id);
      target?.scrollIntoView?.({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chapter, scrollTarget]);

  const navigate = useCallback((fragment: string) => {
    window.history.pushState(null, '', `#${fragment}`);
    setActiveId(chapterFor(fragment).id);
    setScrollTarget({ id: fragment });
  }, []);

  return (
    <div className="mx-auto grid max-w-[1344px] gap-9 px-5 py-12 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-12 lg:py-16 xl:grid-cols-[230px_minmax(0,1fr)_200px] xl:gap-12">
      {/* CHAPTERS NAVIGATION (LEFT SIDEBAR) */}
      <nav
        aria-label="Documentation chapters"
        className="lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto"
      >
        <div className="mb-5 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          <List className="h-3.5 w-3.5 text-emerald-500" /> Explore the guide
        </div>

        {/* Mobile dropdown */}
        <label htmlFor="docs-chapter" className="sr-only">
          Choose a documentation chapter
        </label>
        <select
          id="docs-chapter"
          className="w-full rounded-2xl border border-brand-border/80 bg-brand-surface px-4 py-3 font-semibold text-brand-text shadow-sm lg:hidden"
          value={activeId ?? docsChapters[0].id}
          onChange={(event) => navigate(event.target.value)}
        >
          {docsChapters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.shortTitle}
            </option>
          ))}
        </select>

        {/* Desktop grouped chapter list */}
        <div className="hidden space-y-7 lg:block">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-2 px-3 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-muted">
                {group}
              </p>
              <div className="space-y-1">
                {docsChapters
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const number = String(docsChapters.indexOf(item) + 1).padStart(2, '0');
                    const isActive = activeId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => navigate(item.id)}
                        className={`group relative flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left text-xs transition-colors duration-150 ${
                          isActive
                            ? 'border-brand-border/80 bg-brand-surface font-semibold text-brand-text shadow-sm dark:border-[#173e33] dark:bg-[#0e271f]'
                            : 'border-transparent font-medium text-brand-muted hover:bg-brand-surface/60 hover:text-brand-text'
                        }`}
                      >
                        {/* Signature stripe hint indicator for active chapter */}
                        <span
                          className={`absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-gradient-to-b from-[#1b4e41] via-[#f09e6c] to-[#eb6a38] transition-opacity duration-150 ${
                            isActive ? 'opacity-100' : 'opacity-0'
                          }`}
                          aria-hidden="true"
                        />
                        <span
                          className={`font-mono text-[10px] transition-colors duration-150 ${
                            isActive ? 'font-bold text-emerald-500' : 'text-brand-muted/70 group-hover:text-brand-muted'
                          }`}
                        >
                          {number}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.shortTitle}</span>
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-emerald-500 transition-opacity duration-150 ${
                            isActive ? 'opacity-100' : 'opacity-0'
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* ARTICLE CONTENT */}
      <article className="min-w-0" aria-live="polite">
        {chapter ? (
          <div id={chapter.id} className="scroll-mt-28 space-y-6">
            {/* Chapter Header (Clean, floating header - not enclosed in a card) */}
            <header className="border-b border-brand-border/70 pb-8">
              <div className="mb-4">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                  Chapter {String(docsChapters.indexOf(chapter) + 1).padStart(2, '0')} /{' '}
                  {String(docsChapters.length).padStart(2, '0')}
                </span>
              </div>

              <h2 className="font-display text-3xl font-black tracking-tight text-brand-text sm:text-4xl">
                {chapter.title}
              </h2>
              <div className="mt-4 max-w-2xl text-sm leading-7 text-brand-muted">{chapter.summary}</div>
            </header>

            {/* Sections */}
            <div className="pt-2">
              {chapter.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-28 border-b border-brand-border/60 py-10 first:pt-4 last:border-b-0"
                >
                  <h3 className="font-display text-xl font-bold tracking-tight text-brand-text sm:text-2xl">
                    {section.title}
                  </h3>
                  <div className="mt-5 max-w-3xl space-y-5 text-sm leading-8 text-brand-muted">{section.content}</div>
                </section>
              ))}
            </div>

            {/* Bottom Call to Action Card (No upper gradient border, no logo/brand pill, single button) */}
            <div className="relative mt-10 overflow-hidden rounded-[28px] border border-[#173e33] bg-[#071914] p-7 sm:p-9 text-white shadow-2xl">
              {/* Ambient blurs */}
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-cyan/20 blur-3xl" />
              <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />

              <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-xl font-black text-white sm:text-2xl">
                    Ready to build your meal plan?
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-white/70 max-w-md">
                    Set up your health profile for Filipino meal planning, with nutritionist review for applicable
                    cases.
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Link
                    href="/register"
                    className="inline-flex min-h-[48px] items-center gap-2.5 rounded-2xl bg-brand-accent px-7 text-xs font-bold text-white shadow-neon transition duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
                  >
                    Build my profile <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-[400px]" aria-label="Loading documentation" />
        )}
      </article>

      {/* ON THIS PAGE (RIGHT SIDEBAR) */}
      <aside
        className="hidden xl:sticky xl:top-28 xl:block xl:max-h-[calc(100vh-8rem)] xl:self-start xl:overflow-y-auto"
        aria-label="On this page"
      >
        <div className="mb-4 flex items-center gap-2 border-b border-brand-border/70 pb-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          On this page
        </div>
        {chapter && (
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => navigate(chapter.id)}
              className="block w-full rounded-xl px-2.5 py-2 text-left text-xs font-bold text-brand-text transition hover:bg-brand-surface hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              Overview
            </button>
            {chapter.sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => navigate(section.id)}
                className="block w-full rounded-xl px-2.5 py-2 text-left text-xs leading-5 text-brand-muted transition hover:bg-brand-surface hover:text-brand-text"
              >
                {section.title}
              </button>
            ))}
          </nav>
        )}
      </aside>
    </div>
  );
}
