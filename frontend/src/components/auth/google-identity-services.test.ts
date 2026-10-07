import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete window.google;
});
afterEach(() => {
  document
    .querySelectorAll('script[src^="https://accounts.google.com/gsi/client"]')
    .forEach((script) => script.remove());
  delete window.google;
  vi.useRealTimers();
});

function installSDK() {
  window.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
}

describe('Google Identity Services script ownership', () => {
  it('shares one default SDK script and promise across concurrent consumers', async () => {
    const { loadGoogleIdentityServices, GOOGLE_SCRIPT_SRC } = await import('./google-identity-services');
    const first = loadGoogleIdentityServices();
    expect(loadGoogleIdentityServices()).toBe(first);
    const scripts = document.querySelectorAll(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    expect(scripts).toHaveLength(1);
    expect(GOOGLE_SCRIPT_SRC).toBe('https://accounts.google.com/gsi/client');
    installSDK();
    scripts[0].dispatchEvent(new Event('load'));
    await expect(first).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reuses an already loaded SDK without injecting a script', async () => {
    installSDK();
    const { loadGoogleIdentityServices } = await import('./google-identity-services');
    await expect(loadGoogleIdentityServices()).resolves.toBeUndefined();
    expect(document.querySelector('script[src^="https://accounts.google.com/gsi/client"]')).toBeNull();
  });

  it('joins an existing script in flight rather than appending another copy', async () => {
    const { loadGoogleIdentityServices, GOOGLE_SCRIPT_SRC } = await import('./google-identity-services');
    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    document.head.appendChild(script);
    const pending = loadGoogleIdentityServices();
    installSDK();
    script.dispatchEvent(new Event('load'));
    await expect(pending).resolves.toBeUndefined();
    expect(document.querySelectorAll(`script[src="${GOOGLE_SCRIPT_SRC}"]`)).toHaveLength(1);
  });

  it('rejects a load event that did not install the SDK', async () => {
    const { loadGoogleIdentityServices, GOOGLE_SCRIPT_SRC } = await import('./google-identity-services');
    const pending = loadGoogleIdentityServices();
    const rejected = expect(pending).rejects.toThrow('failed to load');
    document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)!.dispatchEvent(new Event('load'));
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries a failed script on the next attempt without keeping a rejected promise', async () => {
    const { loadGoogleIdentityServices, GOOGLE_SCRIPT_SRC } = await import('./google-identity-services');
    const first = loadGoogleIdentityServices();
    const rejected = expect(first).rejects.toThrow('failed to load');
    const oldScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)!;
    oldScript.dispatchEvent(new Event('error'));
    await rejected;
    const second = loadGoogleIdentityServices();
    const nextScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)!;
    expect(nextScript).not.toBe(oldScript);
    installSDK();
    nextScript.dispatchEvent(new Event('load'));
    await expect(second).resolves.toBeUndefined();
    expect(document.querySelectorAll(`script[src="${GOOGLE_SCRIPT_SRC}"]`)).toHaveLength(1);
  });

  it('ends a hung script load and cancels its timeout', async () => {
    const { loadGoogleIdentityServices } = await import('./google-identity-services');
    const pending = loadGoogleIdentityServices();
    const rejected = expect(pending).rejects.toThrow('failed to load');
    vi.advanceTimersByTime(15_000);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});
