'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import KainaraLogo from '@/components/shared/KainaraLogo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { SignInPage } from '@/components/ui/sign-in';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  heroTitle: ReactNode;
  heroDescription: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  transition?: ReactNode;
}

export default function AuthShell({ heroTitle, heroDescription, footer, ...props }: AuthShellProps) {
  return (
    <SignInPage
      {...props}
      header={
        <>
          <Link href="/" className="flex items-center gap-3" aria-label="KAINARA home">
            <KainaraLogo className="h-10 w-10" />
            <span className="font-display text-sm font-extrabold tracking-[0.16em]">KAINARA</span>
          </Link>
          <ThemeToggle size="sm" className="rounded-full" />
        </>
      }
      heroImageSrc="/auth/kainara-ribbons.svg"
      heroContent={
        <div className="relative flex min-h-full flex-col justify-between gap-12 p-8 xl:p-12">
          <div className="max-w-lg">
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/80">
              Nutrition intelligence
            </p>
            <h2 className="font-display text-4xl font-bold leading-[1.08] tracking-tight xl:text-5xl">{heroTitle}</h2>
          </div>
          <div className="rounded-3xl border border-white/20 bg-[#071914]/65 p-6 backdrop-blur-xl">
            <p className="max-w-md text-sm leading-relaxed text-white/90">{heroDescription}</p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium text-white/85">
              <span className="inline-flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-[#f09e6c]" /> Familiar food
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#f09e6c]" /> Visible review states
              </span>
            </div>
          </div>
        </div>
      }
      footer={
        <>
          {footer && <div className="text-center text-sm text-brand-muted">{footer}</div>}
          <Link
            href="/"
            className="mx-auto flex w-fit items-center gap-2 text-xs font-medium text-brand-muted hover:text-brand-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </>
      }
    />
  );
}
