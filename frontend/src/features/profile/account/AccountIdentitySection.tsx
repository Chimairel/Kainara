'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

import { CheckCircle, AlertTriangle } from 'lucide-react';

import type { useAccountSettingsModel } from './useAccountSettingsModel';
type Model = Extract<ReturnType<typeof useAccountSettingsModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'accountSuccess'
    | 'accountError'
    | 'handleAccountSubmit'
    | 'name'
    | 'setName'
    | 'email'
    | 'setEmail'
    | 'isSavingAccount'
  >;
};
export default function AccountIdentitySection({ model }: SectionProps) {
  const { accountSuccess, accountError, handleAccountSubmit, name, setName, email, setEmail, isSavingAccount } = model;

  return (
    <>
      <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-0 shadow-card">
        <div className="border-b border-brand-border/60 px-5 py-4 sm:px-6">
          <h2 className="font-display text-base font-black text-brand-text">Account information</h2>
          <p className="mt-1 text-xs text-brand-muted">
            Update the name and email shown across your KAINARA workspace.
          </p>
        </div>
        <div className="p-5 sm:p-6">
          {accountSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-verified-text/25 bg-status-verified-bg/10 p-3.5 text-xs font-bold text-status-verified-text">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {accountSuccess}
            </div>
          )}
          {accountError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3.5 text-xs font-bold text-status-error-text">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {accountError}
            </div>
          )}
          <form onSubmit={handleAccountSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                id="account-name"
                name="name"
                autoComplete="name"
                label="Display Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                id="account-email"
                name="email"
                autoComplete="email"
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end border-t border-brand-border/60 pt-4">
              <Button
                variant="primary"
                type="submit"
                disabled={isSavingAccount}
                className="px-6 py-2.5 text-xs font-bold shadow-md"
              >
                {isSavingAccount ? 'Saving Settings...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </>
  );
}
