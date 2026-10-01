'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Card from '@/components/ui/Card';
import OnboardingProgressSlider from '@/components/onboarding/OnboardingProgressSlider';
import StructuredSafetyIntake from '@/components/user/StructuredSafetyIntake';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { safetyInputsFromProfile } from '@/lib/safety-intake';
import type { SafetyEntryDomain } from '@/types';

interface OnboardingSafetyStepProps {
  step: number;
  progress?: number;
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
  guidance: string;
  editableDomains: SafetyEntryDomain[];
  nextHref: string;
  offerClinicalDocuments?: boolean;
}

export default function OnboardingSafetyStep({
  step,
  backHref,
  backLabel,
  title,
  description,
  guidance,
  editableDomains,
  nextHref,
  offerClinicalDocuments = false,
}: OnboardingSafetyStepProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromReview = searchParams.get('from') === 'review';
  const { profile, isLoading, error, refresh } = useProfile({ requireFresh: true });
  const { refreshSession } = useAuth();
  const initialEntries = useMemo(() => safetyInputsFromProfile(profile), [profile]);

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 select-none my-auto">
      {/* Step Slider */}
      <OnboardingProgressSlider currentStep={step} totalSteps={6} />

      <Card className="relative overflow-hidden border-brand-border/80 dark:border-[#173e33] dark:bg-[#09221b]/90 p-6 sm:p-7 shadow-2xl glass-panel rounded-3xl">
        {/* Subtle Brand Wave Accent in Top-Right Corner */}
        <div className="absolute top-0 right-0 h-16 w-16 pointer-events-none overflow-hidden rounded-tr-3xl">
          <div className="absolute -top-8 -right-8 h-16 w-16 rounded-full bg-brand-green/10 dark:bg-brand-accent/15 blur-sm" />
        </div>

        <button
          type="button"
          onClick={() => router.push(isFromReview ? '/onboarding/tos' : backHref)}
          className="mb-3 flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green transition-colors w-fit"
        >
          <ArrowLeft className="h-3 w-3 shrink-0" />
          <span>{isFromReview ? 'Back to Review' : backLabel}</span>
        </button>

        <div className="flex flex-col gap-1 mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-brand-green/10 text-brand-green border border-brand-green/20 dark:bg-brand-accent/15 dark:text-brand-accent dark:border-brand-accent/30">
              {step === 3 ? 'Step 03 / 06 · Medical Safety' : 'Step 04 / 06 · Allergen Profile'}
            </span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-brand-green">{title}</h1>
          <p className="mt-1 text-xs text-brand-muted leading-relaxed">{description}</p>
        </div>

        <div className="my-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span className="leading-relaxed font-medium">{guidance}</span>
        </div>

        {isLoading ? (
          <p className="text-sm text-brand-muted">Loading your safety profile…</p>
        ) : error || !profile ? (
          <div role="alert" className="space-y-3 text-sm text-status-error-text">
            <p>{error || 'Your safety profile could not be loaded.'}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-xl border border-brand-border px-4 py-2 font-bold hover:bg-brand-bgAlt"
            >
              Try again
            </button>
          </div>
        ) : (
          <StructuredSafetyIntake
            initialEntries={initialEntries}
            editableDomains={editableDomains}
            submitLabel={isFromReview ? 'Save & Return to Review' : 'Save and continue →'}
            onSaved={async (entries) => {
              const hasDeclaredCondition = entries.some(
                (entry) => entry.domain === 'CONDITION' && entry.canonicalCode !== 'NONE'
              );
              const nextTarget =
                offerClinicalDocuments && hasDeclaredCondition
                  ? `/onboarding/clinical-evidence${isFromReview ? '?from=review' : ''}`
                  : isFromReview
                    ? '/onboarding/tos'
                    : nextHref;
              router.push(nextTarget);
              void refreshSession();
            }}
          />
        )}
      </Card>
    </div>
  );
}
