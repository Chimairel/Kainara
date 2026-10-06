'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';

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
            {deletionError && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs font-bold text-red-500">
                {deletionError}
              </div>
            )}
            {passwordLoginEnabled && (
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
              <Button
                variant="danger"
                type="submit"
                disabled={isDeleting || !deletionConfirmed || (passwordLoginEnabled && deletionPassword.length < 8)}
              >
                {isDeleting ? 'Deleting account...' : 'Permanently delete account'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
