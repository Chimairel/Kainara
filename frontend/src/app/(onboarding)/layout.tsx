'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import RouteGuard from '@/components/shared/RouteGuard';
import ThemeToggle from '@/components/ui/ThemeToggle';
import KainaraLogo from '@/components/shared/KainaraLogo';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <div className="min-h-screen bg-brand-bg text-brand-text selection:bg-brand-accentSoft selection:text-[#0d2820]">
        <header className="w-full border-b border-brand-border bg-brand-bg">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-7">
            <Link href="/" className="group flex items-center gap-2.5" aria-label="KAINARA home">
              <span className="relative flex h-8 w-8 items-center justify-center transition-transform group-hover:scale-105">
                <KainaraLogo className="h-8 w-8" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-brand-bg bg-brand-green" />
              </span>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-black tracking-[0.16em] text-brand-text">KAINARA</span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-brand-muted">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-green" />
                <span>Private health profile</span>
              </div>
              <ThemeToggle size="sm" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-5 py-7 sm:px-7 sm:py-10">{children}</main>
      </div>
    </RouteGuard>
  );
}
