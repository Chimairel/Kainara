'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import OnboardingStep from '@/components/onboarding/OnboardingStep';
import ProfileSettingsSection from '@/components/user/ProfileSettingsSection';
import Checkbox from '@/components/ui/Checkbox';
import { ArrowRight, Pencil } from '@/components/ui/icons';
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
        ['Breakfast', profile?.mealReminderSettings?.breakfastTime || 'Not provided'],
        ['Lunch', profile?.mealReminderSettings?.lunchTime || 'Not provided'],
        ['Dinner', profile?.mealReminderSettings?.dinnerTime || 'Not provided'],
        ['Meal timezone', profile?.mealReminderSettings?.timeZone || 'Not provided'],
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
      await api.post('/user/onboarding/complete');

      // 3. Refresh Auth session context to pull new onboardingDone & tosAccepted parameters
      await refreshSession();

      // 4. The first real report must be generated, read, and acknowledged
      // before the backend permits meal planning or other protected actions.
      router.replace('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err, 'An error occurred while finalizing onboarding. Please try again.'));
      setIsLoading(false);
    }
  };

  return (
    <OnboardingStep
      step={6}
      title="Review your onboarding details"
      description="Confirm the information used for your calorie target, safety checks, nutrition report, and meal-plan recommendations before giving consent."
      backHref="/onboarding/shopping-day"
      backLabel="Back to Step 5"
    >
      {isHydrating ? (
        <p role="status" className="p-7 text-sm text-brand-muted">
          Loading your saved onboarding details…
        </p>
      ) : (
        !profileUnavailable &&
        reviewSections.map((section) => (
          <ProfileSettingsSection key={section.title} title={section.title} description="">
            <div className="mb-4 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.push(section.editPath)}
                aria-label={`Edit ${section.title.toLowerCase()}`}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </Button>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              {section.items.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-brand-muted">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-brand-text">{value}</dd>
                </div>
              ))}
            </dl>
          </ProfileSettingsSection>
        ))
      )}
      <div className="px-5 pt-7 sm:px-7">
        <h2 className="font-display text-xl font-bold">Legal terms & protection</h2>
        <p className="mt-2 text-sm leading-relaxed text-brand-muted">
          Please review our clinical guidelines, medical disclaimers, and data protection terms below.
        </p>
      </div>
      {displayedError && (
        <FeedbackNotice>
          <span className="min-w-0 flex-1">{displayedError}</span>
          {profileUnavailable && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null);
                void refresh();
              }}
            >
              Try again
            </Button>
          )}
        </FeedbackNotice>
      )}
      <form onSubmit={handleSubmit} className="space-y-5 px-5 py-7 sm:px-7">
        <Checkbox
          id="medicalDisclaimer"
          checked={medicalDisclaimer}
          onCheckedChange={(checked) => setMedicalDisclaimer(!!checked)}
          label={
            <span className="text-sm text-brand-text leading-relaxed">
              I understand that AI-generated meal plans are NOT medical advice. If managing chronic conditions, I agree
              to follow our{' '}
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
            <span className="text-sm text-brand-text leading-relaxed">
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
            <span className="text-sm text-brand-text leading-relaxed">
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
          className="w-full sm:w-auto"
          disabled={!medicalDisclaimer || !privacyPolicy || !healthDataProcessing || !consentReady}
          isLoading={isLoading}
        >
          Complete Onboarding & Review Report <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </OnboardingStep>
  );
}
