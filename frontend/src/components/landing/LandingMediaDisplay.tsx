'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import type { LandingMedia } from '@/features/website-content/types';

export default function LandingMediaDisplay({ media }: { media: LandingMedia | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pausedByUser = useRef(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    setFailed(false);
    setPlaying(false);
    setMuted(true);
    pausedByUser.current = false;
  }, [media?.url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed) return;
    let visible = false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const update = () => {
      if (!visible || document.hidden) video.pause();
      else if (!pausedByUser.current && !motion.matches && !connection?.saveData)
        void video.play().catch(() => undefined);
    };
    // With no observer support, leave the poster and manual controls available.
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
              update();
            },
            { threshold: 0.25 }
          )
        : null;
    observer?.observe(video);
    document.addEventListener('visibilitychange', update);
    motion.addEventListener?.('change', update);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
      motion.removeEventListener?.('change', update);
      video.pause();
    };
  }, [media?.url, failed]);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      pausedByUser.current = true;
      video.pause();
    } else {
      pausedByUser.current = false;
      try {
        await video.play();
      } catch {
        pausedByUser.current = true;
      }
    }
  };

  if (!media || media.kind === 'image' || failed) {
    const url = !media
      ? '/dashboard-actual.png'
      : media.kind === 'image' && !failed
        ? media.url
        : media.posterUrl || '/dashboard-actual.png';
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={media?.altText || 'Example KAINARA nutrition dashboard'}
        className="h-full w-full object-cover object-top"
        loading="eager"
        onError={(event) => {
          if (!event.currentTarget.src.endsWith('/dashboard-actual.png'))
            event.currentTarget.src = '/dashboard-actual.png';
        }}
      />
    );
  }
  return (
    <div className="relative h-full w-full bg-[#071914]">
      <video
        key={media.url}
        ref={videoRef}
        src={media.url}
        poster={media.posterUrl || undefined}
        muted={muted}
        loop
        playsInline
        preload="none"
        aria-label={media.altText}
        className="h-full w-full object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          type="button"
          onClick={() => void togglePlayback()}
          aria-label={playing ? 'Pause promotional video' : 'Play promotional video'}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white focus-visible:ring-2 focus-visible:ring-white"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          aria-label={muted ? 'Enable video sound' : 'Mute video sound'}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white focus-visible:ring-2 focus-visible:ring-white"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
