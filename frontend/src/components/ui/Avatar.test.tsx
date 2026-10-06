import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Avatar from './Avatar';

describe('Avatar', () => {
  const imageLoadTimers = new Set<ReturnType<typeof setTimeout>>();

  beforeEach(() => {
    vi.spyOn(window.Image.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
      // Capture the image's own DOM realm before a worker can dispose this environment.
      const loadEvent = new this.ownerDocument.defaultView!.Event('load');
      const timer = setTimeout(() => {
        imageLoadTimers.delete(timer);
        this.dispatchEvent(loadEvent);
      }, 10);
      imageLoadTimers.add(timer);
    });
  });

  afterEach(() => {
    for (const timer of imageLoadTimers) clearTimeout(timer);
    imageLoadTimers.clear();
    vi.restoreAllMocks();
  });

  it('renders clean rounded avatar without salakot hat overlay', () => {
    const { container } = render(<Avatar fallbackText="Juan Dela Cruz" />);

    const salakotImg = container.querySelector('img[src="/icons/salakot.svg"]');
    expect(salakotImg).not.toBeInTheDocument();
  });

  it('renders fallback initials when src is "default" or null', () => {
    render(<Avatar src="default" fallbackText="Pacaldo Chimairel" />);

    expect(screen.getByText('PC')).toBeInTheDocument();
  });

  it('renders DiceBear open-peeps URL when given a Filipino name preset seed', async () => {
    const { container } = render(<Avatar src="Bedic" fallbackText="Bedic Pacaldo" />);

    await waitFor(() => {
      const img = container.querySelector('img[src*="seed=Bedic"]');
      expect(img).toBeInTheDocument();
      expect(img?.getAttribute('src')).toContain('dicebear.com/10.x/open-peeps/svg');
    });
  });

  it('renders custom configured URL for Chimay preset', async () => {
    const { container } = render(<Avatar src="Chimay" fallbackText="Chimay Pacaldo" />);

    await waitFor(() => {
      const img = container.querySelector('img[src*="headVariant=dreads2"]');
      expect(img).toBeInTheDocument();
    });
  });

  it('renders external image directly when given an http/https URL', async () => {
    const googlePhoto = 'https://lh3.googleusercontent.com/a/test-profile-photo';
    const { container } = render(<Avatar src={googlePhoto} fallbackText="Google User" />);

    await waitFor(() => {
      const img = container.querySelector('img[src="' + googlePhoto + '"]');
      expect(img).toBeInTheDocument();
    });
  });
});
