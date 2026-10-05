'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { UserSession } from '@/lib/context/AuthContext';
import { getPostAuthDestination } from '@/lib/post-auth-destination';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import Button from '@/components/ui/Button';

const REDIRECT_RECOVERY_MS = 8_000;

export default function AuthenticatedEntryRedirect({
  user,
  logout,
  profileLoadError = false,
  retryProfile,
  recoveryDelayMs = REDIRECT_RECOVERY_MS,
}: {
  user: UserSession;
  logout: () => Promise<void>;
  profileLoadError?: boolean;
  retryProfile?: () => Promise<unknown>;
  recoveryDelayMs?: number;
}) {
  const router = useRouter();
  const destination = useMemo(() => getPostAuthDestination(user), [user]);
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    setShowRecovery(false);
    if (profileLoadError) return;
    router.replace(destination);
    const timer = setTimeout(() => setShowRecovery(true), recoveryDelayMs);
    return () => clearTimeout(timer);
  }, [destination, profileLoadError, recoveryDelayMs, router]);

  if (!profileLoadError && !showRecovery) {
    return <PortalLoadingState fullScreen message="Redirecting to your workspace..." />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-bg px-5 text-brand-text">
      <section className="w-full max-w-md rounded-3xl border border-brand-border bg-brand-bgAlt p-7 text-center shadow-2xl">
        <AlertTriangle className="mx-auto h-8 w-8 text-status-warning-text" />
        <h1 className="mt-4 font-display text-2xl font-extrabold">
          {profileLoadError ? 'Could not load your account' : 'Your workspace took too long to open'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          {profileLoadError
            ? 'Your account is signed in. Try loading your account again to continue.'
            : 'Your account is signed in. Retry the destination, or sign out and return to account access.'}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              if (profileLoadError) void retryProfile?.();
              else window.location.assign(destination);
            }}
          >
            Try again
          </Button>
          <Button type="button" variant="secondary" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </section>
    </main>
  );
}
