'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/axios';
import type { LandingMedia } from '@/features/website-content/types';
import LandingMediaDisplay from './LandingMediaDisplay';

export default function LandingHeroMedia() {
  const [media, setMedia] = useState<LandingMedia | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    void fetch(`${getApiBaseUrl()}/public/landing-media`, {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (!controller.signal.aborted && result.success) setMedia(result.data);
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timeout));
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);
  return <LandingMediaDisplay media={media} />;
}
