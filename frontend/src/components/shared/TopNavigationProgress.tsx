'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getPageLoadingCount, subscribePageLoading } from '@/lib/page-loading';

export default function TopNavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [navigationPending, setNavigationPending] = useState(false);
  const loading = useSyncExternalStore(subscribePageLoading, getPageLoadingCount, () => 0) > 0;
  const busy = navigationPending || loading;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isFirstRender = useRef(true);

  // Complete progress whenever URL pathname or searchParams change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setNavigationPending(false);
  }, [pathname, search]);

  const active = useRef(false);
  useEffect(() => {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (busy) {
      active.current = true;
      setIsVisible(true);
      setProgress((value) => (value === 0 || value === 100 ? 20 : value));
      timerRef.current = setInterval(() => {
        setProgress((value) => Math.min(85, value + Math.max(2, (85 - value) * 0.15)));
      }, 120);
    } else if (active.current) {
      setProgress(100);
      finishTimerRef.current = setTimeout(() => {
        active.current = false;
        setIsVisible(false);
        setProgress(0);
      }, 250);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, [busy]);

  // A prevented or failed navigation must not leave an orphan animation.
  useEffect(() => {
    if (!navigationPending) return;
    const timeout = setTimeout(() => setNavigationPending(false), 30_000);
    return () => clearTimeout(timeout);
  }, [navigationPending]);

  // Global click interceptor to catch any internal route links
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      const target = anchor.getAttribute('target');

      // Only handle valid internal application routes
      if (!href || href.startsWith('#') || anchor.hasAttribute('download') || (target && target !== '_self')) {
        return;
      }

      // Check if external URL
      try {
        const url = new URL(href, window.location.href);
        // Blob downloads inherit the site's origin but never change the route.
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
        if (url.origin !== window.location.origin) return;

        // If clicking the current page with no param change, ignore
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }

        // Trigger instantaneous top progress
        setNavigationPending(true);
      } catch {
        // invalid URL string, ignore
      }
    };

    const handleHistory = () => setNavigationPending(true);
    document.addEventListener('click', handleGlobalClick, { capture: true });
    window.addEventListener('popstate', handleHistory);
    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
      window.removeEventListener('popstate', handleHistory);
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, []);

  if (!isVisible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      data-navigation-progress="true"
      data-progress-active={busy}
      className="pointer-events-none fixed left-0 right-0 top-0 z-[99999] h-[2.5px] w-full overflow-hidden bg-transparent"
    >
      <div
        className="relative h-full bg-gradient-to-r from-emerald-500 via-brand-accent to-brand-cyan transition-all ease-out motion-reduce:transition-none"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '180ms' : '220ms',
          opacity: isVisible ? 1 : 0,
        }}
      >
        {/* Luminous leading head */}
        <div className="absolute -right-2 top-[-2px] h-[6.5px] w-8 rounded-full bg-white blur-[2px] opacity-80" />
        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-r from-transparent to-white/40 shadow-[0_0_12px_#54c7be,0_0_6px_#54c7be]" />
      </div>
    </div>
  );
}
