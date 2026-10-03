import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LandingMediaDisplay from './LandingMediaDisplay';

const video = {
  kind: 'video' as const,
  url: 'https://res.cloudinary.com/test/video/upload/promo.mp4',
  posterUrl: 'https://res.cloudinary.com/test/image/upload/poster.jpg',
  altText: 'Ten-second KAINARA promotion',
};
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  let paused = true;
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => paused);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => {
    paused = false;
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {
    paused = true;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('keeps the original screenshot when no media is published', () => {
  render(<LandingMediaDisplay media={null} />);
  expect(screen.getByRole('img')).toHaveAttribute('src', '/dashboard-actual.png');
});
it('shows muted inline video, provides playback/sound controls and falls back to its poster on error', async () => {
  const { container } = render(<LandingMediaDisplay media={video} />);
  const element = container.querySelector('video')!;
  expect(element.muted).toBe(true);
  expect(element).toHaveAttribute('playsinline');
  expect(element).toHaveAttribute('preload', 'none');
  fireEvent.click(screen.getByRole('button', { name: 'Play promotional video' }));
  await waitFor(() => expect(element.play).toHaveBeenCalled());
  fireEvent.play(element);
  fireEvent.click(screen.getByRole('button', { name: 'Pause promotional video' }));
  expect(element.pause).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Enable video sound' }));
  expect(element.muted).toBe(false);
  fireEvent.error(element);
  expect(screen.getByRole('img')).toHaveAttribute('src', video.posterUrl);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img')).toHaveAttribute('src', '/dashboard-actual.png');
});
it('does not autoplay when reduced motion is requested', () => {
  vi.mocked(window.matchMedia).mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  let intersect!: IntersectionObserverCallback;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback;
      }
      observe() {}
      disconnect() {}
    }
  );
  const { container } = render(<LandingMediaDisplay media={video} />);
  intersect([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], {} as IntersectionObserver);
  expect(container.querySelector('video')!.play).not.toHaveBeenCalled();
});
