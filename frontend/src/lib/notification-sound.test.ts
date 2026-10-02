import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNotificationAudio, createNotificationTracker, NOTIFICATION_SOUND_URL } from './notification-sound';

const item = (id: string, second: number, isRead = false) => ({
  id,
  isRead,
  createdAt: new Date(1_000_000 + second * 1000).toISOString(),
});

describe('new notification detection', () => {
  it('silences the first load, count/read changes and repeated refreshes', () => {
    const observe = createNotificationTracker();
    expect(observe([item('old', 1)])).toBe(false);
    expect(observe([item('old', 1, true)])).toBe(false);
    expect(observe([item('old', 1), item('new', 2)])).toBe(true);
    expect(observe([item('old', 1), item('new', 2)])).toBe(false);
  });

  it('detects a new unread item after an empty baseline, including timestamp ties', () => {
    const observe = createNotificationTracker();
    expect(observe([])).toBe(false);
    expect(observe([item('first', 1)])).toBe(true);
    expect(observe([item('first', 1), item('second', 1)])).toBe(true);
  });

  it('does not ring for older backfilled, already-read or malformed items', () => {
    const observe = createNotificationTracker();
    observe([item('initial', 5)]);
    expect(observe([item('older', 1), item('read', 6, true)])).toBe(false);
    expect(observe([{ ...item('invalid', 10), createdAt: 'invalid' }])).toBe(false);
  });

  it('keeps a new session baseline separate and bounds remembered IDs', () => {
    const observe = createNotificationTracker();
    observe(Array.from({ length: 600 }, (_, n) => item(`old-${n}`, n)));
    expect(observe([item('old-0', 0)])).toBe(false);
    expect(observe([item('new', 601)])).toBe(true);
    expect(createNotificationTracker()([item('new', 601)])).toBe(false);
  });
});

describe('provided MP3 playback', () => {
  let contexts: FakeContext[];
  const fetchSound = vi.fn();
  class FakeContext {
    state = 'running';
    destination = {};
    sources: {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      onended?: () => void;
    }[] = [];
    resume = vi.fn(async () => {
      this.state = 'running';
    });
    close = vi.fn(async () => {
      this.state = 'closed';
    });
    decodeAudioData = vi.fn(async () => ({ duration: 1 }));
    createGain = vi.fn(() => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }));
    createBufferSource = vi.fn(() => {
      const source = {
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: undefined as (() => void) | undefined,
      };
      this.sources.push(source);
      return source;
    });
    constructor() {
      contexts.push(this);
    }
  }
  beforeEach(() => {
    contexts = [];
    vi.useFakeTimers();
    fetchSound.mockReset().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
    vi.stubGlobal('fetch', fetchSound);
    vi.stubGlobal('AudioContext', FakeContext);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('loads the supplied file once after interaction and limits overlapping/burst playback', async () => {
    const audio = createNotificationAudio();
    audio.play();
    expect(contexts).toHaveLength(0);
    expect(fetchSound).not.toHaveBeenCalled();
    audio.unlock();
    audio.unlock();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSound).toHaveBeenCalledOnce();
    expect(fetchSound).toHaveBeenCalledWith(
      NOTIFICATION_SOUND_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    audio.play();
    audio.play();
    expect(contexts[0].sources).toHaveLength(1);
    contexts[0].sources[0].onended?.();
    audio.play();
    expect(contexts[0].sources).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(3000);
    audio.play();
    expect(contexts[0].sources).toHaveLength(2);
    audio.dispose();
    expect(contexts[0].sources[1].stop).toHaveBeenCalledOnce();
    expect(contexts[0].close).toHaveBeenCalledOnce();
    audio.unlock();
    audio.play();
    expect(contexts).toHaveLength(1);
  });

  it('silently handles rejected autoplay, failed sound loading and unsupported audio', async () => {
    fetchSound.mockRejectedValueOnce(new Error('offline'));
    const audio = createNotificationAudio();
    audio.unlock();
    contexts[0].state = 'suspended';
    contexts[0].resume.mockRejectedValueOnce(new Error('blocked'));
    audio.unlock();
    await vi.advanceTimersByTimeAsync(0);
    expect(() => audio.play()).not.toThrow();
    expect(contexts[0].sources).toHaveLength(0);
    audio.dispose();
    vi.stubGlobal('AudioContext', undefined);
    const unsupported = createNotificationAudio();
    expect(() => {
      unsupported.unlock();
      unsupported.play();
      unsupported.dispose();
    }).not.toThrow();
  });
});
