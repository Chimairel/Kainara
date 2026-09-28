import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';

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

  const fetchNotifications = useCallback(async () => {
    if (!accountId) {
      setInbox(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.get('/notifications');
      if (currentAccountId.current === accountId && res.data?.success) {
        setInbox({ accountId, notifications: res.data.data.notifications, unreadCount: res.data.data.unreadCount });
      }
    } catch (err) {
      console.warn('[useNotifications] Fetch failed:', err);
      if (currentAccountId.current === accountId) {
        setInbox((previous) => previous?.accountId === accountId ? previous :
          { accountId, notifications: [], unreadCount: 0 });
      }
    } finally {
      if (currentAccountId.current === accountId) setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchNotifications();

    if (!accountId) return;

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000);

    // Refresh on window focus
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('nutrimind:notifications-updated', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('nutrimind:notifications-updated', handleFocus);
    };
  }, [fetchNotifications, accountId]);

  const markAsRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    setInbox((previous) => previous && previous.accountId === accountId ? {
      ...previous,
      notifications: previous.notifications.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification),
      unreadCount: Math.max(0, previous.unreadCount - 1),
    } : previous);
  };

  const markAllAsRead = async () => {
    await api.patch('/notifications/read-all');

    setInbox((previous) => previous && previous.accountId === accountId ? {
      ...previous, notifications: previous.notifications.map((notification) => ({ ...notification, isRead: true })),
      unreadCount: 0,
    } : previous);
  };

  const visibleInbox = inbox?.accountId === accountId ? inbox : null;
  return {
    notifications: visibleInbox?.notifications ?? [],
    unreadCount: visibleInbox?.unreadCount ?? 0,
    isLoading: Boolean(accountId) && !visibleInbox ? true : isLoading,
    markAsRead, markAllAsRead, refresh: fetchNotifications,
  };
}
