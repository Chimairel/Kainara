import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import DeviceNotificationsPanel from './DeviceNotificationsPanel';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'synthetic-member' } }) }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
vi.mock('@/lib/device-notifications', () => ({
  deviceNotificationsSupported: () => true,
  currentDeviceSubscription: async () => ({ endpoint: 'https://push.example.invalid/synthetic' }),
  enableDeviceNotifications: vi.fn(), disableDeviceNotifications: vi.fn(),
}));
const worker = new EventTarget();
beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue({ data: { data: { available: true, publicKey: 'synthetic' } } });
  mocks.post.mockReset().mockResolvedValue({ data: { data: { subscribed: true, delivery: { status: 'SENT', attemptedAt: null } } } });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: worker });
});
function received(status: string, source = new URL('/kainara-notifications-sw.js', window.location.origin).href) {
  const event = new MessageEvent('message', { data: { type: 'KAINARA_PUSH_STATUS', receivedAt: Date.now(), status } });
  Object.defineProperty(event, 'source', { value: { scriptURL: source } });
  act(() => worker.dispatchEvent(event));
}
it('explains a received push with no banner and clears the old receipt before another test', async () => {
  render(<DeviceNotificationsPanel />);
  await screen.findByText('Device notifications are enabled here.');
  received('DISPLAY_REQUESTED');
  expect(screen.getByText(/No banner.*Do Not Disturb/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Send test notification' }));
  await screen.findByText('Test accepted by the push provider. Waiting for this browser to receive it.');
  expect(screen.queryByText(/Browser received a push/)).not.toBeInTheDocument();
  expect(screen.queryByText(/No banner/)).not.toBeInTheDocument();
  expect(mocks.post).toHaveBeenCalledWith('/notifications/push/test', { endpoint: 'https://push.example.invalid/synthetic' });
});
it('rejects messages from another worker and reports a browser display failure accurately', async () => {
  render(<DeviceNotificationsPanel />);
  await screen.findByText('Device notifications are enabled here.');
  received('DISPLAY_REQUESTED', 'https://another.example.invalid/worker.js');
  expect(screen.queryByText(/Browser received a push/)).not.toBeInTheDocument();
  received('DISPLAY_FAILED');
  expect(screen.getByText(/browser could not display it/)).toBeVisible();
});
