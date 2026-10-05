import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthenticatedEntryRedirect from './AuthenticatedEntryRedirect';
import type { UserSession } from '@/lib/context/AuthContext';

const unresolvedUser: UserSession = {
  userId: 'fixture-user',
  name: 'Fixture User',
  email: 'fixture@example.test',
  role: 'USER',
  emailVerified: false,
  onboardingDone: false,
  tosAccepted: false,
  reportAcknowledged: false,
};

const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

describe('AuthenticatedEntryRedirect', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('waits for authoritative profile status instead of redirecting a failed read to OTP', () => {
    const retryProfile = vi.fn().mockResolvedValue(null);
    const logout = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AuthenticatedEntryRedirect user={unresolvedUser} logout={logout} profileLoadError retryProfile={retryProfile} />
    );

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText('Could not load your account')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retryProfile).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalledOnce();

    rerender(
      <AuthenticatedEntryRedirect
        user={{ ...unresolvedUser, emailVerified: true, onboardingNextPath: '/onboarding/stats' }}
        logout={logout}
        profileLoadError={false}
        retryProfile={retryProfile}
      />
    );
    expect(replace).toHaveBeenCalledExactlyOnceWith('/onboarding/stats');
  });

  it('still requires OTP when the loaded profile confirms an unverified email', () => {
    render(<AuthenticatedEntryRedirect user={unresolvedUser} logout={vi.fn()} profileLoadError={false} />);
    expect(replace).toHaveBeenCalledExactlyOnceWith('/verify-email');
  });

  it('offers recovery instead of leaving a new account on an infinite redirect spinner', async () => {
    render(
      <AuthenticatedEntryRedirect
        user={{
          userId: 'new-user',
          name: 'New User',
          email: 'new@example.test',
          role: 'USER',
          emailVerified: true,
          onboardingDone: false,
          tosAccepted: false,
          reportAcknowledged: false,
          onboardingNextPath: '/onboarding/stats',
        }}
        logout={vi.fn()}
        recoveryDelayMs={1}
      />
    );

    expect(replace).toHaveBeenCalledWith('/onboarding/stats');
    expect(screen.getByText('Redirecting to your workspace...')).toBeInTheDocument();

    expect(await screen.findByText('Your workspace took too long to open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
