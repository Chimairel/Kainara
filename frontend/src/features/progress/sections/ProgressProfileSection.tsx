'use client';

import Button from '@/components/ui/Button';

import {
  DIETARY_OPTIONS,
  RICE_OPTIONS,
  SHOPPING_DAY_OPTIONS,
  BIOLOGICAL_SEX_OPTIONS,
  GOAL_OPTIONS,
  ACTIVITY_OPTIONS,
} from '@/features/progress/profile-options';

import ProfileSettingsSection from '@/components/user/ProfileSettingsSection';
import Input from '@/components/ui/Input';

import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Select } from '@/components/ui/Select';

import type { useProgressWorkspaceModel } from './useProgressWorkspaceModel';
type Model = Extract<ReturnType<typeof useProgressWorkspaceModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'activeSection'
    | 'mode'
    | 'biometricsSuccess'
    | 'biometricsError'
    | 'handleBiometricsSubmit'
    | 'age'
    | 'setAge'
    | 'heightCm'
    | 'setHeightCm'
    | 'weightKg'
    | 'setWeightKg'
    | 'targetWeightKg'
    | 'setTargetWeightKg'
    | 'biologicalSex'
    | 'setBiologicalSex'
    | 'goal'
    | 'setGoal'
    | 'activityLevel'
    | 'setActivityLevel'
    | 'dietaryPreference'
    | 'setDietaryPreference'
    | 'ricePreference'
    | 'setRicePreference'
    | 'shoppingDayOfWeek'
    | 'setShoppingDayOfWeek'
    | 'isSavingBiometrics'
  >;
};
export default function ProgressProfileSection({ model }: SectionProps) {
  const {
    activeSection,
    mode,
    biometricsSuccess,
    biometricsError,
    handleBiometricsSubmit,
    age,
    setAge,
    heightCm,
    setHeightCm,
    weightKg,
    setWeightKg,
    targetWeightKg,
    setTargetWeightKg,
    biologicalSex,
    setBiologicalSex,
    goal,
    setGoal,
    activityLevel,
    setActivityLevel,
    dietaryPreference,
    setDietaryPreference,
    ricePreference,
    setRicePreference,
    shoppingDayOfWeek,
    setShoppingDayOfWeek,
    isSavingBiometrics,
  } = model;

  if (activeSection !== 'profile') return null;
  const content = (
    <>
      {biometricsSuccess && (
        <div className="p-3.5 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-xs font-bold mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
          <span>{biometricsSuccess}</span>
        </div>
      )}

      {biometricsError && (
        <div className="p-3.5 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-bold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
          <span>{biometricsError}</span>
        </div>
      )}

      <form onSubmit={handleBiometricsSubmit} className="flex flex-col gap-5">
        {mode === 'health' && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                id="profile-age"
                label="Age (Years)"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
              />
              <Input
                id="profile-height"
                label="Height (cm)"
                type="number"
                step="0.1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                required
              />
              <Input
                id="profile-weight"
                label="Weight (kg)"
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
              />
              <Input
                id="profile-target-weight"
                label="Target Weight (kg)"
                type="number"
                step="0.1"
                value={targetWeightKg}
                onChange={(e) => setTargetWeightKg(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-biological-sex" className="mb-2 block text-sm font-semibold text-brand-text">
                  Biological Sex
                </label>
                <Select
                  id="profile-biological-sex"
                  value={biologicalSex}
                  onChange={setBiologicalSex}
                  options={BIOLOGICAL_SEX_OPTIONS}
                />
              </div>
              <div>
                <label htmlFor="profile-goal" className="mb-2 block text-sm font-semibold text-brand-text">
                  Primary Goal
                </label>
                <Select id="profile-goal" value={goal} onChange={setGoal} options={GOAL_OPTIONS} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="profile-activity" className="mb-2 block text-sm font-semibold text-brand-text">
                  Activity Level
                </label>
                <Select
                  id="profile-activity"
                  value={activityLevel}
                  onChange={setActivityLevel}
                  options={ACTIVITY_OPTIONS}
                />
              </div>
            </div>
          </>
        )}
        {mode === 'planning' && (
          <>
            {/* Top Row: Dietary, rice, and grocery shopping day */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-diet" className="mb-2 block text-sm font-semibold text-brand-text">
                  Dietary Preference
                </label>
                <Select
                  id="profile-diet"
                  value={dietaryPreference}
                  onChange={setDietaryPreference}
                  options={DIETARY_OPTIONS}
                  disabled={isSavingBiometrics}
                />
              </div>
              <div>
                <label htmlFor="profile-rice" className="mb-2 block text-sm font-semibold text-brand-text">
                  Rice Preference
                </label>
                <Select
                  id="profile-rice"
                  value={ricePreference}
                  onChange={(value) => setRicePreference(value as typeof ricePreference)}
                  options={RICE_OPTIONS}
                  disabled={isSavingBiometrics}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="profile-shopping-day" className="mb-2 block text-sm font-semibold text-brand-text">
                  Grocery Shopping Day
                </label>
                <Select
                  id="profile-shopping-day"
                  value={String(shoppingDayOfWeek)}
                  onChange={(val) => setShoppingDayOfWeek(Number(val))}
                  options={SHOPPING_DAY_OPTIONS}
                  disabled={isSavingBiometrics}
                />
              </div>
            </div>
          </>
        )}
        {/* Plan Cycle & Regeneration Notice */}
        <div className="text-sm leading-relaxed text-brand-muted">
          <div>
            <strong className="text-brand-text block mb-0.5">Applies to your next weekly cycle</strong>
            Planning changes take effect on your next weekly meal cycle. Safety restrictions block conflicting uneaten
            meals immediately.
          </div>
        </div>

        <div className="flex justify-start mt-1">
          <Button
            variant="primary"
            type="submit"
            disabled={isSavingBiometrics}
            isLoading={isSavingBiometrics}
            className="w-full sm:w-auto"
          >
            {isSavingBiometrics ? 'Saving...' : mode === 'planning' ? 'Save food preferences' : 'Save Profile Details'}
          </Button>
        </div>
      </form>
    </>
  );
  return (
    <ProfileSettingsSection
      title={mode === 'planning' ? 'Food preferences' : 'Body measurements & goals'}
      description={
        mode === 'planning'
          ? 'Choose how you eat and when you shop for your weekly plan.'
          : 'Keep your measurements and activity up to date for future planning.'
      }
    >
      {content}
    </ProfileSettingsSection>
  );
}
