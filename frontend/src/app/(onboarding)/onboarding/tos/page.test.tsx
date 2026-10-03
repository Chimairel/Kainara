import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TosPage from './page';

const state = vi.hoisted(() => ({
  post: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  refreshSession: vi.fn(),
  refresh: vi.fn(),
  useProfile: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push, replace: state.replace }) }));
vi.mock('@/lib/axios', () => ({ default: { post: state.post } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ refreshSession: state.refreshSession }) }));
vi.mock('@/hooks/useProfile', () => ({ useProfile: state.useProfile }));

function acceptAll() {
  for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox);
}

describe('onboarding final review readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks submission and offers recovery for a partial or unavailable account snapshot', () => {
    state.useProfile.mockReturnValue({
      profile: { userId: 'fixture-user', shoppingDayOfWeek: 0 },
      isLoading: false,
      error: null,
      refresh: state.refresh,
    });
    render(<TosPage />);
    acceptAll();
    expect(state.useProfile).toHaveBeenCalledWith({ requireFresh: true });
    expect(screen.getByRole('button', { name: /Complete Onboarding/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('consent versions could not be loaded');
    expect(screen.queryByText(/Terms loading/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.refresh).toHaveBeenCalledOnce();
    expect(state.post).not.toHaveBeenCalled();
  });

  it('shows Sunday schedule, submits the authoritative consent versions and continues to the report', async () => {
    state.useProfile.mockReturnValue({
      profile: {
        id: 'fixture-user',
        userProfile: { shoppingDayOfWeek: 0 },
        onboardingStatus: { currentTermsVersion: '2026-09-27', currentPrivacyVersion: '2026-09-27' },
      },
      isLoading: false,
      error: null,
      refresh: state.refresh,
    });
    state.post.mockResolvedValue({ data: { success: true, data: { nextPath: '/nutrition-report' } } });
    state.refreshSession.mockResolvedValue({ reportAcknowledged: false });
    render(<TosPage />);
    expect(screen.getByText('Sunday shopping · Monday to Sunday plan')).toBeInTheDocument();
    acceptAll();
    fireEvent.click(screen.getByRole('button', { name: /Complete Onboarding/ }));
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/profile/nutrition-report?next=dashboard'));
    expect(state.post.mock.calls).toEqual([
      [
        '/user/onboarding/tos',
        {
          termsVersion: '2026-09-27',
          privacyVersion: '2026-09-27',
          medicalDisclaimerAccepted: true,
          privacyPolicyAccepted: true,
          healthDataProcessingAccepted: true,
        },
      ],
      ['/user/onboarding/complete'],
    ]);
  });

  it('keeps completion disabled while the fresh read is still pending even with cached consent versions', () => {
    state.useProfile.mockReturnValue({
      profile: { onboardingStatus: { currentTermsVersion: 'old', currentPrivacyVersion: 'old' } },
      isLoading: true,
      error: null,
      refresh: state.refresh,
    });
    render(<TosPage />);
    acceptAll();
    expect(screen.getByRole('button', { name: /Complete Onboarding/ })).toBeDisabled();
    expect(screen.getByText('Loading consent versions…')).toBeInTheDocument();
    expect(state.post).not.toHaveBeenCalled();
  });

  it('returns a skipped required allergy form instead of completing onboarding', async () => {
    state.useProfile.mockReturnValue({
      profile: {
        id: 'fixture',
        userProfile: {},
        onboardingStatus: { currentTermsVersion: '2026-09-27', currentPrivacyVersion: '2026-09-27' },
      },
      isLoading: false,
      error: null,
      refresh: state.refresh,
    });
    state.post.mockResolvedValueOnce({ data: { success: true } }).mockRejectedValueOnce({
      response: {
        data: {
          error: 'Save allergy details before completing onboarding.',
          errorCode: 'ONBOARDING_INCOMPLETE',
          details: { nextPath: '/onboarding/allergy-details' },
        },
      },
    });
    render(<TosPage />);
    acceptAll();
    fireEvent.click(screen.getByRole('button', { name: /Complete Onboarding/ }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/onboarding/allergy-details'));
    expect(state.refreshSession).not.toHaveBeenCalled();
    expect(state.replace).not.toHaveBeenCalled();
  });
});
