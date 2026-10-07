'use client';
import { useEffect, useState, useRef } from 'react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api-error';
import {
  currentDeviceSubscription,
  deviceNotificationsSupported,
  disableDeviceNotifications,
  enableDeviceNotifications,
} from '@/lib/device-notifications';

export default function DeviceNotificationsPanel() {
  const { user } = useAuth();
  const ownerId = user?.userId;
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const [resolvedOwner, setResolvedOwner] = useState<string | null>(null);
  const [config, setConfig] = useState<{ available: boolean; publicKey: string | null } | null>(null);
  const [supported, setSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [delivery, setDelivery] = useState<{ status: string; attemptedAt: string | null } | null>(null);
  const [browserPush, setBrowserPush] = useState<{ receivedAt: number; status: string } | null>(null);
  useEffect(() => {
    setBrowserPush(null);
    const worker = navigator.serviceWorker;
    if (!worker || !ownerId) return;
    const receive = (event: MessageEvent) => {
      const source = event.source as ServiceWorker | null;
      if (
        source?.scriptURL !== new URL('/kainara-notifications-sw.js', window.location.origin).href ||
        event.data?.type !== 'KAINARA_PUSH_STATUS' ||
        !Number.isFinite(event.data.receivedAt) ||
        !['DISPLAY_REQUESTED', 'DISPLAY_FAILED', 'EXPIRED'].includes(event.data.status)
      )
        return;
      setBrowserPush({ receivedAt: event.data.receivedAt, status: event.data.status });
    };
    worker.addEventListener('message', receive);
    return () => worker.removeEventListener('message', receive);
  }, [ownerId]);
  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setSubscription(null);
    setDelivery(null);
    setMessage('');
    setError('');
    setBusy(false);
    setSupported(deviceNotificationsSupported());
    if (!ownerId) return;
    void (async () => {
      try {
        const response = await api.get('/notifications/push/config');
        const local = await currentDeviceSubscription();
        const status = local ? await api.post('/notifications/push/status', { endpoint: local.endpoint }) : null;
        if (!cancelled) {
          setConfig(response.data.data);
          setSubscription(status?.data.data.subscribed ? local : null);
          setDelivery(status?.data.data.delivery ?? null);
          setResolvedOwner(ownerId);
        }
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Could not load device notification settings.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId]);
  const perform = async (operation: 'enable' | 'disable' | 'test' | 'refresh') => {
    if (!ownerId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (operation === 'refresh') {
        const local = await currentDeviceSubscription();
        const response = local ? await api.post('/notifications/push/status', { endpoint: local.endpoint }) : null;
        if (currentOwner.current !== ownerId) return;
        setSubscription(response?.data.data.subscribed ? local : null);
        setDelivery(response?.data.data.delivery ?? null);
        setMessage('Device status refreshed.');
      } else if (operation === 'enable' && config?.publicKey) {
        const next = await enableDeviceNotifications(ownerId, config.publicKey);
        if (currentOwner.current !== ownerId) return;
        setSubscription(next);
        setMessage('Notifications are enabled on this device.');
      } else if (operation === 'disable') {
        await disableDeviceNotifications();
        if (currentOwner.current !== ownerId) return;
        setSubscription(null);
        setDelivery(null);
        setBrowserPush(null);
        setMessage('Notifications are disabled on this device.');
      } else if (operation === 'test' && subscription) {
        const response = await api.post('/notifications/push/test', { endpoint: subscription.endpoint });
        if (currentOwner.current !== ownerId) return;
        setMessage(
          response.data.data?.processing
            ? 'The test is already being sent. Refresh delivery status to check the result.'
            : 'Test sent. Check your device notification panel.'
        );
      }
    } catch (err) {
      const pushMessage =
        getApiErrorCode(err) === 'PUSH_SEND_FAILED'
          ? 'The push service did not accept this test. Refresh delivery status and check your connection before trying again.'
          : getApiErrorCode(err) === 'PUSH_UNAVAILABLE'
            ? 'Device notifications are not configured on this server yet.'
            : null;
      if (currentOwner.current === ownerId)
        setError(
          pushMessage ??
            getApiErrorMessage(err, err instanceof Error ? err.message : 'Could not update device notifications.')
        );
    } finally {
      if (currentOwner.current === ownerId) setBusy(false);
    }
  };
  return (
    <section className="space-y-3 border-t border-brand-border/70 pt-5">
      <h3 className="font-display font-bold text-brand-text">Notifications on this device</h3>
      <p className="text-xs leading-relaxed text-brand-muted">
        Enable each browser or device separately to receive KAINARA alerts outside the app. On iPhone or iPad, add
        KAINARA to your Home Screen first. Signing out disables this device.
      </p>
      {resolvedOwner === ownerId && (
        <p className="text-xs font-bold text-brand-text">
          {subscription ? 'Device notifications are enabled here.' : 'Device notifications are not enabled here.'}
        </p>
      )}
      {!supported && (
        <p className="text-xs text-brand-muted">
          Device notifications are unavailable in this browser or installation.
        </p>
      )}
      {config && !config.available && (
        <p className="text-xs text-brand-muted">Device notifications are not configured on this server yet.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {subscription && resolvedOwner === ownerId ? (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => void perform('disable')}>
              Disable on this device
            </Button>
            <Button variant="secondary" disabled={busy || !config?.available} onClick={() => void perform('test')}>
              Send test notification
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            disabled={busy || !supported || !config?.available || resolvedOwner !== ownerId}
            onClick={() => void perform('enable')}
          >
            Enable on this device
          </Button>
        )}
      </div>
      {subscription && resolvedOwner === ownerId && (
        <Button variant="ghost" disabled={busy} onClick={() => void perform('refresh')}>
          Refresh delivery status
        </Button>
      )}
      {delivery && resolvedOwner === ownerId && (
        <p className="text-xs text-brand-muted">
          Last delivery attempt:{' '}
          {delivery.attemptedAt ? new Date(delivery.attemptedAt).toLocaleTimeString() : 'Pending'}.{' '}
          {delivery.status === 'SENT'
            ? 'Accepted by the push provider; device display is not confirmed.'
            : `Delivery status: ${delivery.status}.`}
        </p>
      )}
      {browserPush && (
        <p role="status" className="text-xs text-brand-muted">
          Browser received a push at {new Date(browserPush.receivedAt).toLocaleTimeString()}.{' '}
          {browserPush.status === 'DISPLAY_REQUESTED'
            ? 'Display request accepted. Device settings control the banner and sound.'
            : browserPush.status === 'EXPIRED'
              ? 'It had expired and was not displayed.'
              : 'The browser could not display it. Check the site notification permission.'}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs text-brand-green">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-status-error-text">
          {error}
        </p>
      )}
    </section>
  );
}
