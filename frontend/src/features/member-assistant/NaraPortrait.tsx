'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Mascot } from '@/components/auth/NaraSprite';

export type NaraMood = 'follow' | 'front' | 'thinking' | 'failed' | 'smile';
const thinkingGaze = ['up-left', 'center', 'up-right'] as const;
const defaultMascotAssets = {
  directions: '/mascots/nara-default-directions.webp',
  reactions: '/mascots/nara-default-reactions.webp',
};

/** One active portrait; message avatars stay still and install no pointer listeners. */
export default function NaraPortrait({ mood = 'front', size = 40 }: { mood?: NaraMood; size?: number }) {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (mood !== 'thinking' || reducedMotion) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      clearInterval(timer);
      setStep(0);
      if (!document.hidden) timer = setInterval(() => setStep(current => (current + 1) % thinkingGaze.length), 700);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', sync); };
  }, [mood, reducedMotion]);
  return <span aria-hidden="true" data-nara-mood={mood} className="relative inline-flex shrink-0 overflow-hidden" style={{ width: size, height: size }}>
    {/* Fit the default atlas, including its bun and reaction symbols, inside the portrait. */}
    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <Mascot directions={defaultMascotAssets.directions} reactions={defaultMascotAssets.reactions}
        size={size * 1.2} interactive={false} trackPointer={mood === 'follow' && !reducedMotion}
        direction={mood === 'follow' && !reducedMotion ? undefined : mood === 'thinking' && !reducedMotion ? thinkingGaze[step] : 'center'}
        reaction={mood === 'failed' ? 'dizzy' : mood === 'smile' ? 'delighted' : undefined} />
    </span>
  </span>;
}
