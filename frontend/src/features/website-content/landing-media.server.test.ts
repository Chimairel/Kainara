import { afterEach, expect, it, vi } from 'vitest';
import { getPublishedLandingMedia } from './landing-media.server';
const media = {
  kind: 'video',
  url: 'https://res.cloudinary.com/test/video/upload/promo.mp4',
  posterUrl: 'https://res.cloudinary.com/test/video/upload/so_1/promo.jpg',
  altText: 'Promotion',
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it.each([
  ['http://internal.example', '/api', 'http://internal.example/api'],
  ['', 'https://api.example/api', 'https://api.example/api'],
  ['', '/api', 'http://127.0.0.1:5000/api'],
])('uses the server API address and reads fresh public metadata only', async (internal, configured, expected) => {
  vi.stubEnv('INTERNAL_API_URL', internal);
  vi.stubEnv('NEXT_PUBLIC_API_URL', configured);
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: media }) });
  vi.stubGlobal('fetch', fetch);
  expect(await getPublishedLandingMedia()).toEqual(media);
  expect(fetch).toHaveBeenCalledWith(`${expected}/public/landing-media`, {
    cache: 'no-store',
    credentials: 'omit',
    signal: expect.any(AbortSignal),
  });
});
it.each([null, { ...media, url: 'https://untrusted.example/video.mp4' }, { invalid: true }])(
  'handles no publication and malformed metadata without breaking the page',
  async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data }) }));
    expect(await getPublishedLandingMedia()).toBeNull();
  }
);
it('falls back if the backend is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  expect(await getPublishedLandingMedia()).toBeNull();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unavailable')));
  expect(await getPublishedLandingMedia()).toBeNull();
});
it('bounds the initial settings request to five seconds', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  await getPublishedLandingMedia();
  expect(timeout).toHaveBeenCalledWith(5000);
  timeout.mockRestore();
});
