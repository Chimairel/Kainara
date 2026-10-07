'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import ThemeToggle from '@/components/ui/ThemeToggle';
import AuthMascot from './AuthMascot';
import styles from './AuthHeroPanel.module.css';

export default function AuthHeroPanel({ header }: { header: ReactNode }) {
  return (
    <div className="flex h-full flex-col p-4 xl:p-6">
      <header className="flex items-center gap-4">{header}</header>
      <div className={styles.stage} data-auth-kubo-stage>
        <div className={styles.scene} data-auth-kubo>
          <div className={styles.window} data-auth-kubo-window>
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
