import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GoogleSignInButton from './GoogleSignInButton';

const mocks = vi.hoisted(() => ({ login: vi.fn(), post: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ login: mocks.login }) }));
vi.mock('@/lib/axios', () => ({ default: { post: mocks.post } }));

let clickGoogle: () => void;
let credential: (response: { credential: string }) => void;
let clientNumber = 0;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', `fixture-${++clientNumber}`);
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 Chrome Desktop');
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn((config) => {
          credential = config.callback as typeof credential;
        }),
        renderButton: vi.fn((element, config) => {
          clickGoogle = config.click_listener as typeof clickGoogle;
          const button = document.createElement('button');
          button.textContent = 'Google fixture';
          button.onclick = clickGoogle;
          element.appendChild(button);
        }),
      },
    },
  };
  mocks.post.mockResolvedValue({ data: { success: true, data: { accessToken: 'fixture-token' } } });
  mocks.login.mockResolvedValue({ userId: 'fixture-user' });
});

afterEach(() => {
  delete window.google;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function renderGoogle(props = {}) {
  const result = render(<GoogleSignInButton {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  return result;
}

describe('Google sign-in browser recovery', () => {
  it('explains an unreachable sign-in service without blaming the Google identity', async () => {
    mocks.post.mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' });
    await renderGoogle();
    await act(async () => credential({ credential: 'fixture-id-token' }));
    expect(
      screen.getByText('We can’t reach the sign-in service. Check your connection and try again.')
    ).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('shows an embedded-browser notice without loading Google and preserves copy fallback', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone [FBAN/Messenger;FBAV/1]');
    await renderGoogle();
    expect(screen.getByRole('region', { name: 'Open in your browser' })).toBeInTheDocument();
    expect(window.google?.accounts.id.renderButton).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Copy the website address shown here');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Open in your browser' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'How to open in your browser' }));
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('offers cautious popup recovery after a click with no focus change', async () => {
    await renderGoogle();
    fireEvent.click(screen.getByRole('button', { name: 'Google fixture' }));
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('region', { name: 'Popup may be blocked' })).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('does not interrupt a popup that took focus', async () => {
    await renderGoogle();
    act(() => clickGoogle());
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    fireEvent(window, new Event('blur'));
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('does not interrupt mobile sign-in that switched apps', async () => {
    await renderGoogle();
    act(() => clickGoogle());
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('cancels recovery on success and uses unified continuation', async () => {
    await renderGoogle();
    act(() => clickGoogle());
    await act(async () => credential({ credential: 'fixture-id-token' }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledWith('/auth/google/continue', { idToken: 'fixture-id-token' });
    expect(mocks.login).toHaveBeenCalledWith('fixture-token');
  });

  it('uses the default Google button and offers email recovery for a protected account collision', async () => {
    mocks.post.mockRejectedValueOnce({
      response: { data: { errorCode: 'GOOGLE_LINK_REQUIRED', error: 'Use your original sign-in method.' } },
    });
    await renderGoogle();
    expect(window.google?.accounts.id.renderButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ click_listener: expect.any(Function) })
    );
    const configuration = vi.mocked(window.google!.accounts.id.renderButton).mock.calls[0][1];
    expect(configuration).not.toHaveProperty('text');
    expect(configuration).not.toHaveProperty('theme');
    expect(configuration).not.toHaveProperty('size');
    expect(configuration).not.toHaveProperty('width');
    expect(configuration).not.toHaveProperty('shape');
    expect(configuration).not.toHaveProperty('logo_alignment');
    await act(async () => credential({ credential: 'fixture-id-token' }));
    expect(screen.getByRole('link', { name: 'Sign in with email' })).toHaveAttribute('href', '/login');
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('preserves custom credential actions without permanent help text', async () => {
    const onCredential = vi.fn().mockResolvedValue(undefined);
    await renderGoogle({ onCredential });
    expect(screen.queryByRole('button', { name: 'Google window didn’t open?' })).not.toBeInTheDocument();
    await act(async () => credential({ credential: 'fixture-id-token' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(onCredential).toHaveBeenCalledWith('fixture-id-token');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('removes the recovery timer when navigating away', async () => {
    const result = await renderGoogle();
    act(() => clickGoogle());
    result.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
