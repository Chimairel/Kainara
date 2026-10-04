'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import type { LandingGalleryItem, LandingGalleryPage } from '@/features/website-content/types';

export default function LandingUploadGallery({
  refreshVersion,
  knownUploads = [],
  busy,
  draftId,
  publishedId,
  onSelect,
}: {
  refreshVersion: number;
  knownUploads?: LandingGalleryItem[];
  busy: boolean;
  draftId?: string;
  publishedId?: string;
  onSelect: (item: LandingGalleryItem, slot: 'asset' | 'poster') => Promise<void>;
}) {
  const [items, setItems] = useState<LandingGalleryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void api
      .get('/admin/website-content/gallery', { signal: controller.signal })
      .then(({ data }) => {
        if (generation.current !== current) return;
        const page: LandingGalleryPage = data.data;
        if (!Array.isArray(page.items)) throw new Error('Invalid gallery response');
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((err) => {
        if (generation.current === current)
          setError(getApiErrorMessage(err, 'Could not load saved uploads. Try refreshing the gallery.'));
      })
      .finally(() => {
        if (generation.current === current) setLoading(false);
      });
    return () => {
      generation.current = current + 1;
      controller.abort();
    };
  }, [refreshVersion, reload]);

  async function loadMore() {
    if (loading || !nextCursor) return;
    const current = generation.current;
    setLoading(true);
    setError(null);
    try {
      const page: LandingGalleryPage = (
        await api.get('/admin/website-content/gallery', { params: { cursor: nextCursor } })
      ).data.data;
      if (generation.current !== current) return;
      if (!Array.isArray(page.items)) throw new Error('Invalid gallery response');
      setItems((previous) => [
        ...new Map([...previous, ...page.items].map((item) => [`${item.kind}:${item.publicId}`, item])).values(),
      ]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (generation.current === current)
        setError(getApiErrorMessage(err, 'Could not load more uploads. Please try again.'));
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }

  // Successful draft responses make new uploads reusable immediately, while the provider indexes them.
  const visibleItems = [
    ...new Map([...knownUploads, ...items].map((item) => [`${item.kind}:${item.publicId}`, item])).values(),
  ];
  return (
    <section
      aria-label="Saved uploads"
      className="space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Saved uploads</h2>
          <p className="mt-1 text-sm text-brand-muted">Reuse an image or video in your draft, then publish it.</p>
        </div>
        <Button variant="secondary" disabled={busy || loading} onClick={() => setReload((value) => value + 1)}>
          Refresh gallery
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-brand-muted">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading saved uploads…
        </p>
      )}
      {!loading && !error && visibleItems.length === 0 && (
        <p className="text-sm text-brand-muted">No saved uploads yet. Upload a file above to start your gallery.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((item) => {
          const preview = item.kind === 'video' ? item.posterUrl : item.url;
          const thumbnail = preview?.replace(`/${item.kind}/upload/`, `/${item.kind}/upload/c_limit,w_640,h_360/`);
          const label = `${item.kind === 'video' ? 'Video' : 'Image'} ${item.publicId.split('/').pop()?.slice(0, 8)}`;
          return (
            <article
              key={`${item.kind}:${item.publicId}`}
              aria-label={label}
              className="overflow-hidden rounded-xl border border-brand-border bg-brand-bg"
            >
              <div className="aspect-video overflow-hidden">
                {thumbnail && (
                  <Image
                    src={thumbnail}
                    alt={label}
                    width={640}
                    height={360}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <div className="space-y-3 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-brand-muted">
                  <span className="font-semibold text-brand-text">
                    {item.kind === 'video' ? `Video · ${item.duration ?? 0}s` : 'Image'}
                  </span>
                  <span>{(item.bytes / 1024 / 1024).toFixed(1)} MB</span>
                  {item.createdAt && (
                    <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time>
                  )}
                  {item.publicId === draftId && <span className="font-semibold text-brand-text">In draft</span>}
                  {item.publicId === publishedId && <span className="font-semibold text-brand-primary">Published</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => void onSelect(item, 'asset')}>
                    Use as display
                  </Button>
                  {item.kind === 'image' && (
                    <Button variant="secondary" disabled={busy} onClick={() => void onSelect(item, 'poster')}>
                      Use as poster
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {nextCursor && (
        <Button variant="secondary" disabled={busy || loading} onClick={() => void loadMore()}>
          Load more uploads
        </Button>
      )}
    </section>
  );
}
