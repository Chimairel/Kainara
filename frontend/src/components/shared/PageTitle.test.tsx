import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsProvider, useNotifications } from '@/hooks/useNotifications';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import PageTitle from './PageTitle';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  user: { userId: 'account-1', role: 'USER' } as { userId: string; role: string } | null,
  get: vi.fn(),
  patch: vi.fn(),
}));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, patch: mocks.patch } }));

function BellConsumer() {
  const { unreadCount, markAllAsRead, markAsRead } = useNotifications();
  return (
    <>
      <output>{unreadCount}</output>
      <button onClick={() => void markAllAsRead()}>Read all</button>
      <button onClick={() => void markAsRead('notice-1')}>Read one</button>
    </>
  );
}
function App() {
  return (
    <NotificationsProvider>
      <PageTitle />
      <BellConsumer />
    </NotificationsProvider>
  );
}
const inbox = (unreadCount: number, isRead = false) => ({
  data: { success: true, data: { unreadCount, notifications: [{ id: 'notice-1', isRead }] } },
});

describe('browser tab title and shared inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = '/';
    mocks.user = { userId: 'account-1', role: 'USER' };
    mocks.get.mockResolvedValue(inbox(3));
    mocks.patch.mockResolvedValue({ data: { success: true } });
    document.title = 'Old title';
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('shares one request with the bell and removes the count when all are read', async () => {
    render(<App />);
    await waitFor(() => expect(document.title).toBe('(3) Kainara'));
    expect(screen.getByRole('status').textContent).toBe('3');
    expect(mocks.get).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Read all'));
    await waitFor(() => expect(document.title).toBe('Kainara'));
    expect(screen.getByRole('status').textContent).toBe('0');
  });

  it.each(['USER', 'NUTRITIONIST', 'ADMIN'])('updates a standalone page title on live signals for %s', async (role) => {
    mocks.user = { userId: 'account-1', role };
    mocks.pathname = '/login';
    const view = render(<App />);
    await waitFor(() => expect(document.title).toBe('(3) Account access'));
    mocks.get.mockResolvedValue(inbox(12));
    act(() => window.dispatchEvent(new Event(LIVE_UPDATE_EVENT)));
    await waitFor(() => expect(document.title).toBe('(12) Account access'));
    mocks.pathname = '/grocery';
    view.rerender(<App />);
    await waitFor(() => expect(document.title).toBe('(12) Groceries'));
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it('retains the count after delayed Next metadata changes and cleans up on unmount', async () => {
    const view = render(<App />);
    await waitFor(() => expect(document.title).toBe('(3) Kainara'));
    document.title = 'KAINARA | AI Nutrition';
    await waitFor(() => expect(document.title).toBe('(3) Kainara'));
    view.unmount();
    document.title = 'Another app';
    await act(async () => Promise.resolve());
    expect(document.title).toBe('Another app');
  });

  it('clears the previous account count immediately on logout', async () => {
    const view = render(<App />);
    await waitFor(() => expect(document.title).toBe('(3) Kainara'));
    mocks.user = null;
    view.rerender(<App />);
    await waitFor(() => expect(document.title).toBe('Kainara'));
  });

  it('does not subtract an already read notification again', async () => {
    render(<App />);
    await waitFor(() => expect(document.title).toBe('(3) Kainara'));
    fireEvent.click(screen.getByText('Read one'));
    await waitFor(() => expect(document.title).toBe('(2) Kainara'));
    fireEvent.click(screen.getByText('Read one'));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(2));
    expect(document.title).toBe('(2) Kainara');
  });
});
