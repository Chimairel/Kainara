'use client';
import { useEffect, useState, useRef } from 'react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
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
  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setSubscription(null);
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
  const perform = async (operation: 'enable' | 'disable' | 'test') => {
    if (!ownerId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (operation === 'enable' && config?.publicKey) {
        const next = await enableDeviceNotifications(ownerId, config.publicKey);
        if (currentOwner.current !== ownerId) return;
        setSubscription(next);
        setMessage('Notifications are enabled on this device.');
      } else if (operation === 'disable') {
        await disableDeviceNotifications();
        if (currentOwner.current !== ownerId) return;
        setSubscription(null);
        setMessage('Notifications are disabled on this device.');
      } else if (operation === 'test' && subscription) {
        await api.post('/notifications/push/test', { endpoint: subscription.endpoint });
        if (currentOwner.current !== ownerId) return;
        setMessage('Test sent. Check your device notification panel.');
      }
    } catch (err) {
      if (currentOwner.current === ownerId)
        setError(
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
        Receive KAINARA alerts outside the app. On iPhone or iPad, add KAINARA to your Home Screen first. Signing out
        disables this device.
      </p>
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
