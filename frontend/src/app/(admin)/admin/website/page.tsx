'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import LandingMediaDisplay from '@/components/landing/LandingMediaDisplay';
import { toLandingMedia, type WebsiteContent } from '@/features/website-content/types';

export default function WebsiteContentPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState<WebsiteContent | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [altText, setAltText] = useState('KAINARA platform preview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acceptContent = (next: WebsiteContent) => {
    setContent(next);
    setAltText(next.draft?.altText || next.published?.altText || 'KAINARA platform preview');
  };
  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      acceptContent((await api.get('/admin/website-content')).data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load website content.'));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function run(title: string, success: string, work: () => Promise<void>) {
    if (busy || !content) return;
    setBusy(true);
    const id = toast.loading(title);
    try {
      await work();
      toast.success(success, { id });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update website content. Please try again.'), { id });
    } finally {
      setBusy(false);
    }
  }
  async function saveDraft() {
    if (!content) return;
    if (!altText.trim() || altText.trim().length > 240) {
      toast.error('Enter a media description up to 240 characters.');
      return;
    }
    for (const candidate of [file, poster]) {
      if (!candidate) continue;
      const isVideo = candidate.type.startsWith('video/');
      if (
        !['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'].includes(candidate.type) ||
        candidate.size > (isVideo ? 20 : 5) * 1024 * 1024 ||
        (candidate === poster && isVideo)
      ) {
        toast.error('Use an image up to 5 MB or MP4/WebM up to 20 MB. The poster must be an image.');
        return;
      }
    }
    await run('Saving website draft…', 'Draft saved. Preview it before publishing.', async () => {
      let next = content;
      for (const [slot, candidate] of [
        ['asset', file],
        ['poster', poster],
      ] as const) {
        if (!candidate) continue;
        const body = new FormData();
        body.append('file', candidate);
        body.append('slot', slot);
        body.append('revision', String(next.revision));
        next = (await api.post('/admin/website-content/upload', body, { timeout: 120_000 })).data.data;
        setContent(next);
        if (slot === 'asset') {
          setFile(null);
          if (fileRef.current) fileRef.current.value = '';
        } else {
          setPoster(null);
          if (posterRef.current) posterRef.current.value = '';
        }
      }
      next = (await api.patch('/admin/website-content/draft', { revision: next.revision, altText: altText.trim() }))
        .data.data;
      acceptContent(next);
    });
  }
  const draft = content?.draft ?? content?.published ?? null;
  const savedPreview = toLandingMedia(draft);
  const preview =
    file && previewUrl
      ? {
          kind: file.type.startsWith('video/') ? ('video' as const) : ('image' as const),
          url: previewUrl,
          posterUrl: savedPreview?.posterUrl ?? null,
          altText,
        }
      : savedPreview;
  const dirty = Boolean(file || poster || altText !== (draft?.altText || 'KAINARA platform preview'));
  return (
    <div className="portal-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Website content</h1>
          <p className="mt-1 text-sm text-brand-muted">Change the landing-page image or promotional video.</p>
        </div>
        <Button variant="secondary" disabled={busy} onClick={() => void load()}>
          Reload content
        </Button>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-red-400 p-4 text-sm text-red-500">
          {error}
        </p>
      )}
      {!content && !error && <p role="status">Loading website content…</p>}
      {content && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-5">
            <h2 className="font-semibold">Edit draft</h2>
            <label className="block text-sm font-semibold">
              Image or video
              <input
                ref={fileRef}
                type="file"
                aria-label="Image or video"
                accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
                disabled={busy}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-sm"
              />
            </label>
            <p className="text-xs text-brand-muted">
              Images: up to 5 MB. MP4/WebM video: up to 20 MB and 30 seconds. Landscape media works best.
            </p>
            <label className="block text-sm font-semibold">
              Video poster image (optional)
              <input
                ref={posterRef}
                type="file"
                aria-label="Video poster image"
                accept="image/jpeg,image/png,image/webp,image/avif"
                disabled={busy}
                onChange={(event) => setPoster(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-sm"
              />
            </label>
            <label className="block text-sm font-semibold">
              Media description
              <input
                aria-label="Media description"
                value={altText}
                maxLength={240}
                disabled={busy}
                onChange={(event) => setAltText(event.target.value)}
                className="mt-2 w-full rounded-xl border border-brand-border bg-brand-bg p-3"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !dirty} onClick={() => void saveDraft()}>
                Save draft
              </Button>
              <Button
                disabled={busy || dirty || !content.draft?.asset}
                onClick={() =>
                  void run(
                    'Publishing website media…',
                    'Website media published. Visitors will see it within a minute.',
                    async () =>
                      acceptContent(
                        (await api.post('/admin/website-content/publish', { revision: content.revision })).data.data
                      )
                  )
                }
              >
                Publish
              </Button>
              <Button
                variant="secondary"
                disabled={busy || (!content.draft && !content.published)}
                onClick={() =>
                  void run('Restoring original image…', 'Original dashboard image restored.', async () => {
                    acceptContent(
                      (await api.post('/admin/website-content/reset', { revision: content.revision })).data.data
                    );
                    setFile(null);
                    setPoster(null);
                    if (fileRef.current) fileRef.current.value = '';
                    if (posterRef.current) posterRef.current.value = '';
                  })
                }
              >
                Restore original
              </Button>
            </div>
            <p className="text-xs text-brand-muted">
              Saving a draft does not change the public page. Videos start muted and visitors can pause or enable sound.
            </p>
          </section>
          <div className="space-y-5">
            <section>
              <h2 className="mb-2 font-semibold">Draft preview{file ? ' · Selected file' : ''}</h2>
              <div className="aspect-video overflow-hidden rounded-2xl border border-brand-border">
                <LandingMediaDisplay media={preview} />
              </div>
            </section>
            <section>
              <h2 className="mb-2 font-semibold">Currently published</h2>
              <div className="aspect-video overflow-hidden rounded-2xl border border-brand-border">
                <LandingMediaDisplay media={toLandingMedia(content.published)} />
              </div>
              <p className="mt-2 text-xs text-brand-muted">
                {content.publishedAt
                  ? `Published ${new Date(content.publishedAt).toLocaleString()}`
                  : 'Using the original dashboard image.'}
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
