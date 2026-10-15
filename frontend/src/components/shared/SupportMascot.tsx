'use client';

import { useState, useSyncExternalStore } from 'react';
import { Mascot } from '@/components/auth/NaraSprite';

export const supportMascotAssets = {
  directions: '/mascots/nara-va-directions.webp',
  reactions: '/mascots/nara-va-reactions.webp',
};

const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeMotion(change: () => void) {
  const query = window.matchMedia?.(motionQuery);
  if (!query) return () => {};
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}
const reducedMotion = () => window.matchMedia?.(motionQuery).matches ?? true;
const serverMotion = () => true;

/** Help's local Nara artwork; interactions never read or submit the support form. */
export default function SupportMascot({ size = 160 }: { size?: number }) {
  const staticPortrait = useSyncExternalStore(subscribeMotion, reducedMotion, serverMotion);
  const [smiling, setSmiling] = useState(false);

  return (
    <div
      className="relative aspect-square w-full shrink-0 rounded-2xl has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-brand-green"
      style={{ maxWidth: size }}
      data-support-mascot
      title={staticPortrait ? 'Nara' : 'Say hello to Nara'}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setSmiling(true); }}
      onPointerLeave={() => setSmiling(false)}
      onPointerDown={() => setSmiling(false)}
      onKeyDown={() => setSmiling(false)}
    >
      {staticPortrait ? (
        <span
          role="img"
          aria-label="Nara wearing a support headset"
          className="block h-full w-full"
          style={{
            backgroundImage: `url(${supportMascotAssets.directions})`,
            backgroundSize: '300% 300%',
            backgroundPosition: '50% 50%',
            backgroundRepeat: 'no-repeat',
          }}
        />
      ) : (
        <Mascot
          directions={supportMascotAssets.directions}
          reactions={supportMascotAssets.reactions}
          size={size}
          label="Nara"
          reaction={smiling ? 'delighted' : undefined}
          className="!h-full !w-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green"
        />
      )}
    </div>
  );
}
