'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { ProfileSettingsSurface } from '@/components/user/ProfileSettingsSection';
import OnboardingProgressSlider from './OnboardingProgressSlider';

/** Presentation only: callers retain their save, validation and next-step contracts. */
export default function OnboardingStep({
  step,
  title,
  description,
  backHref,
  backLabel = 'Back',
  surface = true,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  surface?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 [&_input]:min-h-11 [&_label]:text-sm">
      <OnboardingProgressSlider currentStep={step} />
      <header className="space-y-3 pb-1">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-brand-muted transition-colors hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
        )}
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-text sm:text-4xl">{title}</h1>
        {description && <p className="max-w-prose text-sm leading-relaxed text-brand-muted">{description}</p>}
      </header>
      {surface ? <ProfileSettingsSurface>{children}</ProfileSettingsSurface> : children}
    </div>
  );
}

export function OnboardingChoice({
  selected,
  label,
  description,
  icon,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected: boolean;
  label: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`flex min-h-12 items-start gap-3 rounded-xl border p-4 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-brand-accentSoft bg-brand-accentSoft text-[#0d2820]' : 'border-brand-border bg-brand-bgAlt/40 text-brand-text hover:border-brand-accent/50 hover:bg-brand-accent/5'} ${className}`}
      {...props}
    >
      {icon && (
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-semibold">{label}</span>
        {description && <span className="mt-1 block text-xs leading-relaxed opacity-90">{description}</span>}
      </span>
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-[#0d2820] bg-[#0d2820] text-white' : 'border-brand-muted/50'}`}
        aria-hidden="true"
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

export function OnboardingActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-end gap-3 px-5 py-5 sm:px-7 [&_button]:w-full sm:[&_button]:w-auto">
      {children}
    </div>
  );
}
