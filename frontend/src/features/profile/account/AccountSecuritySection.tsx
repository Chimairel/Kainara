'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

import PasswordInput from '@/components/ui/PasswordInput';

import { Lock, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

import type { useAccountSettingsModel } from './useAccountSettingsModel';
type Model = Extract<ReturnType<typeof useAccountSettingsModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'activePanel'
    | 'passwordLoginEnabled'
    | 'passwordSuccess'
    | 'passwordError'
    | 'user'
    | 'handlePasswordSubmit'
    | 'currentPassword'
    | 'setCurrentPassword'
    | 'newPassword'
    | 'setNewPassword'
    | 'confirmPassword'
    | 'setConfirmPassword'
    | 'passwordsMismatch'
    | 'isUpdatingPassword'
  >;
};
export default function AccountSecuritySection({ model }: SectionProps) {
  const {
    activePanel,
    passwordLoginEnabled,
    passwordSuccess,
    passwordError,
    user,
    handlePasswordSubmit,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordsMismatch,
    isUpdatingPassword,
  } = model;

  return (
    <>
      {activePanel === 'security' && (
        <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-0 shadow-card">
          <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
            <div className="border-b border-brand-border/60 bg-brand-bgAlt/55 p-5 lg:border-b-0 lg:border-r sm:p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                <Lock className="h-5 w-5" />
              </span>
              <h2 className="mt-5 font-display text-lg font-black text-brand-text">Password</h2>
              <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                {passwordLoginEnabled
                  ? 'Use a unique password you do not reuse elsewhere. Changing it will protect future sessions.'
                  : 'This account uses Google sign-in and does not have a KAINARA password.'}
              </p>
            </div>
            <div className="p-5 sm:p-6">
              {passwordSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-verified-text/25 bg-status-verified-bg/10 p-3.5 text-xs font-bold text-status-verified-text">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {passwordSuccess}
                </div>
              )}
              {passwordError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3.5 text-xs font-bold text-status-error-text">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {passwordError}
                </div>
              )}
              {!passwordLoginEnabled && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 p-3.5 text-xs font-semibold leading-relaxed text-brand-text">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" />
                  <span>
                    Continue using the Google account connected to {user.email}. Password reset and password sign-in are
                    unavailable for this account.
                  </span>
                </div>
              )}
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <PasswordInput
                  id="current-password"
                  name="currentPassword"
                  label="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={!passwordLoginEnabled}
                  required
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <PasswordInput
                    id="new-password"
                    name="newPassword"
                    label="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={!passwordLoginEnabled}
                    required
                  />
                  <PasswordInput
                    id="confirm-new-password"
                    name="confirmPassword"
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={!passwordLoginEnabled}
                    error={passwordsMismatch ? 'New passwords do not match.' : undefined}
                    required
                  />
                </div>
                <div className="flex justify-end border-t border-brand-border/60 pt-4">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isUpdatingPassword || !passwordLoginEnabled}
                    className="px-6 py-2.5 text-xs font-bold shadow-md"
                  >
                    {isUpdatingPassword
                      ? 'Updating Password...'
                      : passwordLoginEnabled
                        ? 'Update Password'
                        : 'Google sign-in account'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
