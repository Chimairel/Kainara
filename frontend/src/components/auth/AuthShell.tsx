'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import KainaraLogo from '@/components/shared/KainaraLogo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { SignInPage } from '@/components/ui/sign-in';
import AuthHeroPanel from './AuthHeroPanel';
import AuthMascot from './AuthMascot';

interface AuthShellProps {
  eyebrow: string;
  title: ReactNode;
  heroTitle: ReactNode;
  heroDescription: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  transition?: ReactNode;
}

export default function AuthShell({ footer, ...props }: AuthShellProps) {
  const header = (
    <>
      <Link href="/" className="flex items-center gap-3" aria-label="KAINARA home">
        <KainaraLogo className="h-10 w-10" />
        <span>
          <span className="block font-display text-sm font-extrabold tracking-[0.16em]">KAINARA</span>
          <span className="block font-mono text-[7px] uppercase tracking-[0.2em] text-brand-muted">
            Nutrition intelligence
          </span>
        </span>
      </Link>
      <ThemeToggle size="sm" className="rounded-full" />
    </>
  );
  return (
    <SignInPage
      {...props}
      header={header}
      titleDecoration={
        <div className="w-[160px] lg:hidden">
          <AuthMascot size={160} />
        </div>
      }
      heroContent={<AuthHeroPanel header={header} />}
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
