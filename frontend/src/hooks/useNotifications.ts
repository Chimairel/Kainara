import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [inbox, setInbox] = useState<{
    accountId: string;
    notifications: Notification[];
    unreadCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const accountId = user?.userId;
  const currentAccountId = useRef(accountId);
  currentAccountId.current = accountId;

  const fetchNotifications = useCallback(
    async (signal?: AbortSignal) => {
      if (!accountId) {
        setInbox(null);
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.get('/notifications', { signal });
        if (!signal?.aborted && currentAccountId.current === accountId && res.data?.success) {
          setInbox({ accountId, notifications: res.data.data.notifications, unreadCount: res.data.data.unreadCount });
        }
      } catch (err) {
        console.warn('[useNotifications] Fetch failed:', err);
        if (!signal?.aborted && currentAccountId.current === accountId) {
          setInbox((previous) =>
            previous?.accountId === accountId ? previous : { accountId, notifications: [], unreadCount: 0 }
          );
        }
      } finally {
        if (!signal?.aborted && currentAccountId.current === accountId) setIsLoading(false);
      }
    },
    [accountId]
  );

  useVisiblePolling(fetchNotifications, {
    enabled: Boolean(accountId),
    intervalMs: 15000,
    scopeKey: accountId,
  });
  useEffect(() => {
    if (!accountId) {
      setInbox(null);
      setIsLoading(false);
      return;
    }
    const refresh = () => {
      void fetchNotifications();
    };
    window.addEventListener('nutrimind:notifications-updated', refresh);
    return () => window.removeEventListener('nutrimind:notifications-updated', refresh);
  }, [accountId, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    setInbox((previous) =>
      previous && previous.accountId === accountId
        ? {
            ...previous,
            notifications: previous.notifications.map((notification) =>
              notification.id === id ? { ...notification, isRead: true } : notification
            ),
            unreadCount: Math.max(0, previous.unreadCount - 1),
          }
        : previous
    );
  };

  const markAllAsRead = async () => {
    await api.patch('/notifications/read-all');

    setInbox((previous) =>
      previous && previous.accountId === accountId
        ? {
            ...previous,
            notifications: previous.notifications.map((notification) => ({ ...notification, isRead: true })),
            unreadCount: 0,
          }
        : previous
    );
  };

  const visibleInbox = inbox?.accountId === accountId ? inbox : null;
  return {
    notifications: visibleInbox?.notifications ?? [],
    unreadCount: visibleInbox?.unreadCount ?? 0,
    isLoading: Boolean(accountId) && !visibleInbox ? true : isLoading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
