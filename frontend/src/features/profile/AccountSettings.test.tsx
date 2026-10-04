import { render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountSettings from './AccountSettings';
import type { UserSession } from '@/lib/context/AuthContext';
import type { UserProfileData } from '@/hooks/useProfile';

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
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    logout: vi.fn(),
    completeAccountDeletion: vi.fn(),
    updateUserSession: vi.fn(),
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
  afterEach(() => {
    mocks.user = null;
    mocks.profile = null;
    mocks.mealLogs = [];
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
