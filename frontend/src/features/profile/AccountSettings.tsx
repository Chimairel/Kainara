'use client';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
import Link from 'next/link';

import Button from '@/components/ui/Button';

import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Avatar from '@/components/ui/Avatar';
import AvatarSettings from '@/features/profile/AvatarSettings';

import { User, Lock, LogOut, Mail, Palette, ShieldCheck, Trash2 } from 'lucide-react';
import { ProfilePanel } from '@/features/profile/account/AccountSettings.shared';

import { useAccountSettingsModel } from '@/features/profile/account/useAccountSettingsModel';
import AccountNutritionOverview from '@/features/profile/account/AccountNutritionOverview';
import AccountBiometricsSection from '@/features/profile/account/AccountBiometricsSection';
import AccountDietarySection from '@/features/profile/account/AccountDietarySection';
import AccountIdentitySection from '@/features/profile/account/AccountIdentitySection';
import AccountSecuritySection from '@/features/profile/account/AccountSecuritySection';
import AccountPrivacySection from '@/features/profile/account/AccountPrivacySection';
export default function AccountSettings({ initialPanel = 'account' }: { initialPanel?: ProfilePanel }) {
  const model = useAccountSettingsModel({ initialPanel });
  if (model.kind === 'early') return model.view;
  const { user, activePanel, setActivePanel, updateUserSession, logout } = model;
  return (
    <div className="portal-page max-w-5xl space-y-5 text-left text-brand-text">
      <Link href="/profile" className="inline-block text-sm font-semibold text-brand-green">
        ← Profile
      </Link>
      <PortalPageHeader
        icon={User}
        eyebrow="Personal identity"
        title={initialPanel === 'account' ? 'Personal details' : 'Security & privacy'}
        description="Manage your identity, security, and profile appearance from one focused workspace."
        className="mb-6"
      />

      <section className="relative overflow-hidden rounded-[28px] border border-brand-border/70 bg-brand-surface p-5 shadow-card sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-brand-green/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar size="lg" src={user.image} fallbackText={user.name} className="h-20 w-20 rounded-full shadow-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-2xl font-black tracking-tight text-brand-text">{user.name}</h2>
              <span className="rounded-full bg-brand-green/10 px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-wider text-brand-green">
                {user.role}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-brand-muted">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-brand-green">
              <ShieldCheck className="h-3.5 w-3.5" />
              Email and account details
            </p>
          </div>
        </div>
      </section>

      <WorkspaceTabs
        value={activePanel}
        onChange={setActivePanel}
        label="Profile settings sections"
        animateIndicator={false}
        items={(
          [
            ['account', 'Account', User],
            ['security', 'Security', Lock],
            ['avatar', 'Avatar', Palette],
            ['privacy', 'Privacy', Trash2],
          ] as const
        )
          .filter(([value]) =>
            initialPanel === 'account' ? ['account', 'avatar'].includes(value) : ['security', 'privacy'].includes(value)
          )
          .map(([value, label, Icon]) => ({ value, label, icon: <Icon className="h-4 w-4" /> }))}
      />

      {activePanel === 'account' && (
        <div className="space-y-6">
          {user.role === 'USER' && (
            <div className="space-y-5">
              {/* Header */}
              <div>
                <h2 className="font-display text-base font-black text-brand-text">
                  Personal Activity & Nutrition Profile
                </h2>
                <p className="mt-0.5 text-xs text-brand-muted">
                  Habits, biometric baseline, and meals tracked across your KAINARA journey.
                </p>
              </div>

              {/* Meals Eaten: Inside KAINARA vs Outside Dining */}
              <AccountNutritionOverview model={model} />

              {/* 2 Grids: Biometrics & Dietary Blueprint */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Biometrics & Weight Blueprint */}
                <AccountBiometricsSection model={model} />

                {/* Dietary & Lifestyle Blueprint */}
                <AccountDietarySection model={model} />
              </div>
            </div>
          )}

          {/* Account information credentials card */}
          <AccountIdentitySection model={model} />
        </div>
      )}

      <AccountSecuritySection model={model} />

      <AvatarSettings visible={activePanel === 'avatar'} user={user} updateUserSession={updateUserSession} />

      {activePanel === 'privacy' && (
        <Link
          href="/export"
          className="block rounded-xl border border-brand-border bg-brand-surface p-4 text-sm font-semibold text-brand-green"
        >
          Download my data and nutrition summary →
        </Link>
      )}
      <AccountPrivacySection model={model} />

      <section className="flex flex-col gap-3 rounded-[22px] border border-red-500/15 bg-red-500/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-brand-text">End this session</p>
          <p className="mt-0.5 text-[11px] text-brand-muted">You can sign back in at any time.</p>
        </div>
        <Button
          variant="secondary"
          onClick={logout}
          className="flex items-center justify-center gap-2 border-red-500/20 px-5 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </section>
    </div>
  );
}
