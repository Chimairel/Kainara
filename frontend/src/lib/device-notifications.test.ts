import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { enableDeviceNotifications, disableDeviceNotifications } from './device-notifications';

const mocks = vi.hoisted(() => ({ post: vi.fn(), remove: vi.fn(), owner: 'member' }));
vi.mock('@/lib/axios', () => ({ default: { post: mocks.post, delete: mocks.remove } }));
vi.mock('@/lib/auth', () => ({ cookieHelper: { get: () => 'fixture' }, decodeToken: () => ({ userId: mocks.owner }) }));
const unsubscribe = vi.fn(),
  subscribe = vi.fn(),
  getSubscription = vi.fn(),
  register = vi.fn(),
  permission = vi.fn(),
  close = vi.fn();
const subscription = {
  endpoint: 'https://fcm.googleapis.com/send/synthetic',
  options: {},
  unsubscribe,
  toJSON: () => ({
    endpoint: 'https://fcm.googleapis.com/send/synthetic',
    keys: { auth: 'fixture', p256dh: 'fixture' },
  }),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner = 'member';
  unsubscribe.mockResolvedValue(true);
  mocks.post.mockResolvedValue({});
  mocks.remove.mockResolvedValue({});
  permission.mockResolvedValue('granted');
  getSubscription.mockResolvedValue(subscription);
  subscribe.mockResolvedValue(subscription);
  const registration = {
    pushManager: { getSubscription, subscribe },
    getNotifications: async () => [{ close }],
  };
  register.mockResolvedValue(registration);
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('Notification', { requestPermission: permission });
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('navigator', {
    serviceWorker: { register, ready: Promise.resolve(registration), getRegistration: async () => registration },
  });
});
afterEach(() => vi.unstubAllGlobals());
it('permission denial does not register or save a subscription', async () => {
  permission.mockResolvedValue('denied');
  await expect(enableDeviceNotifications('member', 'BA')).rejects.toThrow('not allowed');
  expect(register).not.toHaveBeenCalled();
  expect(mocks.post).not.toHaveBeenCalled();
});
it('a browser push registration failure gives Brave guidance without attempting an API binding and can retry', async () => {
  getSubscription.mockResolvedValue(null);
  subscribe.mockRejectedValueOnce(new DOMException('Registration failed - push service error', 'AbortError'));
  await expect(enableDeviceNotifications('member', 'BA')).rejects.toThrow('brave://settings/privacy');
  expect(mocks.post).not.toHaveBeenCalled();
  expect(unsubscribe).not.toHaveBeenCalled();
  await expect(enableDeviceNotifications('member', 'BA')).resolves.toBe(subscription);
  expect(mocks.post).toHaveBeenCalledOnce();
});
it('permission revoked during browser subscription gives site permission guidance', async () => {
  getSubscription.mockResolvedValue(null);
  subscribe.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
  await expect(enableDeviceNotifications('member', 'BA')).rejects.toThrow('Allow notifications for KAINARA');
  expect(mocks.post).not.toHaveBeenCalled();
});
it('an account change during activation prevents binding and revokes the local endpoint', async () => {
  mocks.owner = 'other';
  await expect(enableDeviceNotifications('member', 'BA')).rejects.toThrow('account changed');
  expect(mocks.post).not.toHaveBeenCalled();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
it('a failed subscription save revokes the browser subscription', async () => {
  mocks.post.mockRejectedValue(new Error('offline'));
  await expect(enableDeviceNotifications('member', 'BA')).rejects.toThrow('offline');
  expect(unsubscribe).toHaveBeenCalledOnce();
});
it('disable still revokes the endpoint and closes device alerts when the API is offline', async () => {
  mocks.remove.mockRejectedValue(new Error('offline'));
  await disableDeviceNotifications();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
});
