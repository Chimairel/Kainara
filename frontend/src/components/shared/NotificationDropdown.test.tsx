import { render, screen, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotificationDropdown from './NotificationDropdown';
import type { UserSession } from '@/lib/context/AuthContext';
import api from '@/lib/axios';

interface TestNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  targetPath?: string;
}

const mocks = vi.hoisted(() => ({
  user: null as UserSession | null,
  notifications: [] as TestNotification[],
  unreadCount: 0,
  isLoading: false,
  soundEnabled: true,
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  toggleNotificationSound: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: mocks.notifications,
    unreadCount: mocks.unreadCount,
    isLoading: mocks.isLoading,
    soundEnabled: mocks.soundEnabled,
    markAsRead: mocks.markAsRead,
    markAllAsRead: mocks.markAllAsRead,
    toggleNotificationSound: mocks.toggleNotificationSound,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn() },
}));

const baseUser: UserSession = {
  userId: 'user-fixture',
  name: 'Test User',
  email: 'test@example.com',
  role: 'USER',
  emailVerified: true,
  onboardingDone: true,
  tosAccepted: true,
  reportAcknowledged: true,
};

describe('NotificationDropdown', () => {
  afterEach(() => {
    mocks.user = null;
    mocks.notifications = [];
    mocks.unreadCount = 0;
    mocks.isLoading = false;
    mocks.soundEnabled = true;
    vi.clearAllMocks();
  });

  it('opens member health details from a clarification notification and marks it read', () => {
    mocks.user = { ...baseUser };
    mocks.markAsRead.mockResolvedValueOnce(undefined);
    mocks.notifications = [
      {
        id: 'clarification',
        title: 'Health clarification requested',
        message: 'Your RND has a question about your health details.',
        type: 'REVIEW_REQUEST',
        targetPath: '/profile/clinical-evidence',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];
    render(<NotificationDropdown />);
    fireEvent.click(screen.getByRole('button', { name: /view notifications/i }));
    fireEvent.click(screen.getByRole('button', { name: /Health clarification requested/ }));
    expect(mocks.markAsRead).toHaveBeenCalledWith('clarification');
    expect(mocks.push).toHaveBeenCalledWith('/profile/clinical-evidence');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it.each([
    ['USER', 'REVIEW_REQUEST', undefined],
    ['USER', 'REVIEW_REQUEST', '/admin/users'],
    ['USER', 'REVIEW_REQUEST', '/profile/clinical-evidence?redirect=/admin/users'],
    ['USER', 'REVIEW_REQUEST', 'https://example.com/profile/clinical-evidence'],
    ['USER', 'PLAN_APPROVED', '/profile/clinical-evidence'],
    ['ADMIN', 'REVIEW_REQUEST', '/profile/clinical-evidence'],
  ] as const)('does not route an unallowlisted member target (%s, %s, %s)', (role, type, targetPath) => {
    mocks.user = { ...baseUser, role };
    mocks.notifications = [
      {
        id: 'notice',
        title: 'Review notice',
        message: 'Update',
        type,
        targetPath,
        isRead: true,
        createdAt: new Date().toISOString(),
      },
    ];
    render(<NotificationDropdown />);
    fireEvent.click(screen.getByRole('button', { name: /view notifications/i }));
    fireEvent.click(screen.getByRole('button', { name: /Review notice/ }));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.markAsRead).not.toHaveBeenCalled();
  });

  it.each([
    ['USER', 'MEAL_REMINDER', '/meals?date=2026-10-10', '/meals?date=2026-10-10'],
    ['ADMIN', 'NUTRITIONIST_APPLICATION', undefined, '/admin/users?tab=nutritionists'],
    ['NUTRITIONIST', 'REVIEW_REQUEST', '/profile/clinical-evidence', '/nutritionist/reviews'],
  ] as const)('preserves existing notification routing for %s %s', (role, type, targetPath, expectedPath) => {
    mocks.user = { ...baseUser, role };
    mocks.notifications = [
      {
        id: 'notice',
        title: 'Review notice',
        message: 'Update',
        type,
        targetPath,
        isRead: true,
        createdAt: new Date().toISOString(),
      },
    ];
    render(<NotificationDropdown />);
    fireEvent.click(screen.getByRole('button', { name: /view notifications/i }));
    fireEvent.click(screen.getByRole('button', { name: /Review notice/ }));
    expect(mocks.push).toHaveBeenCalledWith(expectedPath);
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('renders bell button and opens dropdown menu on click', async () => {
    mocks.user = { ...baseUser };
    mocks.unreadCount = 2;
    mocks.notifications = [
      {
        id: 'n1',
        title: 'Weekly Plan Approved',
        message: 'Your weekly meal plan has been reviewed and approved.',
        type: 'PLAN_APPROVED',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'n2',
        title: 'Outside Meal Recorded',
        message: 'Your chicken adobo outside meal was successfully estimated.',
        type: 'OUTSIDE_MEAL_REVIEWED',
        isRead: true,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    render(<NotificationDropdown />);

    const bellButton = screen.getByRole('button', { name: /view notifications/i });
    expect(bellButton).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Click to open dropdown
    await act(async () => {
      fireEvent.click(bellButton);
    });

    expect(screen.getByRole('dialog', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByText('Weekly Plan Approved')).toBeInTheDocument();
    expect(screen.getByText('Outside Meal Recorded')).toBeInTheDocument();
    expect(screen.getByText(/2 new/i)).toBeInTheDocument();
    expect(screen.queryByText('Planner Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Starter Plan Active')).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
    mocks.markAsRead.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole('button', { name: /Weekly Plan Approved/ }));
    expect(mocks.markAsRead).toHaveBeenCalledWith('n1');
  });

  it('allows marking all notifications as read and toggling sound', async () => {
    mocks.user = { ...baseUser };
    mocks.unreadCount = 1;
    mocks.notifications = [
      {
        id: 'n1',
        title: 'New Check-in Due',
        message: 'Time for your weekly weight and nutrition check-in.',
        type: 'WEEKLY_CHECKIN',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];

    render(<NotificationDropdown />);

    const bellButton = screen.getByRole('button', { name: /view notifications/i });
    await act(async () => {
      fireEvent.click(bellButton);
    });

    // Toggle sound
    const soundButton = screen.getByRole('switch', { name: /notification sound/i });
    await act(async () => {
      fireEvent.click(soundButton);
    });
    expect(mocks.toggleNotificationSound).toHaveBeenCalledTimes(1);

    // Mark all as read
    const markReadButton = screen.getByRole('button', { name: /mark all notifications as read/i });
    await act(async () => {
      fireEvent.click(markReadButton);
    });
    expect(mocks.markAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when there are no notifications', async () => {
    mocks.user = { ...baseUser };
    mocks.unreadCount = 0;
    mocks.notifications = [];

    render(<NotificationDropdown />);

    const bellButton = screen.getByRole('button', { name: /view notifications/i });
    await act(async () => {
      fireEvent.click(bellButton);
    });

    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
    expect(screen.getByText(/all caught up with updates/i)).toBeInTheDocument();
    expect(screen.queryByText('Planner Status')).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /notifications/i })).not.toBeInTheDocument();
    fireEvent.click(bellButton);
    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});
