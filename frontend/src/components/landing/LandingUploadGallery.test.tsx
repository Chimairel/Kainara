import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import LandingUploadGallery from './LandingUploadGallery';
import type { LandingGalleryItem } from '@/features/website-content/types';
const get = vi.hoisted(() => vi.fn());
vi.mock('@/lib/axios', () => ({ default: { get } }));
const image: LandingGalleryItem = {
  kind: 'image',
  publicId: 'nutrimind/landing/first',
  url: 'https://res.cloudinary.com/test/image/upload/first.jpg',
  bytes: 1000,
  duration: null,
  createdAt: null,
  posterUrl: null,
};
const video: LandingGalleryItem = {
  ...image,
  kind: 'video',
  publicId: 'nutrimind/landing/second',
  url: 'https://res.cloudinary.com/test/video/upload/second.mp4',
  duration: 10,
  posterUrl: 'https://res.cloudinary.com/test/video/upload/so_1/second.jpg',
};
beforeEach(() => {
  get.mockReset();
});
it('paginates and deduplicates uploads; only images offer poster selection', async () => {
  get
    .mockResolvedValueOnce({ data: { data: { items: [image], nextCursor: 'page-two' } } })
    .mockResolvedValueOnce({ data: { data: { items: [image, video], nextCursor: null } } });
  const select = vi.fn(async () => {});
  render(
    <LandingUploadGallery
      refreshVersion={0}
      busy={false}
      draftId={image.publicId}
      publishedId={video.publicId}
      onSelect={select}
    />
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Load more uploads' }));
  await screen.findByRole('article', { name: 'Video second' });
  expect(get.mock.calls[1][1]).toEqual({ params: { cursor: 'page-two' } });
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getByText('Video \u00b7 10s')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Use as poster' })).toHaveLength(1);
  expect(screen.getByText('In draft')).toBeInTheDocument();
  expect(screen.getByText('Published')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use as poster' }));
  expect(select).toHaveBeenCalledWith(image, 'poster');
});
it('a refresh failure keeps loaded items available and allows retry', async () => {
  get
    .mockResolvedValueOnce({ data: { data: { items: [image], nextCursor: null } } })
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValueOnce({ data: { data: { items: [video], nextCursor: null } } });
  render(<LandingUploadGallery refreshVersion={0} busy={false} onSelect={vi.fn()} />);
  await screen.findByRole('article', { name: 'Image first' });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh gallery' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('article', { name: 'Image first' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh gallery' }));
  await screen.findByRole('article', { name: 'Video second' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('ignores old in-flight results after a newer upload refresh', async () => {
  let resolveOld!: (value: unknown) => void;
  get
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      })
    )
    .mockResolvedValueOnce({ data: { data: { items: [video], nextCursor: null } } });
  const { rerender } = render(<LandingUploadGallery refreshVersion={0} busy={false} onSelect={vi.fn()} />);
  rerender(<LandingUploadGallery refreshVersion={1} busy={true} onSelect={vi.fn()} />);
  await screen.findByRole('article', { name: 'Video second' });
  resolveOld({ data: { data: { items: [image], nextCursor: null } } });
  await waitFor(() => expect(screen.queryByRole('article', { name: 'Image first' })).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Use as display' })).toBeDisabled();
});

it('shows a newly saved upload immediately while provider search indexing catches up', async () => {
  get.mockResolvedValue({ data: { data: { items: [], nextCursor: null } } });
  render(<LandingUploadGallery refreshVersion={1} knownUploads={[video]} busy={false} onSelect={vi.fn()} />);
  await screen.findByRole('article', { name: 'Video second' });
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.queryByText(/No saved uploads yet/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use as display' })).toBeEnabled();
});
