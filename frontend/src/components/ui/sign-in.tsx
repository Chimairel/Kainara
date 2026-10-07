'use client';

import type { ReactNode } from 'react';
import styles from './sign-in.module.css';

export interface SignInPageProps {
  title: ReactNode;
  eyebrow?: string;
  header?: ReactNode;
  titleDecoration?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  heroImageSrc?: string;
  heroContent?: ReactNode;
  wide?: boolean;
  transition?: ReactNode;
}

/** Shared split authentication layout; callers own their auth forms and hero content. */
export function SignInPage({
  title,
  eyebrow,
  header,
  titleDecoration,
  children,
  footer,
  heroImageSrc,
  heroContent,
  wide = false,
  transition,
}: SignInPageProps) {
  return (
    <main className={`${styles.page} flex min-h-[100svh] w-full bg-brand-bg text-brand-text`}>
      <section className="flex min-w-0 flex-1 flex-col px-6 py-6 sm:px-10 lg:order-2 lg:px-12 xl:px-20">
        <header
          className={`mx-auto flex w-full max-w-xl items-center justify-between gap-4 ${heroContent ? 'lg:hidden' : ''}`}
        >
          {header}
        </header>
        <div className="flex flex-1 items-center justify-center py-10 lg:py-8">
          <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'}`}>
            {/* Preserve form DOM and dimensions during session/profile/navigation resolution. */}
            <div className={`auth-card ${styles.form} relative`}>
              <div inert={transition ? true : undefined}>
                <div className="mb-8 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    {eyebrow && (
                      <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-brand-muted">
                        {eyebrow}
                      </p>
                    )}
                    <h1
                      className={`font-display font-bold leading-[1.08] tracking-tight ${wide ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'}`}
                    >
                      {title}
                    </h1>
                  </div>
                  {titleDecoration}
                </div>
                {children}
              </div>
              {transition && (
                <div className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-brand-bg/95 p-4">
                  {transition}
                </div>
              )}
            </div>
            {footer && <footer className="mt-6 flex flex-col gap-4">{footer}</footer>}
          </div>
        </div>
      </section>
      {(heroImageSrc || heroContent) && (
        <aside
          className="sticky top-0 order-first hidden h-[100svh] min-w-0 flex-1 p-4 lg:block"
          aria-label="About KAINARA"
        >
          <div
            className={`${styles.hero} h-full ${heroContent ? 'overflow-visible' : 'overflow-hidden rounded-[32px] border border-brand-border bg-brand-bg bg-cover bg-center'}`}
            style={heroImageSrc ? { backgroundImage: `url(${heroImageSrc})` } : undefined}
          >
            {heroContent}
          </div>
        </aside>
      )}
    </main>
  );
}
