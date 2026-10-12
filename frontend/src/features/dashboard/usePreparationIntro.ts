'use client';

import { useEffect, useRef, useState } from 'react';

export const PREPARATION_INTRO_MS = 5_000;

/** A presentation delay only: preparation and polling continue in the background. */
export function usePreparationIntro(active: boolean, scope: string, cancelled: boolean) {
  const previous = useRef({ active: false, scope });
  const [intro, setIntro] = useState<{ scope: string; until: number } | null>(null);
  const [expired, setExpired] = useState<number | null>(null);
  useEffect(() => {
    if (cancelled) {
      setIntro(null);
    } else if (active && (!previous.current.active || previous.current.scope !== scope)) {
      setIntro({ scope, until: Date.now() + PREPARATION_INTRO_MS });
    }
    previous.current = { active: active && !cancelled, scope };
  }, [scope, cancelled, active]);
  useEffect(() => {
    if (!intro) return;
    const timer = window.setTimeout(() => setExpired(intro.until), Math.max(0, intro.until - Date.now()));
    return () => window.clearTimeout(timer);
  }, [intro]);
  // Completion keeps the intro; failure, account changes and eligibility gates do not.
  return !cancelled && (intro?.scope === scope ? expired !== intro.until : active);
}
