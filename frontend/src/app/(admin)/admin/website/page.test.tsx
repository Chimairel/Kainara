import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import WebsiteContentPage from './page';
import type { WebsiteContent, LandingGalleryItem } from '@/features/website-content/types';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  loading: vi.fn(() => 'media-toast'),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, post: mocks.post, patch: mocks.patch } }));
vi.mock('sonner', () => ({ toast: { loading: mocks.loading, success: mocks.success, error: mocks.error } }));
vi.mock('@/components/landing/LandingMediaDisplay', () => ({
  default: ({ media }: { media: { kind: string } | null }) => (
    <div>{media ? `${media.kind} preview` : 'Original screenshot'}</div>
  ),
}));
const savedImage: LandingGalleryItem = {
  publicId: 'nutrimind/landing/saved-image',
  kind: 'image',
  url: 'https://res.cloudinary.com/test/image/upload/saved-image.jpg',
  bytes: 1000,
  duration: null,
  createdAt: null,
  posterUrl: null,
};
const savedVideo: LandingGalleryItem = {
  ...savedImage,
  publicId: 'nutrimind/landing/saved-video',
  kind: 'video',
  url: 'https://res.cloudinary.com/test/video/upload/saved-video.mp4',
  duration: 10,
  posterUrl: 'https://res.cloudinary.com/test/video/upload/so_1/saved-video.jpg',
};
let galleryItems: LandingGalleryItem[];
let content: WebsiteContent;
beforeEach(() => {
  vi.clearAllMocks();
  const OriginalURL = URL;
  vi.stubGlobal(
    'URL',
    class extends OriginalURL {
      static createObjectURL = vi.fn(() => 'blob:preview');
      static revokeObjectURL = vi.fn();
    }
  );
  galleryItems = [];
  content = { revision: 0, draft: null, published: null, publishedAt: null };
  mocks.get.mockImplementation(async (url) => ({
    data: { data: url.endsWith('/gallery') ? { items: galleryItems, nextCursor: null } : structuredClone(content) },
  }));
  mocks.patch.mockImplementation(async (_url, body) => {
    expect(body.revision).toBe(content.revision);
    content.draft!.altText = body.altText;
    content.revision++;
    return { data: { data: structuredClone(content) } };
  });
  mocks.post.mockImplementation(async (url, body) => {
    if (url.endsWith('/select')) {
      expect(body.revision).toBe(content.revision);
      const chosen = galleryItems.find((item) => item.publicId === body.publicId)!;
      const draft = content.draft ?? { asset: null, poster: null, altText: 'KAINARA platform preview' };
      content.draft = {
        ...draft,
        [body.slot]: chosen,
        posterUrl: body.slot === 'poster' ? chosen.url : (draft.poster?.url ?? chosen.posterUrl),
      };
    } else if (url.endsWith('/upload')) {
      expect(body.get('revision')).toBe(String(content.revision));
      expect(body.get('slot')).toBe('asset');
      content.draft = {
        asset: {
          kind: 'image',
          url: 'https://res.cloudinary.com/test/image/upload/promo.jpg',
          bytes: 1000,
          duration: null,
        },
        poster: null,
        altText: 'KAINARA platform preview',
      };
    } else {
      expect(body.revision).toBe(content.revision);
      if (url.endsWith('/publish')) {
        content.published = structuredClone(content.draft);
        content.publishedAt = '2026-10-04T03:00:00Z';
      } else {
        content.draft = null;
        content.published = null;
        content.publishedAt = null;
      }
    }
    content.revision++;
    return { data: { data: structuredClone(content) } };
  });
});
afterEach(() => vi.unstubAllGlobals());
it('previews a selected file, saves a draft without publishing, and requires an explicit publish', async () => {
  render(<WebsiteContentPage />);
  await screen.findByRole('button', { name: 'Save draft' });
  expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Image or video'), {
    target: { files: [new File(['synthetic'], 'promo.jpg', { type: 'image/jpeg' })] },
  });
  await screen.findByText('image preview');
  expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Media description'), { target: { value: 'Our promotional preview' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled());
  expect(content.published).toBeNull();
  expect(mocks.post).not.toHaveBeenCalledWith('/admin/website-content/publish', expect.anything());
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
  await waitFor(() =>
    expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('published'), expect.anything())
  );
  expect(content.published!.altText).toBe('Our promotional preview');
  fireEvent.click(screen.getByRole('button', { name: 'Restore original' }));
  await waitFor(() => expect(content.published).toBeNull());
  await waitFor(() => expect(screen.getAllByText('Original screenshot')).toHaveLength(2));
});
it('keeps publish unavailable after a failed upload and shows a clear toast', async () => {
  mocks.post.mockRejectedValueOnce(new Error('Upload failed'));
  render(<WebsiteContentPage />);
  await screen.findByRole('button', { name: 'Save draft' });
  fireEvent.change(screen.getByLabelText('Image or video'), {
    target: { files: [new File(['synthetic'], 'promo.jpg', { type: 'image/jpeg' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalled());
  expect(content.published).toBeNull();
  expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
});

it('reuses saved media and posters without upload, keeps description edits and waits for Publish', async () => {
  galleryItems = [savedVideo, savedImage];
  render(<WebsiteContentPage />);
  await screen.findByRole('button', { name: 'Save draft' });
  await screen.findAllByRole('button', { name: 'Use as display' });
  fireEvent.change(screen.getByLabelText('Media description'), { target: { value: 'Keep this description' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Use as display' })[0]);
  await waitFor(() => expect(content.draft?.asset?.kind).toBe('video'));
  expect(content.published).toBeNull();
  expect(screen.getByLabelText('Media description')).toHaveValue('Keep this description');
  expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Use as poster' }));
  await waitFor(() => expect(content.draft?.poster?.url).toBe(savedImage.url));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
  await waitFor(() => expect(content.published?.asset?.url).toBe(savedVideo.url));
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Use as display' })[1]).toBeEnabled());
  fireEvent.click(screen.getAllByRole('button', { name: 'Use as display' })[1]);
  await waitFor(() => expect(content.draft?.asset?.url).toBe(savedImage.url));
  expect(content.published?.asset?.url).toBe(savedVideo.url);
  expect(mocks.post.mock.calls.some(([url]) => url.endsWith('/upload'))).toBe(false);
});
it('failed gallery selection retains the published media and shows Sonner feedback', async () => {
  galleryItems = [savedImage];
  render(<WebsiteContentPage />);
  await screen.findByRole('button', { name: 'Use as display' });
  mocks.post.mockRejectedValueOnce(new Error('Saved file unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Use as display' }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalled());
  expect(content.draft).toBeNull();
  expect(content.revision).toBe(0);
  expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
});
