'use client';

import Link from 'next/link';

import Card from '@/components/ui/Card';

import { Sparkles, ArrowRight } from 'lucide-react';

import type { useAccountSettingsModel } from './useAccountSettingsModel';
type Model = Extract<ReturnType<typeof useAccountSettingsModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'profileData' | 'restrictionsCount' | 'membershipTitle'> };
export default function AccountDietarySection({ model }: SectionProps) {
  const { profileData, restrictionsCount, membershipTitle } = model;

  return (
    <>
      <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-brand-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green dark:bg-emerald-500/10 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-xs font-bold text-brand-text">Dietary & Cultural Blueprint</h3>
              <p className="text-[10px] text-brand-muted">Habits, rice customization & safeguards</p>
            </div>
          </div>
          <span className="rounded-full border border-brand-border bg-brand-bgAlt px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-muted dark:border-white/[0.08] dark:bg-white/[0.04]">
            {profileData?.dietaryPreference || 'Omnivore'}
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-2.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-brand-muted">Dietary Pattern</span>
            <span className="font-bold text-brand-text">
              {profileData?.dietaryPreference
                ? profileData.dietaryPreference.charAt(0) + profileData.dietaryPreference.slice(1).toLowerCase()
                : 'Omnivore'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-2.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-brand-muted">Rice Preference</span>
            <span className="font-bold text-brand-text">
              {profileData?.ricePreference
                ? profileData.ricePreference
                    .replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase())
                : 'Flexible'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-2.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-brand-muted">Food Culture & Region</span>
            <span className="font-bold text-brand-text">
              {profileData?.foodCulture || 'Filipino Heritage'}
              {profileData?.planningRegionName ? ` · ${profileData.planningRegionName}` : ''}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-2.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-brand-muted">Clinical Safeguards</span>
            <span className="font-bold text-brand-text">
              {restrictionsCount > 0
                ? `${restrictionsCount} active protection${restrictionsCount === 1 ? '' : 's'}`
                : 'None declared'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-2.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-brand-muted">Membership Tier</span>
            <span className="font-bold text-brand-text">{membershipTitle}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-brand-border/50 pt-3 text-xs">
          <span className="text-[11px] text-brand-muted">
            {profileData?.checkinStreak
              ? `${profileData.checkinStreak} week check-in streak`
              : 'Weekly check-in active'}
          </span>
          <Link
            href="/profile/nutrition-report"
            className="inline-flex items-center gap-1 font-semibold text-brand-green hover:underline dark:text-emerald-400"
          >
            <span>Nutrition report</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </Card>
    </>
  );
}
