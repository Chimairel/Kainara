import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsProvider, useNotifications } from './useNotifications';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import { NOTIFICATION_SOUND_KEY } from '@/lib/notification-sound';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  user: { userId: 'account-1', role: 'USER' } as { userId: string; role: string } | null,
  play: vi.fn(),
  unlock: vi.fn(),
  stop: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, patch: mocks.patch } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/lib/notification-sound', async (original) => ({
  ...(await original<typeof import('@/lib/notification-sound')>()),
  createNotificationAudio: () => ({ play: mocks.play, unlock: mocks.unlock, stop: mocks.stop, dispose: mocks.dispose }),
}));

const notification = (id: string, second: number) => ({
  id,
  title: 'Fixture update',
  message: 'New update',
  type: 'PLAN_APPROVED',
  isRead: false,
  createdAt: new Date(1_000_000 + second * 1000).toISOString(),
});
const response = (notifications: ReturnType<typeof notification>[]) => ({
  data: { success: true, data: { notifications, unreadCount: notifications.length } },
});

describe('shared notification inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    mocks.get.mockResolvedValue({ data: { success: true, data: { notifications: [], unreadCount: 125 } } });
    mocks.patch.mockResolvedValue({ data: { success: true } });
  });

  it.each(['USER', 'NUTRITIONIST', 'ADMIN'])('loads the same account-scoped inbox for %s', async (role) => {
    mocks.user = { userId: 'account-1', role };
    const { result } = renderHook(() => useNotifications(), { wrapper: NotificationsProvider });
    await waitFor(() => expect(result.current.unreadCount).toBe(125));
    expect(mocks.get).toHaveBeenCalledWith(
      '/notifications',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('clears the entire unread inbox with one request, beyond the first 50 displayed items', async () => {
    mocks.user = { userId: 'account-1', role: 'NUTRITIONIST' };
    const { result } = renderHook(() => useNotifications(), { wrapper: NotificationsProvider });
    await waitFor(() => expect(result.current.unreadCount).toBe(125));
    await act(async () => result.current.markAllAsRead());
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(mocks.patch).toHaveBeenCalledWith('/notifications/read-all');
    expect(result.current.unreadCount).toBe(0);
  });

  it('does not request notifications without an account', async () => {
    mocks.user = null;
    const { result } = renderHook(() => useNotifications(), { wrapper: NotificationsProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('does not show one account’s inbox after switching to another account', async () => {
    mocks.user = { userId: 'account-1', role: 'USER' };
    const { result, rerender } = renderHook(() => useNotifications(), { wrapper: NotificationsProvider });
    await waitFor(() => expect(result.current.unreadCount).toBe(125));
    let resolveNext!: (value: unknown) => void;
    mocks.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNext = resolve;
      })
    );
    mocks.user = { userId: 'account-2', role: 'ADMIN' };
    rerender();
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.isLoading).toBe(true);
    await act(async () => resolveNext({ data: { success: true, data: { notifications: [], unreadCount: 3 } } }));
    await waitFor(() => expect(result.current.unreadCount).toBe(3));
  });

  it.each(['USER', 'NUTRITIONIST', 'ADMIN'])('rings once for newly fetched unread updates for %s', async (role) => {
    mocks.user = { userId: 'account-1', role };
    mocks.get.mockResolvedValue(response([notification('old', 1)]));
    const { result } = renderHook(() => useNotifications(), { wrapper: NotificationsProvider });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(mocks.play).not.toHaveBeenCalled();
    mocks.get.mockResolvedValue(response([notification('new-a', 2), notification('new-b', 3), notification('old', 1)]));
    act(() => window.dispatchEvent(new Event(LIVE_UPDATE_EVENT)));
    await waitFor(() => expect(result.current.unreadCount).toBe(3));
    expect(mocks.play).toHaveBeenCalledOnce();
    await act(async () => result.current.refresh());
    await act(async () => result.current.markAllAsRead());
    expect(mocks.play).toHaveBeenCalledOnce();
  });

  it('remembers mute, unlocks on interaction and never replays muted notifications', async () => {
    mocks.user = { userId: 'account-1', role: 'USER' };
    localStorage.setItem(NOTIFICATION_SOUND_KEY, 'muted');
    mocks.get.mockResolvedValue(response([]));
    const { result } = renderHook(() => useNotifications(), { wrapper: NotificationsProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.soundEnabled).toBe(false);
    act(() => window.dispatchEvent(new Event('click')));
    expect(mocks.unlock).not.toHaveBeenCalled();
    mocks.get.mockResolvedValue(response([notification('muted', 1)]));
    await act(async () => result.current.refresh());
    expect(mocks.play).not.toHaveBeenCalled();
    act(() => result.current.toggleNotificationSound());
    expect(result.current.soundEnabled).toBe(true);
    expect(localStorage.getItem(NOTIFICATION_SOUND_KEY)).toBe('enabled');
    expect(mocks.unlock).toHaveBeenCalledOnce();
    await act(async () => result.current.refresh());
    expect(mocks.play).not.toHaveBeenCalled();
    mocks.get.mockResolvedValue(response([notification('next', 2)]));
    await act(async () => result.current.refresh());
    expect(mocks.play).toHaveBeenCalledOnce();
    act(() => result.current.toggleNotificationSound());
    expect(mocks.stop).toHaveBeenCalled();
    expect(localStorage.getItem(NOTIFICATION_SOUND_KEY)).toBe('muted');
  });

  it('does not ring on first successful load after a failure, in a hidden tab or after account switch', async () => {
    mocks.user = { userId: 'account-1', role: 'USER' };
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.get.mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = renderHook(() => useNotifications(), { wrapper: NotificationsProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mocks.get.mockResolvedValue(response([notification('old', 1)]));
    await act(async () => result.current.refresh());
    expect(mocks.play).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    mocks.get.mockResolvedValue(response([notification('hidden', 2)]));
    await act(async () => result.current.refresh());
    expect(mocks.play).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    mocks.user = { userId: 'account-2', role: 'ADMIN' };
    rerender();
    await waitFor(() => expect(result.current.notifications[0]?.id).toBe('hidden'));
    expect(mocks.play).not.toHaveBeenCalled();
    expect(mocks.dispose).toHaveBeenCalled();
    warning.mockRestore();
  });
});
