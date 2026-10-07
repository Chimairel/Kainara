'use client';

import { useSyncExternalStore } from 'react';
import { Mascot } from 'page-mascot';

const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeMotion(change: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}
const reducedMotion = () => window.matchMedia(motionQuery).matches;
const serverMotion = () => true;

/** Local sprite assets only; Nara never reads form values or authentication state. */
export default function AuthMascot({ size = 120, portrait = false }: { size?: number; portrait?: boolean }) {
  const staticPortrait = useSyncExternalStore(subscribeMotion, reducedMotion, serverMotion);
  return (
    <div
      className="relative shrink-0 rounded-2xl has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-brand-green"
      style={{
        width: '100%',
        maxWidth: size,
        aspectRatio: portrait ? '2 / 3' : '1',
        overflow: portrait ? 'hidden' : undefined,
      }}
      data-auth-mascot
      title={staticPortrait ? 'Nara' : 'Say hello to Nara'}
    >
      <div
        className="absolute left-1/2 top-1/2 aspect-square w-full"
        style={{ transform: `translate(-50%, -50%) scale(${portrait ? 2 : 1})` }}
      >
        {staticPortrait ? (
          <span
            role="img"
            aria-label="Nara wearing her tanod costume"
            className="block h-full w-full"
            style={{
              backgroundImage: 'url(/mascots/nara-tanod-directions.webp)',
              backgroundSize: '300% 300%',
              backgroundPosition: '50% 50%',
              backgroundRepeat: 'no-repeat',
            }}
          />
        ) : (
          <Mascot
            directions="/mascots/nara-tanod-directions.webp"
            reactions="/mascots/nara-tanod-reactions.webp"
            size={size}
            label="Nara"
            className="!h-full !w-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green"
          />
        )}
      </div>
    </div>
  );
}
