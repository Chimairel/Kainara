'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight, List } from 'lucide-react';
import { docsChapters } from './DocsChapters';

const groups = ['Start here', 'Use KAINARA', 'Review and evidence', 'Policies and help'] as const;

function chapterFor(fragment: string) {
  return docsChapters.find((chapter) =>
    chapter.id === fragment || chapter.aliases?.includes(fragment) || chapter.sections.some((section) => section.id === fragment)
  ) ?? docsChapters[0];
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
      target?.scrollIntoView?.({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chapter, scrollTarget]);

  const navigate = useCallback((fragment: string) => {
    window.history.pushState(null, '', `#${fragment}`);
    setActiveId(chapterFor(fragment).id);
    setScrollTarget({ id: fragment });
  }, []);

  return (
    <div className="mx-auto grid max-w-[1320px] gap-9 px-5 py-16 sm:px-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:px-12 lg:py-24 xl:grid-cols-[210px_minmax(0,1fr)_190px] xl:gap-12">
      <nav aria-label="Documentation chapters" className="lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
        <div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-accent">
          <List className="h-3.5 w-3.5" /> Explore the guide
        </div>
        <label htmlFor="docs-chapter" className="sr-only">Choose a documentation chapter</label>
        <select
          id="docs-chapter"
          className="surface-panel w-full rounded-xl border border-brand-border px-4 py-3 font-semibold text-brand-text lg:hidden"
          value={activeId ?? docsChapters[0].id}
          onChange={(event) => navigate(event.target.value)}
        >
          {docsChapters.map((item) => <option key={item.id} value={item.id}>{item.shortTitle}</option>)}
        </select>
        <div className="hidden space-y-7 lg:block">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-2 px-3 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-muted">{group}</p>
              <div className="space-y-0.5">
                {docsChapters.filter((item) => item.group === group).map((item) => {
                  const number = String(docsChapters.indexOf(item) + 1).padStart(2, '0');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={activeId === item.id ? 'page' : undefined}
                      onClick={() => navigate(item.id)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${activeId === item.id ? 'bg-brand-accent/10 font-bold text-brand-accent' : 'font-medium text-brand-muted hover:bg-brand-surface hover:text-brand-text'}`}
                    >
                      <span className="font-mono text-[10px] text-brand-muted/70">{number}</span>
                      <span className="min-w-0 flex-1">{item.shortTitle}</span>
                      {activeId === item.id && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <article className="min-w-0" aria-live="polite">
        {chapter ? (
          <div id={chapter.id} className="scroll-mt-28">
            <header className="border-b border-brand-border/70 pb-8">
              <div className="mb-5 flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${chapter.tone === 'cyan' ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan' : chapter.tone === 'green' ? 'border-brand-green/30 bg-brand-green/10 text-brand-green' : chapter.tone === 'amber' ? 'border-amber-400/30 bg-amber-400/10 text-amber-400' : 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent'}`}>
                  <chapter.icon className="h-5 w-5" />
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-muted">Chapter {String(docsChapters.indexOf(chapter) + 1).padStart(2, '0')} / {String(docsChapters.length).padStart(2, '0')}</span>
              </div>
              <h2 className="font-display text-3xl font-black tracking-tight text-brand-text sm:text-4xl">{chapter.title}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-brand-muted">{chapter.summary}</p>
            </header>

            <div className="space-y-6 pt-8">
              {chapter.sections.map((section) => (
                <section key={section.id} id={section.id} className="surface-panel scroll-mt-28 rounded-[24px] border border-brand-border/70 p-6 sm:p-8">
                  <h3 className="font-display text-xl font-bold tracking-tight text-brand-text">{section.title}</h3>
                  <div className="mt-4 space-y-4 text-sm leading-7 text-brand-muted">{section.content}</div>
                </section>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-4 rounded-[24px] border border-brand-accent/20 bg-brand-accent/5 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-lg font-bold text-brand-text">Ready to use KAINARA?</p>
                <p className="mt-1 text-xs leading-5 text-brand-muted">Return to your nutrition workspace when you are ready.</p>
              </div>
              <Link href="/dashboard" className="inline-flex shrink-0 items-center gap-2 text-xs font-bold text-brand-accent transition hover:text-brand-green">
                Go to dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : <div className="min-h-[400px]" aria-label="Loading documentation" />}
      </article>

      <aside className="hidden xl:block xl:self-start xl:sticky xl:top-28" aria-label="On this page">
        <p className="mb-4 border-b border-brand-border/70 pb-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-accent">On this page</p>
        {chapter && (
          <nav className="space-y-1">
            <button type="button" onClick={() => navigate(chapter.id)} className="block w-full rounded-lg px-2 py-2 text-left text-xs font-semibold text-brand-text transition hover:bg-brand-surface">Overview</button>
            {chapter.sections.map((section) => (
              <button key={section.id} type="button" onClick={() => navigate(section.id)} className="block w-full rounded-lg px-2 py-2 text-left text-xs leading-5 text-brand-muted transition hover:bg-brand-surface hover:text-brand-text">{section.title}</button>
            ))}
          </nav>
        )}
      </aside>
    </div>
  );
}
