'use client';

import type { ReactNode } from 'react';
import AuthMascot from './AuthMascot';
import styles from './AuthHeroPanel.module.css';

export default function AuthHeroPanel({ header }: { header: ReactNode }) {
  return (
    <div className="flex h-full flex-col p-8 xl:p-12">
      <header className="flex items-center justify-between gap-4">{header}</header>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className={styles.mascot}>
          <AuthMascot size={720} />
        </div>
      </div>
    </div>
  );
}
