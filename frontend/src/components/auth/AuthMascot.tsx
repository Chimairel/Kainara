'use client';

import { useSyncExternalStore } from 'react';
import { Mascot } from 'page-mascot';

export const authMascotAssets = {
  directions: '/mascots/nara-tanod-directions.webp',
  reactions: '/mascots/nara-tanod-reactions.webp',
};

const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeMotion(change: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}
const reducedMotion = () => window.matchMedia(motionQuery).matches;
const serverMotion = () => true;

/** Local sprite assets only; Nara never reads form values or authentication state. */
export default function AuthMascot({ size = 120 }: { size?: number }) {
  const staticPortrait = useSyncExternalStore(subscribeMotion, reducedMotion, serverMotion);
  return (
    <div
      className="relative aspect-square w-full shrink-0 rounded-2xl has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-brand-green"
      style={{ maxWidth: size }}
      data-auth-mascot
      title={staticPortrait ? 'Nara' : 'Say hello to Nara'}
    >
      {staticPortrait ? (
        <span
          role="img"
          aria-label="Nara wearing her tanod costume"
          className="block h-full w-full"
          style={{
            backgroundImage: `url(${authMascotAssets.directions})`,
            backgroundSize: '300% 300%',
            backgroundPosition: '50% 50%',
            backgroundRepeat: 'no-repeat',
          }}
        />
      ) : (
        <Mascot
          directions={authMascotAssets.directions}
          reactions={authMascotAssets.reactions}
          size={size}
          label="Nara"
          className="!h-full !w-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green"
        />
      )}
    </div>
  );
}
