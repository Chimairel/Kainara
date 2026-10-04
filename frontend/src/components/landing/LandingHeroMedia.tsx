'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/axios';
import type { LandingMedia } from '@/features/website-content/types';
import LandingMediaDisplay from './LandingMediaDisplay';

export default function LandingHeroMedia() {
  const [media, setMedia] = useState<LandingMedia | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
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
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);
  if (loading)
    return (
      <div
        role="status"
        aria-label="Loading website media"
        aria-busy="true"
        className="flex h-full w-full items-center justify-center bg-[#071914]"
      >
        <LoaderCircle aria-hidden="true" className="h-7 w-7 text-white/40 motion-safe:animate-spin" />
      </div>
    );
  return <LandingMediaDisplay media={media} />;
}
