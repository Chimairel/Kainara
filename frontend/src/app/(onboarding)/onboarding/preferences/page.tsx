'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import OnboardingStep, { OnboardingActions, OnboardingChoice } from '@/components/onboarding/OnboardingStep';
import ProfileSettingsSection from '@/components/user/ProfileSettingsSection';
import { DietaryPreference, RicePreference } from '@/types';
import { Ban, Shuffle, Utensils, AlertTriangle, ArrowRight } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { normalizeFoodCulture } from '@/lib/profile-normalization';
import { writeSessionResource } from '@/lib/session-resource-cache';
import MealTimesFields from '@/features/meal-reminders/MealTimesFields';
import { suggestedMealTimes, mealSchedulePayload, type MealReminderSettings } from '@/features/meal-reminders/types';

export default function OnboardingPreferencesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromReview = searchParams.get('from') === 'review';
  const { profile, isLoading: isHydrating } = useProfile();
  const { user, refreshSession } = useAuth();
  const [dietary, setDietary] = useState<DietaryPreference>('OMNIVORE');
  const [ricePreference, setRicePreference] = useState<RicePreference>('FLEXIBLE');
  const [culture, setCulture] = useState('Filipino');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mealTimes, setMealTimes] = useState<MealReminderSettings>(suggestedMealTimes);

  useEffect(() => {
    const saved = profile?.userProfile;
    if (!saved) return;
    if (saved.dietaryPreference) setDietary(saved.dietaryPreference as DietaryPreference);
    if (saved.ricePreference) setRicePreference(saved.ricePreference);
    if (saved.foodCulture) setCulture(normalizeFoodCulture(saved.foodCulture));
    setMealTimes((previous) => {
      const next = profile?.mealReminderSettings ?? previous;
      return JSON.stringify(mealSchedulePayload(previous)) === JSON.stringify(mealSchedulePayload(next))
        ? previous
        : next;
    });
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setIsLoading(true);
    try {
      await api.put('/user/meal-reminders', mealSchedulePayload(mealTimes));
      // Send preference specs to backend profile endpoint to extend user profile
      const response = await api.post('/user/onboarding/profile', {
        dietaryPreference: dietary,
        ricePreference,
        foodCulture: normalizeFoodCulture(culture),
      });

      const ownerId = user?.userId || profile?.id;
      if (response.data?.data && ownerId) {
        writeSessionResource(ownerId, 'user-profile', response.data.data);
      }

      // Proceed to Step 3: Conditions (or Review if from review) immediately
      const nextTarget = isFromReview ? '/onboarding/tos' : '/onboarding/conditions';
      router.push(nextTarget);
      void refreshSession();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save preferences. Please check your connection.'));
      setIsLoading(false);
    }
  };

  const dietaryList: { value: DietaryPreference; label: string; desc: string }[] = [
    { value: 'OMNIVORE', label: 'Omnivore', desc: 'Eat everything (standard Filipino diet)' },
    { value: 'VEGETARIAN', label: 'Vegetarian', desc: 'No meat/poultry/fish. Eggs/dairy fine' },
    { value: 'VEGAN', label: 'Vegan', desc: '100% plant-based diet' },
    { value: 'PESCATARIAN', label: 'Pescatarian', desc: 'Vegetarian + seafood' },
  ];

  const riceOptions: { value: RicePreference; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      value: 'NO_RICE',
      label: 'No rice',
      desc: 'Prefer meals normally eaten without rice',
      icon: <Ban className="w-5 h-5" />,
    },
    {
      value: 'FLEXIBLE',
      label: 'Either',
      desc: 'Include meals with rice and meals without it',
      icon: <Shuffle className="w-5 h-5" />,
    },
    {
      value: 'WITH_RICE',
      label: 'With rice',
      desc: 'Prefer meals commonly served with rice',
      icon: <Utensils className="w-5 h-5" />,
    },
  ];

  return (
    <OnboardingStep
      step={2}
      title="Dietary preferences"
      description="Select your food guidelines and meal planning preferences to tailor the AI recommendations."
      backHref={isFromReview ? '/onboarding/tos' : '/onboarding/stats'}
      backLabel={isFromReview ? 'Back to Review' : 'Back to Step 1'}
    >
      {error && (
        <div role="alert" className="flex items-start gap-2 p-5 text-sm text-status-error-text">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="divide-y divide-brand-border">
        <fieldset
          disabled={isLoading || isHydrating}
          className="contents [&>section+section]:border-t [&>section+section]:border-brand-border"
        >
          <ProfileSettingsSection title="Dietary pattern" description="">
            <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Dietary Pattern">
              {dietaryList.map((item) => (
                <OnboardingChoice
                  key={item.value}
                  label={item.label}
                  description={item.desc}
                  selected={dietary === item.value}
                  onClick={() => setDietary(item.value)}
                />
              ))}
            </div>
          </ProfileSettingsSection>
          <ProfileSettingsSection title="Rice preference" description="How do you prefer rice with your meals?">
            <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Rice preference">
              {riceOptions.map((item) => (
                <OnboardingChoice
                  key={item.value}
                  label={item.label}
                  description={item.desc}
                  icon={item.icon}
                  selected={ricePreference === item.value}
                  onClick={() => setRicePreference(item.value)}
                />
              ))}
            </div>
          </ProfileSettingsSection>
          <ProfileSettingsSection
            title="Meal times"
            description="These are suggested times—adjust them to your routine. You can enable preparation and logging reminders later in Food & planning."
          >
            <MealTimesFields value={mealTimes} onChange={setMealTimes} disabled={isLoading || isHydrating} />
          </ProfileSettingsSection>
        </fieldset>
        <OnboardingActions>
          <Button type="submit" isLoading={isLoading} disabled={isHydrating}>
            {isFromReview ? 'Save & Return to Review' : 'Continue to Step 3'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingStep>
  );
}
