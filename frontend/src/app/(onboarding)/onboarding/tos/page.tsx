'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import OnboardingProgressSlider from '@/components/onboarding/OnboardingProgressSlider';
import Checkbox from '@/components/ui/Checkbox';
import { AlertTriangle, ArrowLeft, ClipboardCheck, Pencil } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { useProfile } from '@/hooks/useProfile';
import { normalizeExclusiveNone, normalizeFoodCulture } from '@/lib/profile-normalization';
import type { SafetyProfileEntry } from '@/types';

function formatOnboardingValue(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return 'Not provided';
  if (typeof value === 'number') return String(value);
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function joinSelections(values: string[], custom?: string) {
  const selections = normalizeExclusiveNone(values)
    .filter((value) => value !== 'NONE')
    .map(formatOnboardingValue);
  if (custom) selections.push(custom);
  return selections.length > 0 ? selections.join(', ') : 'None declared';
}

function joinStructuredSelections(
  entries: readonly SafetyProfileEntry[] | undefined,
  domain: 'CONDITION' | 'ALLERGY' | 'INTOLERANCE' | 'AVOIDED_INGREDIENT',
  legacy: string
) {
  if (!entries?.length) return legacy;
  const values = entries
    .filter((entry) => entry.domain === domain && entry.canonicalCode !== 'NONE')
    .map((entry) => entry.displayName);
  return values.length > 0 ? values.join(', ') : 'None declared';
}

const shoppingDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatPlanSchedule(dayOfWeek?: number, legacyGroup?: string) {
  if (typeof dayOfWeek === 'number' && dayOfWeek >= 0 && dayOfWeek <= 6) {
    const cycleStart = (dayOfWeek + 1) % 7;
    const cycleEnd = (cycleStart + 6) % 7;
    return `${shoppingDays[dayOfWeek]} shopping · ${shoppingDays[cycleStart]} to ${shoppingDays[cycleEnd]} plan`;
  }
  if (legacyGroup === 'WEEKEND') return 'Weekend shopping · Sunday to Saturday plan';
  if (legacyGroup === 'WEEKDAY') return 'Weekday shopping · Monday to Sunday plan';
  return 'Not provided';
}

export default function OnboardingTosPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const { profile, isLoading: isHydrating, error: profileError, refresh } = useProfile({ requireFresh: true });
  const [medicalDisclaimer, setMedicalDisclaimer] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState(false);
  const [healthDataProcessing, setHealthDataProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const termsVersion = profile?.onboardingStatus?.currentTermsVersion;
  const privacyVersion = profile?.onboardingStatus?.currentPrivacyVersion;
  const consentReady = Boolean(profile && termsVersion && privacyVersion && !profileError && !isHydrating);
  const profileUnavailable = !isHydrating && !consentReady;
  const displayedError =
    error ||
    (profileUnavailable
      ? profileError || 'Your saved details and consent versions could not be loaded. Please try again.'
      : null);

  const userProfile = profile?.userProfile;
  const legacyConditions = joinSelections(profile?.healthConditions ?? [], userProfile?.otherConditions);
  const legacyAllergies = joinSelections(profile?.allergies ?? [], userProfile?.otherAllergies);
  const reviewSections = [
    {
      title: 'Body & goal',
      editPath: '/onboarding/stats?from=review',
      items: [
        ['Age', userProfile?.age ? `${userProfile.age} years` : 'Not provided'],
        ['Biological sex', formatOnboardingValue(userProfile?.biologicalSex)],
        ['Height', userProfile?.heightCm ? `${userProfile.heightCm} cm` : 'Not provided'],
        ['Current weight', userProfile?.weightKg ? `${userProfile.weightKg} kg` : 'Not provided'],
        ['Target weight', userProfile?.targetWeightKg ? `${userProfile.targetWeightKg} kg` : 'Not provided'],
        ['Goal', formatOnboardingValue(userProfile?.goal)],
        ['Activity', formatOnboardingValue(userProfile?.activityLevel)],
      ],
    },
    {
      title: 'Food preferences',
      editPath: '/onboarding/preferences?from=review',
      items: [
        ['Diet', formatOnboardingValue(userProfile?.dietaryPreference)],
        ['Rice preference', formatOnboardingValue(userProfile?.ricePreference)],
        ['Food culture', normalizeFoodCulture(userProfile?.foodCulture)],
      ],
    },
    {
      title: 'Medical conditions',
      editPath: '/onboarding/conditions?from=review',
      items: [['Conditions', joinStructuredSelections(profile?.safetyEntries, 'CONDITION', legacyConditions)]],
    },
    {
      title: 'Food safety',
      editPath: '/onboarding/allergies?from=review',
      items: [
        ['Allergies', joinStructuredSelections(profile?.safetyEntries, 'ALLERGY', legacyAllergies)],
        ['Intolerances', joinStructuredSelections(profile?.safetyEntries, 'INTOLERANCE', 'None declared')],
        ['Avoided foods', joinStructuredSelections(profile?.safetyEntries, 'AVOIDED_INGREDIENT', 'None declared')],
      ],
    },
    {
      title: 'Plan schedule',
      editPath: '/onboarding/shopping-day?from=review',
      items: [['Weekly cycle', formatPlanSchedule(userProfile?.shoppingDayOfWeek, userProfile?.shoppingDayGroup)]],
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!medicalDisclaimer || !privacyPolicy || !healthDataProcessing) {
      setError('You must accept all terms to complete your onboarding.');
      return;
    }

    if (!consentReady || !termsVersion || !privacyVersion) {
      setError('Your saved details and consent versions could not be loaded. Please try again.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Accept ToS
      await api.post('/user/onboarding/tos', {
        termsVersion,
        privacyVersion,
        medicalDisclaimerAccepted: true,
        privacyPolicyAccepted: true,
        healthDataProcessingAccepted: true,
      });

      // 2. Complete Onboarding (Backend calculates targets & updates profiles)
      const completion = await api.post('/user/onboarding/complete');

      // 3. Refresh Auth session context to pull new onboardingDone & tosAccepted parameters
      const refreshed = await refreshSession();

      // 4. The first real report must be generated, read, and acknowledged
      // before the backend permits meal planning or other protected actions.
      const nextPath = completion.data?.data?.nextPath;
      router.replace(
        nextPath === '/dashboard' && refreshed?.reportAcknowledged
          ? '/dashboard'
          : '/profile/nutrition-report?next=dashboard'
      );
    } catch (err) {
      setError(getApiErrorMessage(err, 'An error occurred while finalizing onboarding. Please try again.'));
      setIsLoading(false);
      const failure = (err as { response?: { data?: { errorCode?: string; details?: { nextPath?: string } } } })
        ?.response?.data;
      const path = failure?.details?.nextPath;
      if (
        failure?.errorCode === 'ONBOARDING_INCOMPLETE' &&
        (path === '/onboarding/condition-details' || path === '/onboarding/allergy-details')
      )
        router.push(path);
    }
  };

  return (
    <div className="w-full max-w-xl flex flex-col gap-4 select-none my-auto">
      {/* Onboarding progress */}
      <OnboardingProgressSlider currentStep={6} totalSteps={6} />

      <Card className="relative overflow-hidden p-6 sm:p-7 glass-panel shadow-2xl border-brand-border/80 dark:border-[#173e33] dark:bg-[#09221b]/90 rounded-3xl">
        {/* Subtle Brand Wave Accent in Top-Right Corner */}
        <div className="absolute top-0 right-0 h-16 w-16 pointer-events-none overflow-hidden rounded-tr-3xl">
          <div className="absolute -top-8 -right-8 h-16 w-16 rounded-full bg-brand-green/10 dark:bg-brand-accent/15 blur-sm" />
        </div>

        <button
          type="button"
          onClick={() => router.push('/onboarding/shopping-day')}
          className="mb-4 flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green transition-colors w-fit"
        >
          <ArrowLeft className="h-3 w-3 shrink-0" />
          <span>Back to Step 5</span>
        </button>

        <section aria-labelledby="onboarding-review-heading" className="mb-5">
          <div className="mb-3 flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-brand-green/25 bg-brand-green/10 text-brand-green dark:border-brand-accent/30 dark:bg-brand-accent/15 dark:text-brand-accent">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-brand-green/10 text-brand-green border border-brand-green/20 dark:bg-brand-accent/15 dark:text-brand-accent dark:border-brand-accent/30">
                  Step 06 / 06 · Review & Terms
                </span>
              </div>
              <h1
                id="onboarding-review-heading"
                className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-brand-text"
              >
                Review your onboarding details
              </h1>
              <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">
                Confirm the information used for your calorie target, safety checks, nutrition report, and meal-plan
                recommendations before giving consent.
              </p>
            </div>
          </div>

          {isHydrating ? (
            <div
              className="rounded-2xl border border-brand-border/60 bg-brand-bgAlt/40 px-4 py-4 text-center text-xs text-brand-muted"
              role="status"
            >
              Loading your saved onboarding details…
            </div>
          ) : profileUnavailable ? (
            <p className="text-xs text-brand-muted">Your saved details are unavailable. Retry loading them below.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {reviewSections.map((section) => (
                <div
                  key={section.title}
                  className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/50 p-3.5 shadow-xs"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-text">
                      {section.title}
                    </h2>
                    <button
                      type="button"
                      onClick={() => router.push(section.editPath)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold text-brand-green bg-brand-green/10 transition-all hover:bg-brand-green hover:text-white dark:text-brand-accent dark:bg-brand-accent/15 dark:hover:bg-brand-accent dark:hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                      aria-label={`Edit ${section.title.toLowerCase()}`}
                    >
                      <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                      Edit
                    </button>
                  </div>
                  <dl className="space-y-1.5">
                    {section.items.map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-start justify-between gap-3 border-t border-brand-border/40 pt-1.5 first:border-0 first:pt-0"
                      >
                        <dt className="text-[10px] font-medium text-brand-muted">{label}</dt>
                        <dd className="max-w-[62%] text-right text-[10px] font-semibold leading-relaxed text-brand-text">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-0.5 mb-4">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight font-display text-brand-green">
            LEGAL TERMS & PROTECTION
          </h2>
          <p className="text-xs text-brand-muted">
            Please review our clinical guidelines, medical disclaimers, and data protection terms below.
          </p>
        </div>

        {displayedError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-2xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-semibold flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
            <span className="leading-tight">{displayedError}</span>
            {profileUnavailable && (
              <button
                type="button"
                className="underline shrink-0"
                onClick={() => {
                  setError(null);
                  void refresh();
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <Checkbox
            id="medicalDisclaimer"
            checked={medicalDisclaimer}
            onCheckedChange={(checked) => setMedicalDisclaimer(!!checked)}
            label={
              <span className="text-xs text-brand-text leading-relaxed">
                I understand that AI-generated meal plans are NOT medical advice. If managing chronic conditions, I
                agree to follow our{' '}
                <a
                  href="/docs#clinical-guidelines"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover hover:decoration-brand-green"
                >
                  Clinical Guidelines
                </a>{' '}
                and{' '}
                <a
                  href="/docs#medical-disclaimers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover hover:decoration-brand-green"
                >
                  Medical Disclaimers
                </a>
                .
              </span>
            }
            error={error !== null && !medicalDisclaimer}
          />

          <Checkbox
            id="healthDataProcessing"
            checked={healthDataProcessing}
            onCheckedChange={(checked) => setHealthDataProcessing(!!checked)}
            label={
              <span className="text-xs text-brand-text leading-relaxed">
                I explicitly consent to KAINARA processing my health data and transmitting required meal parameters to
                Google Gemini under the Philippine Data Privacy Act of 2012 (R.A. 10173). Learn more in our{' '}
                <a
                  href="/docs#data-protection-notice"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover hover:decoration-brand-green"
                >
                  Data Protection Notice
                </a>
                .
              </span>
            }
            error={error !== null && !healthDataProcessing}
          />

          <div className="rounded-2xl border border-brand-border/60 bg-brand-bgAlt/50 px-3.5 py-2 text-[10px] leading-relaxed text-brand-muted">
            {isHydrating
              ? 'Loading consent versions…'
              : consentReady
                ? `Consent versions: Terms ${termsVersion} · Privacy ${privacyVersion}`
                : 'Consent versions unavailable.'}
          </div>

          <Checkbox
            id="privacyPolicy"
            checked={privacyPolicy}
            onCheckedChange={(checked) => setPrivacyPolicy(!!checked)}
            label={
              <span className="text-xs text-brand-text leading-relaxed">
                I agree to the{' '}
                <a
                  href="/docs#terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover hover:decoration-brand-green"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="/docs#privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover hover:decoration-brand-green"
                >
                  Privacy Policy
                </a>
                .
              </span>
            }
            error={error !== null && !privacyPolicy}
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3.5 mt-2 text-sm font-bold tracking-wide rounded-2xl shadow-xl shadow-brand-green/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
            disabled={!medicalDisclaimer || !privacyPolicy || !healthDataProcessing || !consentReady}
            isLoading={isLoading}
          >
            Complete Onboarding & Review Report →
          </Button>
        </form>
      </Card>
    </div>
  );
}
