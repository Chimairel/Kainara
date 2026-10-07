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

describe('Google provider layout handoff', () => {
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
