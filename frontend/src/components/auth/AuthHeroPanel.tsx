'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { preload } from 'react-dom';
import Image from 'next/image';
import ThemeToggle from '@/components/ui/ThemeToggle';
import AuthMascot, { authMascotAssets } from './AuthMascot';
import styles from './AuthHeroPanel.module.css';

export default function AuthHeroPanel({ header }: { header: ReactNode }) {
  const [houseReady, setHouseReady] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);
  const [mascotReady, setMascotReady] = useState(false);
  const sceneReady = houseReady && photoReady && mascotReady;

  for (const src of Object.values(authMascotAssets)) {
    preload(src, { as: 'image', fetchPriority: 'high' });
  }

  useEffect(() => {
    let active = true;
    const images = Object.values(authMascotAssets).map((src) => {
      const image = new window.Image();
      image.src = src;
      return image.decode();
    });
    // A failed decorative asset must not keep the remaining scene hidden forever.
    void Promise.allSettled(images).then(() => {
      if (active) setMascotReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex h-full flex-col p-4 xl:p-6">
      <header className="flex items-center gap-4">{header}</header>
      <div
        className={styles.stage}
        data-auth-kubo-stage
        data-auth-scene-ready={sceneReady}
        inert={!sceneReady}
        aria-hidden={!sceneReady}
        style={{ opacity: sceneReady ? 1 : 0, pointerEvents: sceneReady ? 'auto' : 'none' }}
      >
        <div className={styles.scene} data-auth-kubo>
          <div className={styles.window} data-auth-kubo-window>
            <Image
              src="/photos/capstone-team-window-right.png"
              alt="The KAINARA capstone team working together"
              fill
              priority
              sizes="(min-width: 1024px) 560px, 100vw"
              className={styles.teamPhoto}
              onLoad={() => setPhotoReady(true)}
              onError={() => setPhotoReady(true)}
            />
            <div className={styles.nara}>
              <AuthMascot size={1024} />
            </div>
          </div>
          <Image
            src="/icons/bahay-kubo.svg"
            alt=""
            width={1024}
            height={765}
            priority
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none"
            onLoad={() => setHouseReady(true)}
            onError={() => setHouseReady(true)}
          />
          <div className={styles.lamp} data-auth-bulb>
            <svg viewBox="0 0 72 138" aria-hidden="true" className={styles.bulb}>
              <path d="M36 0v44" className={styles.cord} />
              <rect x="25" y="43" width="22" height="20" rx="5" className={styles.socket} />
              <path
                d="M36 59C18 59 7 73 7 91c0 22 13 39 29 39s29-17 29-39c0-18-11-32-29-32Z"
                className={styles.glass}
              />
              <path d="M19 85c0-8 4-14 9-17" className={styles.shine} />
            </svg>
            <ThemeToggle size="lg" variant="bulb" className={styles.bulbToggle} />
          </div>
        </div>
      </div>
    </div>
  );
}
