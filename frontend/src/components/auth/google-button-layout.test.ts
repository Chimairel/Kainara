import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeGoogleButtonLayout } from './google-button-layout';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function provider() {
  const host = document.createElement('div');
  const iframe = document.createElement('iframe');
  host.appendChild(iframe);
  let hostHeight = 40;
  let frameHeight = 0;
  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        top: 0,
        bottom: hostHeight,
        height: hostHeight,
      }) as DOMRect
  );
  vi.spyOn(iframe, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        top: hostHeight - frameHeight,
        bottom: hostHeight,
        height: frameHeight,
        width: frameHeight ? 300 : 0,
      }) as DOMRect
  );
  const change = async (height: number, embedded: number) => {
    hostHeight = height;
    frameHeight = embedded;
    iframe.setAttribute('height', String(embedded));
    await Promise.resolve();
    vi.advanceTimersByTime(50);
  };
  return { host, change, load: () => iframe.dispatchEvent(new Event('load')) };
}

function standardButton(host: HTMLElement) {
  const button = document.createElement('div');
  button.setAttribute('role', 'button');
  button.textContent = 'Continue with Google';
  host.prepend(button);
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 40,
    width: 300,
    height: 40,
  } as DOMRect);
}

describe('Google provider layout handoff', () => {
  it('keeps the standard button hidden while a loaded frame completes its handoff', async () => {
    const fixture = provider();
    standardButton(fixture.host);
    const ready = vi.fn();
    const unavailable = vi.fn();
    observeGoogleButtonLayout(fixture.host, ready, unavailable);
    fixture.load();
    vi.advanceTimersByTime(50);
    expect(ready).not.toHaveBeenCalled();
    await fixture.change(84, 44);
    vi.advanceTimersByTime(500);
    expect(ready).not.toHaveBeenCalled();
    await fixture.change(44, 44);
    expect(ready).toHaveBeenCalledOnce();
    expect(unavailable).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reveals the standard SDK button when the frame finishes with zero dimensions', () => {
    const fixture = provider();
    standardButton(fixture.host);
    const ready = vi.fn();
    const unavailable = vi.fn();
    observeGoogleButtonLayout(fixture.host, ready, unavailable);
    fixture.load();
    vi.advanceTimersByTime(50);
    expect(ready).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(ready).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10000);
    expect(unavailable).not.toHaveBeenCalled();
  });

  it('preserves a usable standard button if the embedded frame never reports load', () => {
    const fixture = provider();
    standardButton(fixture.host);
    const ready = vi.fn();
    const unavailable = vi.fn();
    observeGoogleButtonLayout(fixture.host, ready, unavailable);
    vi.advanceTimersByTime(10000);
    expect(ready).toHaveBeenCalledOnce();
    expect(unavailable).not.toHaveBeenCalled();
  });

  it('waits through an empty frame and stacked temporary button before revealing the final frame', async () => {
    const fixture = provider();
    const ready = vi.fn();
    const unavailable = vi.fn();
    observeGoogleButtonLayout(fixture.host, ready, unavailable);
    vi.advanceTimersByTime(50);
    expect(ready).not.toHaveBeenCalled();
    await fixture.change(84, 44);
    expect(ready).not.toHaveBeenCalled();
    await fixture.change(44, 44);
    expect(ready).not.toHaveBeenCalled();
    fixture.load();
    vi.advanceTimersByTime(50);
    expect(ready).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10000);
    expect(unavailable).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ends an unsuccessful provider load with recoverable feedback', () => {
    const fixture = provider();
    const ready = vi.fn();
    const unavailable = vi.fn();
    observeGoogleButtonLayout(fixture.host, ready, unavailable);
    vi.advanceTimersByTime(10000);
    expect(ready).not.toHaveBeenCalled();
    expect(unavailable).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels callbacks and timers when the page unmounts', async () => {
    const fixture = provider();
    const ready = vi.fn();
    const unavailable = vi.fn();
    const stop = observeGoogleButtonLayout(fixture.host, ready, unavailable);
    stop();
    await fixture.change(44, 44);
    vi.advanceTimersByTime(10000);
    expect(ready).not.toHaveBeenCalled();
    expect(unavailable).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
