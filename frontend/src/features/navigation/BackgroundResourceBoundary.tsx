'use client';

import { useEffect, useRef } from 'react';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import { cancelBackgroundResources, invalidateBackgroundResources } from './background-resources';

export default function BackgroundResourceBoundary({ ownerId }: { ownerId?: string }) {
  const activeOwner = useRef(ownerId);
  useEffect(() => {
    if (!ownerId) return;
    activeOwner.current = ownerId;
    const invalidate = () => invalidateBackgroundResources(ownerId);
    window.addEventListener(LIVE_UPDATE_EVENT, invalidate);
    window.addEventListener('kainara:membership-updated', invalidate);
    return () => {
      window.removeEventListener(LIVE_UPDATE_EVENT, invalidate);
      window.removeEventListener('kainara:membership-updated', invalidate);
      activeOwner.current = undefined;
      // React's development effect replay remounts the same account synchronously.
      // Cancel only after that replay has had a chance to restore the owner.
      queueMicrotask(() => {
        if (activeOwner.current !== ownerId) cancelBackgroundResources(ownerId);
      });
    };
  }, [ownerId]);
  return null;
}
