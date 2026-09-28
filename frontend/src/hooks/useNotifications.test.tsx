import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotifications } from './useNotifications';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), patch: vi.fn(),
  user: { userId: 'account-1', role: 'USER' } as { userId: string; role: string } | null,
}));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, patch: mocks.patch } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));

describe('shared notification inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ data: { success: true, data: { notifications: [], unreadCount: 125 } } });
    mocks.patch.mockResolvedValue({ data: { success: true } });
  });

  it.each(['USER', 'NUTRITIONIST', 'ADMIN'])('loads the same account-scoped inbox for %s', async (role) => {
    mocks.user = { userId: 'account-1', role };
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(125));
    expect(mocks.get).toHaveBeenCalledWith('/notifications');
  });

  it('clears the entire unread inbox with one request, beyond the first 50 displayed items', async () => {
    mocks.user = { userId: 'account-1', role: 'NUTRITIONIST' };
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(125));
    await act(async () => result.current.markAllAsRead());
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(mocks.patch).toHaveBeenCalledWith('/notifications/read-all');
    expect(result.current.unreadCount).toBe(0);
  });

  it('does not request notifications without an account', async () => {
    mocks.user = null;
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('does not show one account’s inbox after switching to another account', async () => {
    mocks.user = { userId: 'account-1', role: 'USER' };
    const { result, rerender } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(125));
    let resolveNext!: (value: unknown) => void;
    mocks.get.mockReturnValueOnce(new Promise((resolve) => { resolveNext = resolve; }));
    mocks.user = { userId: 'account-2', role: 'ADMIN' };
    rerender();
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.isLoading).toBe(true);
    await act(async () => resolveNext({ data: { success: true, data: { notifications: [], unreadCount: 3 } } }));
    await waitFor(() => expect(result.current.unreadCount).toBe(3));
  });
});
