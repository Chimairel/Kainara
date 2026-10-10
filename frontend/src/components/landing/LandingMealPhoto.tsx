'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Utensils } from 'lucide-react';

/** Decorative recipe photos always retain a local, neutral surface while unavailable. */
export default function LandingMealPhoto({
  src,
  name,
  onSettled,
}: {
  src: string;
  name: string;
  onSettled: (name: string) => void;
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'unavailable'>('loading');
  return (
    <div className="absolute inset-0 bg-[#183e33]" data-gallery-photo-state={state}>
      {state !== 'loaded' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#286453] to-[#071914] px-3 pb-12 text-white/70">
          <Utensils className="h-9 w-9" aria-hidden="true" />
          <span className="text-center text-[10px]">
            {state === 'unavailable' ? 'Recipe photo unavailable' : 'Loading recipe photo'}
          </span>
        </div>
      )}
      {state !== 'unavailable' && (
        <Image
          src={src}
          alt=""
          fill
          loading="eager"
          sizes="(min-width: 1024px) 15vw, (min-width: 640px) 155px, 110px"
          className={`object-cover ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => {
            setState('loaded');
            onSettled(name);
          }}
          onError={() => {
            setState('unavailable');
            onSettled(name);
          }}
        />
      )}
    </div>
  );
}
