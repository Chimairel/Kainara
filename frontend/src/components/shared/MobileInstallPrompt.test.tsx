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
});

function advance() {
  act(() => vi.advanceTimersByTime(8000));
}

describe('mobile install guidance', () => {
  it('shows Android instructions and remembers dismissal across visits', () => {
    const first = render(<MobileInstallPrompt />);
    advance();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install KAINARA' })).not.toBeInTheDocument();
    expect(screen.getByText(/Install app.*Add to Home Screen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    first.unmount();
    render(<MobileInstallPrompt />);
    advance();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not prompt inside the installed app', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    render(<MobileInstallPrompt />);
    advance();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits for other dialogs to close', () => {
    const blocker = document.createElement('div');
    blocker.setAttribute('role', 'dialog');
    document.body.appendChild(blocker);
    render(<MobileInstallPrompt />);
    advance();
    expect(screen.queryByText('Add KAINARA to your Home Screen')).not.toBeInTheDocument();
    blocker.remove();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('dialog', { name: 'Add KAINARA to your Home Screen' })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Install KAINARA' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Install KAINARA' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('The install prompt could not open');
    expect(screen.queryByRole('button', { name: 'Install KAINARA' })).not.toBeInTheDocument();
  });

  it('closes when installation completes outside our dialog', () => {
    render(<MobileInstallPrompt />);
    advance();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits while a Google popup or another window has focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    render(<MobileInstallPrompt />);
    advance();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
