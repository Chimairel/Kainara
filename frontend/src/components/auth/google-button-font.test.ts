import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
let load: ReturnType<typeof vi.fn>;
let add: ReturnType<typeof vi.fn>;
let faces: { family: string; source: string; descriptors: FontFaceDescriptors }[];

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  load = vi.fn().mockResolvedValue(undefined);
  add = vi.fn();
  faces = [];
  Object.defineProperty(document, 'fonts', { configurable: true, value: { add } });
  vi.stubGlobal(
    'FontFace',
    class {
      constructor(family: string, source: string, descriptors: FontFaceDescriptors) {
        faces.push({ family, source, descriptors });
      }
      load() {
        return load();
      }
    }
  );
});

afterEach(() => {
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else Reflect.deleteProperty(document, 'fonts');
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Google button font preparation', () => {
  it('shares one download and registers the provider face only when ready', async () => {
    let release!: () => void;
    load.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      })
    );
    const { loadGoogleButtonFont } = await import('./google-button-font');
    const pending = loadGoogleButtonFont();
    expect(loadGoogleButtonFont()).toBe(pending);
    expect(faces).toHaveLength(1);
    expect(faces[0].family).toBe('Google Sans');
    expect(add).not.toHaveBeenCalled();
    release();
    await pending;
    expect(add).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reuses its registered face on later visits', async () => {
    const { loadGoogleButtonFont } = await import('./google-button-font');
    await loadGoogleButtonFont();
    await loadGoogleButtonFont();
    expect(load).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('does not register a rejected download and allows a later retry', async () => {
    load.mockRejectedValueOnce(new Error('CDN blocked'));
    const { loadGoogleButtonFont } = await import('./google-button-font');
    await expect(loadGoogleButtonFont()).rejects.toThrow('font could not load');
    expect(add).not.toHaveBeenCalled();
    await loadGoogleButtonFont();
    expect(load).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a hung download and never registers its face after the timeout', async () => {
    let release!: () => void;
    load.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      })
    );
    const { loadGoogleButtonFont } = await import('./google-button-font');
    const pending = loadGoogleButtonFont();
    const rejected = expect(pending).rejects.toThrow('font could not load');
    vi.advanceTimersByTime(5000);
    await rejected;
    release();
    await Promise.resolve();
    expect(add).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps unsupported environments on the standard SDK fallback', async () => {
    vi.stubGlobal('FontFace', undefined);
    const { loadGoogleButtonFont } = await import('./google-button-font');
    await expect(loadGoogleButtonFont()).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it('does not require FontFaceSet in unsupported environments', async () => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
    const { loadGoogleButtonFont } = await import('./google-button-font');
    await expect(loadGoogleButtonFont()).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });
});
