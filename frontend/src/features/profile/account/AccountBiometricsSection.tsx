'use client';

import Link from 'next/link';

import Card from '@/components/ui/Card';

import { Scale, ArrowRight } from 'lucide-react';

import type { useAccountSettingsModel } from './useAccountSettingsModel';
type Model = Extract<ReturnType<typeof useAccountSettingsModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    'bmiCategory' | 'weightKg' | 'heightCm' | 'targetWeightKg' | 'weightDelta' | 'bmi' | 'profileData'
  >;
};
export default function AccountBiometricsSection({ model }: SectionProps) {
  const { bmiCategory, weightKg, heightCm, targetWeightKg, weightDelta, bmi, profileData } = model;

  return (
    <>
      <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-brand-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green dark:bg-emerald-500/10 dark:text-emerald-400">
              <Scale className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-xs font-bold text-brand-text">Biometrics & Body Target</h3>
              <p className="text-[10px] text-brand-muted">Baseline body composition & metrics</p>
            </div>
          </div>
          {bmiCategory && (
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border ${bmiCategory.badge}`}
            >
              {bmiCategory.label}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">Current Weight</span>
            <p className="mt-1 font-display text-lg font-black text-brand-text">{weightKg ? `${weightKg} kg` : '—'}</p>
            <span className="text-[10px] text-brand-muted">
              {heightCm ? `${heightCm} cm height` : 'Height not set'}
            </span>
          </div>

          <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">Target Weight</span>
            <p className="mt-1 font-display text-lg font-black text-brand-text">
              {targetWeightKg ? `${targetWeightKg} kg` : 'Maintain'}
            </p>
            <span className="text-[10px] text-brand-muted">
              {weightDelta !== null
                ? `${Math.abs(weightDelta)} kg ${weightDelta > 0 ? 'to lose' : weightDelta < 0 ? 'to gain' : 'at target'}`
                : 'Maintain weight'}
            </span>
          </div>

          <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">Estimated BMI</span>
            <p className="mt-1 font-display text-lg font-black text-brand-text">{bmi ? `${bmi}` : '—'}</p>
            <span className="text-[10px] text-brand-muted">
              {bmi ? 'WHO / FNRI standard' : 'Requires height & weight'}
            </span>
          </div>

          <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">Daily Target</span>
            <p className="mt-1 font-display text-lg font-black text-brand-text">
              {profileData?.dailyCalorieTarget ? `${profileData.dailyCalorieTarget.toLocaleString()} kcal` : '—'}
            </p>
            <span className="text-[10px] text-brand-muted">Metabolic calorie target</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-brand-border/50 pt-3 text-xs">
          <span className="text-[11px] text-brand-muted">Update your measurements</span>
          <Link
            href="/profile/health"
            className="inline-flex items-center gap-1 font-semibold text-brand-green hover:underline dark:text-emerald-400"
          >
            <span>Health profile</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </Card>
    </>
  );
}
