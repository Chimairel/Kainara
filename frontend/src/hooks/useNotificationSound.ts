'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createNotificationAudio, createNotificationTracker, NOTIFICATION_SOUND_KEY } from '@/lib/notification-sound';

function readPreference() {
  try {
    return localStorage.getItem(NOTIFICATION_SOUND_KEY) !== 'muted';
  } catch {
    return true;
  }
}

export function useNotificationSound(accountId?: string) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const enabled = useRef(true);
  const current = useRef<{
    accountId: string;
    audio: ReturnType<typeof createNotificationAudio>;
    observe: ReturnType<typeof createNotificationTracker>;
  } | null>(null);

  useEffect(() => {
    const sync = () => {
      enabled.current = readPreference();
      setSoundEnabled(enabled.current);
      if (!enabled.current) current.current?.audio.stop();
    };
    sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === NOTIFICATION_SOUND_KEY || event.key === null) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!accountId) return;
    const audio = createNotificationAudio();
    const state = { accountId, audio, observe: createNotificationTracker() };
    current.current = state;
    const unlock = () => {
      if (enabled.current) audio.unlock();
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('click', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('click', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      audio.dispose();
      if (current.current === state) current.current = null;
    };
  }, [accountId]);

  const observeNotifications = useCallback(
    (notifications: Parameters<ReturnType<typeof createNotificationTracker>>[0]) => {
      const state = current.current;
      if (!state || state.accountId !== accountId) return;
      const hasNewUnread = state.observe(notifications);
      if (hasNewUnread && enabled.current && document.visibilityState === 'visible') state.audio.play();
    },
    [accountId]
  );

  const toggleNotificationSound = useCallback(() => {
    enabled.current = !enabled.current;
    setSoundEnabled(enabled.current);
    try {
      localStorage.setItem(NOTIFICATION_SOUND_KEY, enabled.current ? 'enabled' : 'muted');
    } catch {
      /* Keep the preference in memory when storage is unavailable. */
    }
    if (enabled.current) current.current?.audio.unlock();
    else current.current?.audio.stop();
  }, []);

  return { soundEnabled, toggleNotificationSound, observeNotifications };
}
