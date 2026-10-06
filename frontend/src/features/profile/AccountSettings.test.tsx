import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountSettings from './AccountSettings';
import type { UserSession } from '@/lib/context/AuthContext';
import type { UserProfileData } from '@/hooks/useProfile';
import api, { setSessionRefreshSuppressed } from '@/lib/axios';

interface TestMealLog {
  id: string;
  source?: string;
  status?: string;
  loggedAt?: string;
}

const mocks = vi.hoisted(() => ({
  user: null as UserSession | null,
  profile: null as Partial<UserProfileData> | null,
  mealLogs: [] as TestMealLog[],
  completeAccountDeletion: vi.fn(),
  logout: vi.fn(),
  updateUserSession: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    logout: mocks.logout,
    completeAccountDeletion: mocks.completeAccountDeletion,
    updateUserSession: mocks.updateUserSession,
  }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    profile: mocks.profile,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url === '/user/meals/history') {
        return Promise.resolve({ data: { success: true, data: mocks.mealLogs } });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    }),
    put: vi.fn(),
    delete: vi.fn(),
  },
  setSessionRefreshSuppressed: vi.fn(),
}));
vi.mock('@/features/profile/AvatarSettings', () => ({ default: () => null }));
vi.mock('@/components/auth/GoogleSignInButton', () => ({
  default: () => <button type="button">Continue with Google</button>,
}));

const baseUser: UserSession = {
  userId: 'fixture-user',
  name: 'Google Fixture',
  email: 'google@example.test',
  role: 'USER',
  emailVerified: true,
  onboardingDone: true,
  tosAccepted: true,
  reportAcknowledged: true,
};

describe('provider-aware account security', () => {
  it('requires a new sign-in after a successful password change', async () => {
    mocks.user = { ...baseUser, authMethods: { password: true, google: false } };
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: { requiresSignIn: true } } });
    await act(async () => render(<AccountSettings initialPanel="security" />));
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'Current123!' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'Changed123!' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'Changed123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
  });

  it('updates verification state after an inbox change', async () => {
    mocks.user = { ...baseUser };
    vi.mocked(api.put).mockResolvedValue({
      data: { success: true, data: { name: baseUser.name, email: 'new@example.test', emailVerified: false } },
    });
    await act(async () => render(<AccountSettings initialPanel="account" />));
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'new@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(mocks.updateUserSession).toHaveBeenCalledWith({
        name: baseUser.name,
        email: 'new@example.test',
        emailVerified: false,
      })
    );
  });
  afterEach(() => {
    mocks.user = null;
    mocks.profile = null;
    mocks.mealLogs = [];
    vi.clearAllMocks();
  });

  it('keeps password controls visible but disabled for a Google-only account', async () => {
    mocks.user = { ...baseUser, authMethods: { password: false, google: true } };
    await act(async () => {
      render(<AccountSettings initialPanel="security" />);
    });

    expect(screen.getByText(/uses Google sign-in and does not have a KAINARA password/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Current Password')).toBeDisabled();
    expect(screen.getByLabelText('New Password')).toBeDisabled();
    expect(screen.getByLabelText('Confirm New Password')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Google sign-in account' })).toBeDisabled();
  });

  it('keeps password controls enabled for a password account', async () => {
    mocks.user = { ...baseUser, authMethods: { password: true, google: false } };
    await act(async () => {
      render(<AccountSettings initialPanel="security" />);
    });

    expect(screen.getByLabelText('Current Password')).toBeEnabled();
    expect(screen.getByLabelText('New Password')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeEnabled();
  });

  it.each([false, true])('deletes through the same button with password enabled=%s', async (passwordEnabled) => {
    mocks.user = { ...baseUser, authMethods: { password: passwordEnabled, google: true } };
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    await act(async () => render(<AccountSettings initialPanel="privacy" />));
    const button = screen.getByRole('button', { name: 'Permanently delete account' });
    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Type DELETE MY KAINARA ACCOUNT'), {
      target: { value: 'DELETE MY KAINARA ACCOUNT' },
    });
    if (passwordEnabled) {
      expect(button).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Synthetic!123' } });
    } else {
      expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    }
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(mocks.completeAccountDeletion).toHaveBeenCalledOnce());
    expect(api.delete).toHaveBeenCalledWith('/user/account', {
      data: {
        confirmation: 'DELETE MY KAINARA ACCOUNT',
        ...(passwordEnabled ? { password: 'Synthetic!123' } : {}),
      },
    });
    expect(setSessionRefreshSuppressed).toHaveBeenCalledWith(true);
  });

  it('keeps the session and permits retry when deletion fails', async () => {
    mocks.user = { ...baseUser, authMethods: { password: false, google: true } };
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('Unavailable'));
    await act(async () => render(<AccountSettings initialPanel="privacy" />));
    fireEvent.change(screen.getByLabelText('Type DELETE MY KAINARA ACCOUNT'), {
      target: { value: 'DELETE MY KAINARA ACCOUNT' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Permanently delete account' }));
    await waitFor(() => expect(setSessionRefreshSuppressed).toHaveBeenLastCalledWith(false));
    expect(mocks.completeAccountDeletion).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Permanently delete account' })).toBeEnabled();
  });

  it('renders personal activity, inside/outside meal distribution, and biometric blueprint for USER', async () => {
    mocks.user = { ...baseUser };
    mocks.profile = {
      userProfile: {
        heightCm: 170,
        weightKg: 65,
        targetWeightKg: 62,
        dailyCalorieTarget: 2100,
        dietaryPreference: 'OMNIVORE',
        ricePreference: 'FLEXIBLE',
        foodCulture: 'Filipino Heritage',
        planningRegionName: 'NCR',
        checkinStreak: 3,
      },
      healthConditions: ['HYPERTENSION'],
      allergies: ['PEANUT'],
    };
    mocks.mealLogs = [
      { id: '1', source: 'SYSTEM_GENERATED', status: 'DONE', loggedAt: '2026-10-01T12:00:00Z' },
      { id: '2', source: 'SYSTEM_GENERATED', status: 'DONE', loggedAt: '2026-10-01T18:00:00Z' },
      { id: '3', source: 'USER_LOGGED', status: 'DONE', loggedAt: '2026-10-02T12:00:00Z' },
    ];

    await act(async () => {
      render(<AccountSettings initialPanel="account" />);
    });

    expect(screen.getByText(/Personal Activity & Nutrition Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Meals Inside vs Outside KAINARA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Inside KAINARA/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Outside Dining/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Biometrics & Body Target/i)).toBeInTheDocument();
    expect(screen.getByText(/Dietary & Cultural Blueprint/i)).toBeInTheDocument();
    expect(screen.getByText('Account information')).toBeInTheDocument();
  });

  it('omits personal nutrition profile section when user is not a USER role', async () => {
    mocks.user = { ...baseUser, role: 'NUTRITIONIST' };
    await act(async () => {
      render(<AccountSettings initialPanel="account" />);
    });

    expect(screen.queryByText(/Personal Activity & Nutrition Profile/i)).not.toBeInTheDocument();
    expect(screen.getByText('Account information')).toBeInTheDocument();
  });
});
