import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MobileInstallPrompt from './MobileInstallPrompt';

const android = 'Mozilla/5.0 (Linux; Android 15) Chrome/130 Mobile Safari/537.36';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(android);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  delete (navigator as Navigator & { getInstalledRelatedApps?: unknown }).getInstalledRelatedApps;
});

function advance() {
  act(() => vi.advanceTimersByTime(1000));
}

describe('mobile install guidance', () => {
  it('dismisses for this visit and shows again after refresh when not installed', () => {
    const first = render(<MobileInstallPrompt />);
    advance();
    expect(screen.getByRole('region', { name: 'Install KAINARA' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
    expect(screen.getByText(/Install app.*Add to Home Screen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Install KAINARA' }));
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
    first.unmount();
    render(<MobileInstallPrompt />);
    advance();
    expect(screen.getByRole('region', { name: 'Install KAINARA' })).toBeInTheDocument();
    expect(localStorage.getItem('kainara-install-confirmed')).toBeNull();
  });

  it('shows iPhone Share-menu instructions', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 iPhone Safari');
    render(<MobileInstallPrompt />);
    advance();
    expect(screen.getByText(/In Safari, open the Share menu/)).toBeInTheDocument();
  });

  it.each(['Mozilla/5.0 Chrome Desktop', `${android} [FBAN/Messenger;FBAV/1]`])('does not prompt in %s', (ua) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
    render(<MobileInstallPrompt />);
    advance();
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
  });

  it('does not prompt inside the installed app', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    render(<MobileInstallPrompt />);
    advance();
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
  });

  it('waits for other dialogs to close', async () => {
    const blocker = document.createElement('div');
    blocker.setAttribute('role', 'dialog');
    document.body.appendChild(blocker);
    render(<MobileInstallPrompt />);
    advance();
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
    blocker.remove();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('region', { name: 'Install KAINARA' })).toBeInTheDocument();
  });

  it('uses the native prompt once, only after the user clicks Install', async () => {
    render(<MobileInstallPrompt />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    advance();
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
  });

  it('recovers from native prompt failure with manual instructions', async () => {
    render(<MobileInstallPrompt />);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn().mockRejectedValue(new Error('fixture failure')),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    advance();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('The install prompt could not open');
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
  });

  it('closes when installation completes outside our card', () => {
    render(<MobileInstallPrompt />);
    advance();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
  });

  it('waits while a Google popup or another window has focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    render(<MobileInstallPrompt />);
    advance();
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    fireEvent(window, new Event('focus'));
    expect(screen.getByRole('region', { name: 'Install KAINARA' })).toBeInTheDocument();
  });

  it('remembers explicit installation confirmation across reloads', () => {
    const first = render(<MobileInstallPrompt />);
    advance();
    fireEvent.click(screen.getByRole('button', { name: 'Already installed' }));
    first.unmount();
    render(<MobileInstallPrompt />);
    advance();
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
  });

  it('checks an installed related web app from a browser visit', async () => {
    const query = vi.fn().mockResolvedValue([{ platform: 'webapp', url: `${location.origin}/manifest.json` }]);
    Object.defineProperty(navigator, 'getInstalledRelatedApps', { value: query, configurable: true });
    render(<MobileInstallPrompt />);
    await act(async () => {
      await Promise.resolve();
    });
    advance();
    expect(query).toHaveBeenCalledOnce();
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
  });

  it('clears a stale installation hint when browser detection finds no app', async () => {
    localStorage.setItem('kainara-install-confirmed', 'true');
    Object.defineProperty(navigator, 'getInstalledRelatedApps', {
      value: vi.fn().mockResolvedValue([]),
      configurable: true,
    });
    render(<MobileInstallPrompt />);
    await act(async () => {
      await Promise.resolve();
    });
    advance();
    expect(screen.getByRole('region', { name: 'Install KAINARA' })).toBeInTheDocument();
  });

  it('uses manual guidance when installed-app detection fails', async () => {
    Object.defineProperty(navigator, 'getInstalledRelatedApps', {
      value: vi.fn().mockRejectedValue(new Error('unsupported')),
      configurable: true,
    });
    render(<MobileInstallPrompt />);
    await act(async () => {
      await Promise.resolve();
    });
    advance();
    expect(screen.getByRole('region', { name: 'Install KAINARA' })).toBeInTheDocument();
  });

  it('dismisses on a sideways swipe without treating vertical scrolling as dismissal', () => {
    render(<MobileInstallPrompt />);
    advance();
    const card = screen.getByRole('region', { name: 'Install KAINARA' });
    fireEvent.touchStart(card, { touches: [{ clientX: 20, clientY: 20 }] });
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 30, clientY: 120 }] });
    expect(card).toBeInTheDocument();
    fireEvent.touchStart(card, { touches: [{ clientX: 20, clientY: 20 }] });
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 120, clientY: 25 }] });
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
  });

  it('does not let a late installation query undo the user’s confirmation', async () => {
    let finish!: (apps: { platform: string; url: string }[]) => void;
    Object.defineProperty(navigator, 'getInstalledRelatedApps', {
      value: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      configurable: true,
    });
    render(<MobileInstallPrompt />);
    advance();
    fireEvent.click(screen.getByRole('button', { name: 'Already installed' }));
    await act(async () => {
      finish([]);
    });
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
    expect(localStorage.getItem('kainara-install-confirmed')).toBe('true');
  });

  it('retains a fresh native install offer when an older installed-app query finishes', async () => {
    let finish!: (apps: { platform: string; url: string }[]) => void;
    Object.defineProperty(navigator, 'getInstalledRelatedApps', {
      value: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      configurable: true,
    });
    render(<MobileInstallPrompt />);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    await act(async () => {
      finish([{ platform: 'webapp', url: `${location.origin}/manifest.json` }]);
    });
    advance();
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
  });

  it('hides the install card while a sign-in notice is present', async () => {
    render(<MobileInstallPrompt />);
    advance();
    const notice = document.createElement('aside');
    notice.dataset.floatingNotice = 'auth';
    await act(async () => {
      document.body.appendChild(notice);
    });
    expect(screen.queryByRole('region', { name: 'Install KAINARA' })).not.toBeInTheDocument();
    await act(async () => {
      notice.remove();
    });
    expect(screen.getByRole('region', { name: 'Install KAINARA' })).toBeInTheDocument();
  });
});
