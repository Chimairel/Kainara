'use client';

import { useEffect } from 'react';

// Presentation only: a mounted loading placeholder owns a lease until it disappears.
// Cached background reads never acquire a lease and cannot flash the navigation bar.
const pending = new Set<symbol>();
const listeners = new Set<() => void>();
export const getPageLoadingCount = () => pending.size;
export const subscribePageLoading = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => listeners.forEach((listener) => listener());

export function beginPageLoading() {
  const lease = Symbol('page-loading');
  pending.add(lease);
  notify();
  return () => {
    if (pending.delete(lease)) notify();
  };
}

export function usePageLoading(loading: boolean) {
  useEffect(() => {
    if (loading) return beginPageLoading();
  }, [loading]);
}
