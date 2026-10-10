'use client';

import { AlertTriangle } from 'lucide-react';
import { useWorkspaceRedirect } from '@/hooks/useWorkspaceRedirect';
import type { UserSession } from '@/lib/context/AuthContext';
import { getPostAuthDestination } from '@/lib/post-auth-destination';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

// Cold local routes can take longer than eight seconds to compile. Keep a
// bounded recovery action without reporting an ordinary pending navigation as failure.
const REDIRECT_RECOVERY_MS = 30_000;

export default function AuthenticatedEntryRedirect({
  user,
  logout,
  profileLoadError = false,
  retryProfile,
  recoveryDelayMs = REDIRECT_RECOVERY_MS,
  isResolving = false,
  inline = false,
  destinationOverride,
}: {
  user: UserSession | null;
  logout: () => Promise<void>;
  profileLoadError?: boolean;
  retryProfile?: () => Promise<unknown>;
  recoveryDelayMs?: number;
  isResolving?: boolean;
  inline?: boolean;
  destinationOverride?: string;
}) {
  const destination = destinationOverride ?? (user ? getPostAuthDestination(user) : '/login');
  const showRecovery = useWorkspaceRedirect(
    isResolving || profileLoadError ? null : destination,
    user?.userId,
    recoveryDelayMs
  );

  if (isResolving || (!profileLoadError && !showRecovery)) {
    const message = isResolving ? 'Checking your account…' : 'Redirecting to your workspace...';
    return inline ? (
      <div className="flex items-center gap-3 text-center text-sm font-semibold text-brand-text" aria-live="polite">
        <LoadingSpinner size="sm" />
        <p>{message}</p>
      </div>
    ) : (
      <PortalLoadingState fullScreen message={message} />
    );
  }

  const Container = inline ? 'div' : 'main';
  return (
    <Container
      className={
        inline
          ? 'w-full text-brand-text'
          : 'flex min-h-screen items-center justify-center bg-brand-bg px-5 text-brand-text'
      }
    >
      <section
        role="alert"
        className={
          inline
            ? 'w-full p-2 text-center'
            : 'w-full max-w-md rounded-3xl border border-brand-border bg-brand-bgAlt p-7 text-center shadow-2xl'
        }
      >
        <AlertTriangle className="mx-auto h-8 w-8 text-status-warning-text" />
        <h1 className="mt-4 font-display text-2xl font-extrabold">
          {profileLoadError ? 'Could not load your account' : 'Your workspace took too long to open'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          {profileLoadError
            ? 'Your account is signed in. Try loading your account again to continue.'
            : user
              ? 'Your account is signed in. Retry the destination, or sign out and return to account access.'
              : 'Try opening account access again.'}
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
          {user && (
            <Button type="button" variant="secondary" onClick={() => void logout()}>
              Sign out
            </Button>
          )}
        </div>
      </section>
    </Container>
  );
}
