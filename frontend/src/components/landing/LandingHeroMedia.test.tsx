import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import LandingHeroMedia from './LandingHeroMedia';

vi.mock('@/lib/axios', () => ({ getApiBaseUrl: () => '/api' }));
it('loads public media without sending account credentials', async () => {
  const fetch = vi.fn().mockResolvedValue({
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
  });
  vi.stubGlobal('fetch', fetch);
  render(<LandingHeroMedia />);
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
