'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

import { ACCOUNT_DELETION_CONFIRMATION } from './AccountSettings.shared';
import type { useAccountSettingsModel } from './useAccountSettingsModel';
type Model = Extract<ReturnType<typeof useAccountSettingsModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'activePanel'
    | 'handleDeleteAccount'
    | 'deletionError'
    | 'passwordLoginEnabled'
    | 'googleLoginEnabled'
    | 'deletionMethod'
    | 'setDeletionMethod'
    | 'handleGoogleDeleteAccount'
    | 'deletionPassword'
    | 'setDeletionPassword'
    | 'deletionConfirmation'
    | 'setDeletionConfirmation'
    | 'deletionConfirmationMismatch'
    | 'isDeleting'
    | 'deletionConfirmed'
  >;
};
export default function AccountPrivacySection({ model }: SectionProps) {
  const {
    activePanel,
    handleDeleteAccount,
    deletionError,
    passwordLoginEnabled,
    googleLoginEnabled,
    deletionMethod,
    setDeletionMethod,
    handleGoogleDeleteAccount,
    deletionPassword,
    setDeletionPassword,
    deletionConfirmation,
    setDeletionConfirmation,
    deletionConfirmationMismatch,
    isDeleting,
    deletionConfirmed,
  } = model;

  return (
    <>
      {activePanel === 'privacy' && (
        <Card className="overflow-hidden border-red-500/25 bg-brand-surface p-0 shadow-card">
          <div className="border-b border-red-500/15 p-5 sm:p-6">
            <h2 className="font-display text-base font-black text-red-500">Delete account and health data</h2>
            <p className="mt-1 text-xs leading-relaxed text-brand-muted">
              This permanently removes your profile, restrictions, plans, logs, grocery lists, hydration entries, and
              sessions. Download your JSON export first if you need a copy.
            </p>
          </div>
          <form onSubmit={handleDeleteAccount} className="space-y-4 p-5 sm:p-6">
            {deletionError && <FeedbackNotice>{deletionError}</FeedbackNotice>}
            {passwordLoginEnabled && googleLoginEnabled && (
              <fieldset disabled={isDeleting} className="space-y-2">
                <legend className="text-sm font-semibold">Verify account ownership</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="deletion-method" checked={deletionMethod === 'GOOGLE'}
                    onChange={() => setDeletionMethod('GOOGLE')} />
                  Use my linked Google account
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="deletion-method" checked={deletionMethod === 'PASSWORD'}
                    onChange={() => setDeletionMethod('PASSWORD')} />
                  Use my KAINARA password
                </label>
              </fieldset>
            )}
            {passwordLoginEnabled && (!googleLoginEnabled || deletionMethod === 'PASSWORD') && (
              <PasswordInput
                id="delete-account-password"
                name="currentPassword"
                autoComplete="current-password"
                label="Current password"
                value={deletionPassword}
                onChange={(event) => setDeletionPassword(event.target.value)}
              />
            )}
            <Input
              id="delete-account-confirmation"
              name="confirmation"
              label="Type DELETE MY KAINARA ACCOUNT"
              value={deletionConfirmation}
              onChange={(event) => setDeletionConfirmation(event.target.value)}
              error={deletionConfirmationMismatch ? `Type ${ACCOUNT_DELETION_CONFIRMATION} exactly.` : undefined}
              required
            />
            <div className="flex justify-end border-t border-brand-border/60 pt-4">
              {passwordLoginEnabled && googleLoginEnabled && deletionMethod === 'GOOGLE' ? (
                <div className="w-full space-y-3">
                  <p className="text-sm text-brand-muted">
                    After typing the confirmation, continue with your linked Google account to permanently delete this account and its health data.
                  </p>
                  <GoogleSignInButton disabled={isDeleting || !deletionConfirmed} onCredential={handleGoogleDeleteAccount} />
                </div>
              ) : <Button
                variant="danger"
                type="submit"
                disabled={isDeleting || !deletionConfirmed || (passwordLoginEnabled && deletionPassword.length < 8)}
              >
                {isDeleting ? 'Deleting account...' : 'Permanently delete account'}
              </Button>}
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
