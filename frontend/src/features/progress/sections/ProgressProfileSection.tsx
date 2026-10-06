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

import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

import { CheckCircle, AlertTriangle, Settings, Sparkles } from 'lucide-react';
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

  return (
    <>
      {activeSection === 'profile' && (
        <Card className="p-6 border-brand-border/70 bg-brand-surface shadow-card text-left mb-8">
          <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-5 font-display flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-brand-green" />
            <span>{mode === 'planning' ? 'Food preferences & shopping' : 'Body measurements & goals'}</span>
          </h3>

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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="profile-biological-sex"
                      className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                    >
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
                    <label
                      htmlFor="profile-goal"
                      className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                    >
                      Primary Goal
                    </label>
                    <Select id="profile-goal" value={goal} onChange={setGoal} options={GOAL_OPTIONS} />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-activity"
                      className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                    >
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="profile-diet"
                      className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                    >
                      Dietary Preference
                    </label>
                    <Select
                      id="profile-diet"
                      value={dietaryPreference}
                      onChange={setDietaryPreference}
                      options={DIETARY_OPTIONS}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-rice"
                      className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                    >
                      Rice Preference
                    </label>
                    <Select
                      id="profile-rice"
                      value={ricePreference}
                      onChange={(value) => setRicePreference(value as typeof ricePreference)}
                      options={RICE_OPTIONS}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-shopping-day"
                      className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                    >
                      Grocery Shopping Day
                    </label>
                    <Select
                      id="profile-shopping-day"
                      value={String(shoppingDayOfWeek)}
                      onChange={(val) => setShoppingDayOfWeek(Number(val))}
                      options={SHOPPING_DAY_OPTIONS}
                    />
                  </div>
                </div>
              </>
            )}
            {/* Plan Cycle & Regeneration Notice */}
            <div className="flex items-start gap-3 rounded-2xl bg-brand-green/[0.06] p-4 text-xs leading-relaxed text-brand-muted mt-2">
              <Sparkles className="h-4 w-4 shrink-0 text-brand-green mt-0.5" />
              <div>
                <strong className="text-brand-text block mb-0.5">Plan Cycle Notice</strong>
                Planning changes take effect on your next weekly meal cycle. Safety restrictions block conflicting
                uneaten meals immediately.
              </div>
            </div>

            <div className="flex justify-end mt-2">
              <Button
                variant="primary"
                type="submit"
                disabled={isSavingBiometrics}
                className="text-xs font-bold py-2.5 px-6 shadow-md"
              >
                {isSavingBiometrics ? 'Saving Profile...' : 'Save Profile Details'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
