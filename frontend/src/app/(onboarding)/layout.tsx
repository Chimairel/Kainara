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
      <div className="relative min-h-screen bg-brand-bg text-brand-text flex flex-col justify-between selection:bg-brand-green/20 selection:text-brand-green">
        {/* Subtle Ambient River Gradient Glows */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[12%] left-[10%] h-[500px] w-[500px] rounded-full bg-[#10b981]/8 blur-[140px] dark:bg-[#10b981]/12" />
          <div className="absolute top-[35%] -right-[5%] h-[450px] w-[450px] rounded-full bg-[#f09e6c]/7 blur-[150px] dark:bg-[#f09e6c]/9" />
          <div className="absolute -bottom-[10%] left-[20%] h-[550px] w-[550px] rounded-full bg-[#eb6a38]/6 blur-[160px] dark:bg-[#eb6a38]/8" />
        </div>

        {/* Minimal Clean Top Header */}
        <header className="w-full border-b border-brand-border/50 bg-brand-bg/80 backdrop-blur-md sticky top-0 z-40">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="group flex items-center gap-2.5" aria-label="KAINARA home">
              <span className="relative flex h-8 w-8 items-center justify-center transition-transform group-hover:scale-105">
                <KainaraLogo className="h-8 w-8" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-brand-bg bg-brand-green" />
              </span>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-black tracking-[0.16em] text-brand-text">KAINARA</span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-brand-green/20 bg-brand-green/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-green">
                  Clinical Intake
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-brand-muted bg-brand-bgAlt/50 border border-brand-border/60 rounded-full px-2.5 py-1">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-green" />
                <span>Private health profile</span>
              </div>
              <ThemeToggle size="sm" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 flex flex-col items-center justify-center py-6 px-4 sm:px-6">{children}</main>
      </div>
    </RouteGuard>
  );
}
