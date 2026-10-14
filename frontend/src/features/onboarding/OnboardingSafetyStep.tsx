'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import OnboardingStep from '@/components/onboarding/OnboardingStep';
import Button from '@/components/ui/Button';
import ProfileSettingsSection from '@/components/user/ProfileSettingsSection';
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
}: OnboardingSafetyStepProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromReview = searchParams.get('from') === 'review';
  const { profile, isLoading, error, refresh } = useProfile({ requireFresh: true });
  const { refreshSession } = useAuth();
  const initialEntries = useMemo(() => safetyInputsFromProfile(profile), [profile]);

  return (
    <OnboardingStep
      step={step}
      title={title}
      description={description}
      backHref={isFromReview ? '/onboarding/tos' : backHref}
      backLabel={isFromReview ? 'Back to Review' : backLabel}
    >
      <ProfileSettingsSection title="Your declarations" description={guidance}>
        {isLoading ? (
          <p className="text-sm text-brand-muted">Loading your safety profile…</p>
        ) : error || !profile ? (
          <FeedbackNotice>
            <p>{error || 'Your safety profile could not be loaded.'}</p>
            <Button type="button" onClick={() => void refresh()} variant="secondary">
              Try again
            </Button>
          </FeedbackNotice>
        ) : (
          <StructuredSafetyIntake
            presentation="profile"
            initialEntries={initialEntries}
            editableDomains={editableDomains}
            submitLabel={isFromReview ? 'Save & Return to Review' : 'Save and continue →'}
            onSaved={async () => {
              router.push(isFromReview ? '/onboarding/tos' : nextHref);
              void refreshSession();
            }}
          />
        )}
      </ProfileSettingsSection>
    </OnboardingStep>
  );
}
