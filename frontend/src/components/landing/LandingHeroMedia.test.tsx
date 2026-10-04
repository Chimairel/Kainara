import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LandingHeroMedia from './LandingHeroMedia';

vi.mock('@/lib/axios', () => ({ getApiBaseUrl: () => '/api' }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('shows neutral loading until public media arrives, without account credentials or an old-image flash', async () => {
  let release!: () => void;
  const response = {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        kind: 'image',
        url: 'https://res.cloudinary.com/test/image/upload/promo.jpg',
        posterUrl: null,
        altText: 'Published promo',
      },
    }),
  };
  const fetch = vi.fn(
    () =>
      new Promise((resolve) => {
        release = () => resolve(response);
      })
  );
  vi.stubGlobal('fetch', fetch);
  render(<LandingHeroMedia />);
  expect(screen.getByRole('status', { name: 'Loading website media' })).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  release();
  await waitFor(() =>
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://res.cloudinary.com/test/image/upload/promo.jpg')
  );
  expect(fetch).toHaveBeenCalledWith(
    '/api/public/landing-media',
    expect.objectContaining({ credentials: 'omit', cache: 'no-store' })
  );
});
it('keeps the screenshot if the settings request fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unavailable')));
  render(<LandingHeroMedia />);
  await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', '/dashboard-actual.png'));
});

it('shows the original screenshot when the loaded settings have no publication', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: null }) }));
  render(<LandingHeroMedia />);
  await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', '/dashboard-actual.png'));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('leaves loading and shows the fallback after the bounded request timeout', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    )
  );
  render(<LandingHeroMedia />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(screen.getByRole('img')).toHaveAttribute('src', '/dashboard-actual.png');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
