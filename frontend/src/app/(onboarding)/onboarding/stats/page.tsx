'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import OnboardingStep, { OnboardingActions, OnboardingChoice } from '@/components/onboarding/OnboardingStep';
import ProfileSettingsSection from '@/components/user/ProfileSettingsSection';
import { Goal, ActivityLevel } from '@/types';
import { Lock, TrendingUp, Dumbbell, TrendingDown, Scale, ArrowRight } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { writeSessionResource } from '@/lib/session-resource-cache';

export default function OnboardingStatsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromReview = searchParams.get('from') === 'review';
  const { profile, isLoading: isHydrating, error: profileError } = useProfile();
  const { user, refreshSession } = useAuth();
  const [goal, setGoal] = useState<Goal>('MAINTAIN');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('LIGHTLY_ACTIVE');
  const [biologicalSex, setBiologicalSex] = useState<'MALE' | 'FEMALE' | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const saved = profile?.userProfile;
    if (!saved) return;
    if (saved.goal) setGoal(saved.goal as Goal);
    if (saved.age) setAge(String(saved.age));
    if (saved.heightCm) setHeight(String(saved.heightCm));
    if (saved.weightKg) setWeight(String(saved.weightKg));
    if (saved.targetWeightKg) setTargetWeight(String(saved.targetWeightKg));
    if (saved.activityLevel) setActivityLevel(saved.activityLevel as ActivityLevel);
    if (saved.biologicalSex === 'MALE' || saved.biologicalSex === 'FEMALE') {
      setBiologicalSex(saved.biologicalSex);
    }
  }, [profile]);

  useEffect(() => {
    if (profileError) setError(profileError);
  }, [profileError]);

  // When goal changes, auto-handle the target weight field
  const handleGoalChange = (newGoal: Goal) => {
    setGoal(newGoal);
    setError(null);
    if (newGoal === 'MAINTAIN') {
      // Lock target weight to current weight for maintain goal
      setTargetWeight(weight);
    }
  };

  // Derive live validation state for the target weight field
  const parsedWeight = parseFloat(weight);
  const parsedTargetWeight = parseFloat(targetWeight);
  const hasWeightValues = !isNaN(parsedWeight) && !isNaN(parsedTargetWeight);

  const targetWeightState: 'valid' | 'invalid' | 'neutral' = (() => {
    if (!hasWeightValues || goal === 'MAINTAIN') return 'neutral';
    if (goal === 'GAIN_WEIGHT' || goal === 'BUILD_MUSCLE') {
      return parsedTargetWeight >= parsedWeight ? 'valid' : 'invalid';
    }
    if (goal === 'LOSE_WEIGHT') {
      return parsedTargetWeight <= parsedWeight ? 'valid' : 'invalid';
    }
    return 'neutral';
  })();

  const targetWeightHint = (() => {
    if (goal === 'MAINTAIN')
      return (
        <span className="flex items-center gap-1">
          <Lock className="w-3 h-3 text-brand-muted shrink-0" /> Locked to your current weight
        </span>
      );
    if (goal === 'GAIN_WEIGHT')
      return (
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-brand-green shrink-0" /> Must be ≥ current weight
        </span>
      );
    if (goal === 'BUILD_MUSCLE')
      return (
        <span className="flex items-center gap-1">
          <Dumbbell className="w-3 h-3 text-brand-green shrink-0" /> Must be ≥ current weight
        </span>
      );
    if (goal === 'LOSE_WEIGHT')
      return (
        <span className="flex items-center gap-1">
          <TrendingDown className="w-3 h-3 text-brand-green shrink-0" /> Must be ≤ current weight
        </span>
      );
    return '';
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Empty field validations first
    if (!age || age.trim() === '') {
      setError('Please enter your age.');
      return;
    }
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 100) {
      setError('KAINARA currently supports adults aged 18 to 100.');
      return;
    }
    if (!biologicalSex) {
      setError('Please select the biological sex used for your energy calculation.');
      return;
    }
    if (!height || height.trim() === '') {
      setError('Please enter your height.');
      return;
    }
    const parsedHeight = parseFloat(height);
    if (isNaN(parsedHeight) || parsedHeight < 100 || parsedHeight > 250) {
      setError('Please provide a realistic height (100 to 250 cm).');
      return;
    }
    if (!weight || weight.trim() === '') {
      setError('Please enter your weight.');
      return;
    }
    const parsedWeight = parseFloat(weight);
    if (isNaN(parsedWeight) || parsedWeight < 30 || parsedWeight > 300) {
      setError('Please provide a realistic weight (30 to 300 kg).');
      return;
    }
    if (!targetWeight || targetWeight.trim() === '') {
      setError('Please enter your target weight.');
      return;
    }
    const parsedTargetWeight = parseFloat(targetWeight);
    if (isNaN(parsedTargetWeight) || parsedTargetWeight < 30 || parsedTargetWeight > 300) {
      setError('Please provide a realistic target weight.');
      return;
    }

    // Goal-aware target weight validation
    if ((goal === 'GAIN_WEIGHT' || goal === 'BUILD_MUSCLE') && parsedTargetWeight < parsedWeight) {
      setError(
        `Your target weight (${parsedTargetWeight} kg) should be equal to or higher than your current weight (${parsedWeight} kg) for a "${goal === 'GAIN_WEIGHT' ? 'Gain Weight' : 'Build Muscle'}" goal.`
      );
      return;
    }
    if (goal === 'LOSE_WEIGHT' && parsedTargetWeight > parsedWeight) {
      setError(
        `Your target weight (${parsedTargetWeight} kg) should be equal to or lower than your current weight (${parsedWeight} kg) for a "Lose Weight" goal.`
      );
      return;
    }

    setIsLoading(true);
    try {
      // Send stats to backend onboarding profile endpoint
      const response = await api.post('/user/onboarding/profile', {
        age: parsedAge,
        heightCm: parsedHeight,
        weightKg: parsedWeight,
        targetWeightKg: parsedTargetWeight,
        biologicalSex,
        goal,
        activityLevel,
      });

      const ownerId = user?.userId || profile?.id;
      if (response.data?.data && ownerId) {
        writeSessionResource(ownerId, 'user-profile', response.data.data);
      }

      // Advance to review or step 2: Preferences immediately
      const nextTarget = isFromReview ? '/onboarding/tos' : '/onboarding/preferences';
      router.push(nextTarget);
      void refreshSession();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save stats. Please verify your connection.'));
      setIsLoading(false);
    }
  };

  const goalsList: { value: Goal; label: string; icon: React.ReactNode }[] = [
    { value: 'LOSE_WEIGHT', label: 'Lose Weight', icon: <TrendingDown className="w-4 h-4" /> },
    { value: 'GAIN_WEIGHT', label: 'Gain Weight', icon: <TrendingUp className="w-4 h-4" /> },
    { value: 'MAINTAIN', label: 'Maintain Weight', icon: <Scale className="w-4 h-4" /> },
    { value: 'BUILD_MUSCLE', label: 'Build Muscle', icon: <Dumbbell className="w-4 h-4" /> },
  ];

  const activityLevelsList: { value: ActivityLevel; label: string; desc: string }[] = [
    { value: 'SEDENTARY', label: 'Sedentary', desc: 'Little to no exercise' },
    { value: 'LIGHTLY_ACTIVE', label: 'Lightly Active', desc: '1-3 days/week exercise' },
    { value: 'ACTIVE', label: 'Active', desc: '3-5 days/week intense exercise' },
    { value: 'VERY_ACTIVE', label: 'Very Active', desc: 'Daily athletic sports/jobs' },
  ];

  return (
    <OnboardingStep
      step={1}
      title="Personal metrics"
      description="Specify your primary fitness objective and body stats to calculate your daily energy targets."
      backHref={isFromReview ? '/onboarding/tos' : undefined}
      backLabel="Back to Review"
    >
      {error && <FeedbackNotice>{error}</FeedbackNotice>}
      <form onSubmit={handleSubmit} noValidate className="divide-y divide-brand-border">
        <fieldset
          disabled={isLoading || isHydrating}
          className="contents [&>section+section]:border-t [&>section+section]:border-brand-border"
        >
          <ProfileSettingsSection title="Your goal" description="">
            <div className="grid grid-cols-2 gap-2 sm:gap-3" role="group" aria-label="Primary Goal">
              {goalsList.map((item) => (
                <OnboardingChoice
                  key={item.value}
                  label={item.label}
                  icon={item.icon}
                  selected={goal === item.value}
                  onClick={() => handleGoalChange(item.value)}
                />
              ))}
            </div>
          </ProfileSettingsSection>
          <ProfileSettingsSection title="Body measurements" description="Used to calculate your daily energy target.">
            <fieldset className="mb-4 space-y-2 sm:mb-6">
              <legend className="text-sm font-semibold">Biological sex used for energy calculation</legend>
              <p className="text-xs leading-relaxed text-brand-muted">
                Required by the Mifflin–St Jeor equation to calculate your resting metabolic rate.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(['MALE', 'FEMALE'] as const).map((value) => (
                  <OnboardingChoice
                    key={value}
                    label={value === 'MALE' ? 'Male' : 'Female'}
                    selected={biologicalSex === value}
                    onClick={() => setBiologicalSex(value)}
                  />
                ))}
              </div>
            </fieldset>
            {/* Inputs Grid */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Input
                id="age"
                label="Age (Years)"
                type="number"
                min={18}
                max={100}
                placeholder="25"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={isLoading}
              />
              <Input
                id="height"
                label="Height (cm)"
                type="number"
                min={100}
                max={250}
                placeholder="170"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                disabled={isLoading}
              />
              <Input
                id="weight"
                label="Weight (kg)"
                type="number"
                min={30}
                max={300}
                step="0.1"
                placeholder="68.5"
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value);
                  if (goal === 'MAINTAIN') setTargetWeight(e.target.value);
                }}
                disabled={isLoading}
              />

              {/* Target Weight — smart field with live goal-aware validation */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="targetWeight"
                  className={`text-xs sm:text-sm font-bold tracking-wide ${
                    goal === 'MAINTAIN' ? 'text-brand-muted' : 'text-brand-text/90'
                  }`}
                >
                  Target Weight (kg)
                </label>
                <input
                  id="targetWeight"
                  aria-describedby="target-weight-help"
                  aria-invalid={targetWeightState === 'invalid'}
                  type="number"
                  min={30}
                  max={300}
                  step="0.1"
                  placeholder={goal === 'MAINTAIN' ? 'Same as current weight' : '65.0'}
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  disabled={isLoading || goal === 'MAINTAIN'}
                  className={`
                  w-full px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-medium transition-all duration-200 outline-none
                  bg-brand-bgAlt/50 text-brand-text
                  ${
                    goal === 'MAINTAIN'
                      ? 'border-brand-border/40 opacity-50 cursor-not-allowed text-brand-muted'
                      : targetWeightState === 'invalid'
                        ? 'border-status-error-text/60 bg-status-error-bg/5 focus:border-status-error-text'
                        : targetWeightState === 'valid'
                          ? 'border-brand-green/60 bg-brand-green/5 focus:border-brand-green'
                          : 'border-brand-border focus:border-brand-green'
                  }
                `}
                />
                <p
                  id="target-weight-help"
                  className={`text-xs font-medium leading-relaxed ${
                    goal === 'MAINTAIN'
                      ? 'text-brand-muted'
                      : targetWeightState === 'invalid'
                        ? 'text-status-error-text'
                        : targetWeightState === 'valid'
                          ? 'text-brand-green'
                          : 'text-brand-muted'
                  }`}
                >
                  {targetWeightHint}
                </p>
              </div>
            </div>
          </ProfileSettingsSection>
          <ProfileSettingsSection title="Daily activity" description="">
            <div className="grid grid-cols-2 gap-2 sm:gap-3" role="group" aria-label="Daily Activity Level">
              {activityLevelsList.map((item) => (
                <OnboardingChoice
                  key={item.value}
                  label={item.label}
                  description={item.desc}
                  selected={activityLevel === item.value}
                  onClick={() => setActivityLevel(item.value)}
                />
              ))}
            </div>
          </ProfileSettingsSection>
        </fieldset>
        <OnboardingActions>
          <Button type="submit" isLoading={isLoading} disabled={isHydrating}>
            {isFromReview ? 'Save & Return to Review' : 'Continue to Step 2'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingStep>
  );
}
