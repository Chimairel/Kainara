import { expect, it, vi } from 'vitest';
import Home from './page';
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/features/website-content/landing-media.server', () => ({ getPublishedLandingMedia: mocks.read }));
vi.mock('@/components/landing/LandingHome', () => ({ default: () => null }));
it('passes the current published poster to the initial landing response', async () => {
  const media = {
    kind: 'video',
    url: 'https://res.cloudinary.com/test/video/upload/promo.mp4',
    posterUrl: 'https://res.cloudinary.com/test/video/upload/so_1/promo.jpg',
    altText: 'Promo',
  };
  mocks.read.mockResolvedValue(media);
  const page = await Home();
  expect(page.props.initialMedia).toEqual(media);
  expect(mocks.read).toHaveBeenCalledOnce();
});
