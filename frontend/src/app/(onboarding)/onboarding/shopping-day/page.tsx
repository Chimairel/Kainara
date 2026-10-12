'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import OnboardingStep, { OnboardingActions, OnboardingChoice } from '@/components/onboarding/OnboardingStep';
import ProfileSettingsSection from '@/components/user/ProfileSettingsSection';
import { ShoppingDayOfWeek } from '@/types';
import { ShoppingCart, Calendar, AlertTriangle, ArrowRight } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { invalidateSessionResource } from '@/lib/session-resource-cache';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const options = dayNames.map((day, index) => ({
  value: index as ShoppingDayOfWeek,
  icon: index === 0 || index === 6 ? <ShoppingCart className="h-5 w-5" /> : <Calendar className="h-5 w-5" />,
  title: day,
  desc: `Your 7-day meal cycle starts ${dayNames[(index + 1) % 7]}`,
}));

export default function OnboardingShoppingDayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromReview = searchParams.get('from') === 'review';
  const { profile, isLoading: isHydrating } = useProfile();
  const { user, refreshSession } = useAuth();
  const [selected, setSelected] = useState<ShoppingDayOfWeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const exactDay = profile?.userProfile?.shoppingDayOfWeek;
    if (typeof exactDay === 'number' && exactDay >= 0 && exactDay <= 6) {
      setSelected(exactDay as ShoppingDayOfWeek);
      return;
    }
    const legacyGroup = profile?.userProfile?.shoppingDayGroup;
    if (legacyGroup === 'WEEKEND') setSelected(6);
    if (legacyGroup === 'WEEKDAY') setSelected(0);
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selected === null) {
      setError('Please select your preferred shopping day to continue.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/user/onboarding/shopping-day', { shoppingDayOfWeek: selected });
      const ownerId = user?.userId || profile?.id;
      // This endpoint returns only UserProfile fields, not the full account,
      // safety declarations and consent versions expected by useProfile.
      invalidateSessionResource(ownerId, 'user-profile');
      router.push('/onboarding/tos');
      void refreshSession();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save your preference. Please try again.'));
      setIsLoading(false);
    }
  };

  return (
    <OnboardingStep
      step={5}
      title="Grocery schedule"
      description="Choose your preferred shopping day to organize your weekly meal cycle."
      backHref={isFromReview ? '/onboarding/tos' : '/onboarding/allergies'}
      backLabel={isFromReview ? 'Back to Review' : 'Back to Step 4'}
    >
      {error && (
        <div role="alert" className="flex items-start gap-2 p-5 text-sm text-status-error-text">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="divide-y divide-brand-border">
        <ProfileSettingsSection title="Shopping day" description="Your 7-day meal cycle starts the day after you shop.">
          <fieldset disabled={isLoading || isHydrating} className="grid gap-3 sm:grid-cols-2" aria-label="Shopping day">
            {options.map((opt) => (
              <OnboardingChoice
                key={opt.value}
                id={`shopping-day-${opt.value}`}
                label={opt.title}
                description={opt.desc}
                icon={opt.icon}
                selected={selected === opt.value}
                onClick={() => setSelected(opt.value)}
              />
            ))}
          </fieldset>
        </ProfileSettingsSection>
        <OnboardingActions>
          <Button type="submit" disabled={selected === null || isHydrating} isLoading={isLoading}>
            {isFromReview ? 'Save & Return to Review' : 'Continue to Step 6'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingStep>
  );
}
