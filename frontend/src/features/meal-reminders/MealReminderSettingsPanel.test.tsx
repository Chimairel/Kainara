import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MealReminderSettingsPanel from './MealReminderSettingsPanel';
import DeviceNotificationsPanel from './DeviceNotificationsPanel';
import { suggestedMealTimes } from './types';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  current: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'member' } }) }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, put: mocks.put, post: mocks.post } }));
vi.mock('@/lib/device-notifications', () => ({
  deviceNotificationsSupported: () => true,
  currentDeviceSubscription: mocks.current,
  enableDeviceNotifications: mocks.enable,
  disableDeviceNotifications: mocks.disable,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.current.mockResolvedValue(null);
  mocks.get.mockImplementation(async (path: string) => ({
    data: {
      data: path.includes('/push/')
        ? { available: true, publicKey: 'synthetic-key' }
        : { ...suggestedMealTimes, userId: 'member', updatedAt: 'fixture' },
    },
  }));
  mocks.put.mockResolvedValue({ data: { success: true } });
});
describe('meal times and device notifications', () => {
  it('edits the saved schedule without sending internal fields or changing the clinical profile', async () => {
    render(<MealReminderSettingsPanel />);
    await waitFor(() => expect(screen.getByLabelText('Breakfast')).toHaveValue('07:00'));
    fireEvent.change(screen.getByLabelText('Breakfast'), { target: { value: '08:45' } });
    fireEvent.click(screen.getByLabelText('Send meal reminders'));
    expect(screen.getByLabelText('Prepare: 60 minutes before eating')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save meal times' }));
    await screen.findByText('Meal times and reminder preferences saved.');
    expect(mocks.put).toHaveBeenCalledWith('/user/meal-reminders', {
      ...suggestedMealTimes,
      breakfastTime: '08:45',
      remindersEnabled: true,
    });
    expect(mocks.enable).not.toHaveBeenCalled();
  });
  it('reports a rejected notification permission without showing an enabled device', async () => {
    mocks.enable.mockRejectedValue(new Error('Notifications were not allowed.'));
    render(<DeviceNotificationsPanel />);
    const button = screen.getByRole('button', { name: 'Enable on this device' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Disable on this device' })).not.toBeInTheDocument();
  });
  it('enables, tests and disables only the current device', async () => {
    mocks.enable.mockResolvedValue({ endpoint: 'https://fcm.googleapis.com/send/synthetic' });
    mocks.post.mockResolvedValue({ data: { success: true } });
    mocks.disable.mockResolvedValue(undefined);
    render(<DeviceNotificationsPanel />);
    const button = screen.getByRole('button', { name: 'Enable on this device' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByText('Notifications are enabled on this device.');
    fireEvent.click(screen.getByRole('button', { name: 'Send test notification' }));
    await screen.findByText('Test sent. Check your device notification panel.');
    expect(mocks.post).toHaveBeenCalledWith('/notifications/push/test', {
      endpoint: 'https://fcm.googleapis.com/send/synthetic',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Disable on this device' }));
    await screen.findByText('Notifications are disabled on this device.');
    expect(mocks.disable).toHaveBeenCalledOnce();
  });
});
