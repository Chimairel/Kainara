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
export default function AuthMascot() {
  const staticPortrait = useSyncExternalStore(subscribeMotion, reducedMotion, serverMotion);
  return (
    <div className="shrink-0" data-auth-mascot title={staticPortrait ? 'Nara' : 'Say hello to Nara'}>
      {staticPortrait ? (
        <span
          role="img"
          aria-label="Nara wearing her tanod costume"
          className="block h-[120px] w-[120px]"
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
          size={120}
          label="Nara"
          className="rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green"
        />
      )}
    </div>
  );
}
