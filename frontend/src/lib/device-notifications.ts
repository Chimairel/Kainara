import api from '@/lib/axios';
import { cookieHelper, decodeToken } from '@/lib/auth';

const ownerKey = 'kainara-device-notification-owner';
export function deviceNotificationsSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}
function applicationKey(value: string) {
  const raw = atob(
    value
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(value.length / 4) * 4, '=')
  );
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
export async function currentDeviceSubscription() {
  if (!deviceNotificationsSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return (await registration?.pushManager.getSubscription()) ?? null;
}
export async function enableDeviceNotifications(userId: string, publicKey: string) {
  if (!deviceNotificationsSupported())
    throw new Error(
      'This browser does not support device notifications. On iPhone or iPad, add KAINARA to your Home Screen first.'
    );
  // This call starts directly from the user's button click, before any network await.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error('Notifications were not allowed. You can change this in your browser or device settings.');
  await navigator.serviceWorker.register('/kainara-notifications-sw.js', { scope: '/', updateViaCache: 'none' });
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  const key = applicationKey(publicKey);
  const existingKey = subscription?.options.applicationServerKey;
  if (
    subscription &&
    existingKey &&
    !Array.from(new Uint8Array(existingKey)).every((byte, index) => byte === key[index])
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const json = subscription.toJSON();
  try {
    const token = cookieHelper.get('nutrimind_session');
    if (!token || decodeToken(token)?.userId !== userId)
      throw new Error('Your account changed. Enable notifications again from your current account.');
    await api.post('/notifications/push/subscription', { endpoint: json.endpoint, keys: json.keys });
    localStorage.setItem(ownerKey, userId);
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
  return subscription;
}
export async function disableDeviceNotifications() {
  const subscription = await currentDeviceSubscription();
  try {
    if (subscription)
      await api.delete('/notifications/push/subscription', {
        data: { endpoint: subscription.endpoint },
        timeout: 5000,
      });
  } catch {
    // Browser revocation is sufficient to stop this endpoint when the API is offline.
  } finally {
    // Unsubscribe even if the API is offline, so a logged-out device cannot receive alerts.
    if (subscription) await subscription.unsubscribe();
    if (deviceNotificationsSupported()) {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const notifications = await registration?.getNotifications();
      notifications?.forEach((notification) => notification.close());
    }
    if (typeof window !== 'undefined') localStorage.removeItem(ownerKey);
  }
}
