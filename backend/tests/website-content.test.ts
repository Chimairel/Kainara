import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, type WebsiteContent } from '@prisma/client';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import prisma from '../src/lib/prisma';
import { WebsiteContentService as Content } from '../src/services/website-content.service';
import { landingConfigSchema, landingPosterUrl, validateLandingUpload } from '../src/domain/landing-media.policy';

const imageResult = {
  public_id: 'nutrimind/landing/image-1',
  secure_url: 'https://res.cloudinary.com/test/image/upload/v1/nutrimind/landing/image-1.jpg',
  resource_type: 'image',
  format: 'jpg',
  width: 1280,
  height: 720,
  bytes: 1000,
} as UploadApiResponse;
const videoResult = {
  ...imageResult,
  public_id: 'nutrimind/landing/video-1',
  secure_url: 'https://res.cloudinary.com/test/video/upload/v1/nutrimind/landing/video-1.mp4',
  resource_type: 'video',
  format: 'mp4',
  duration: 10,
} as UploadApiResponse;
const image = validateLandingUpload(imageResult, 'image');
const config = { asset: image, poster: null, altText: 'Platform preview' };

test('decoded upload validation excludes disguised media, audio-only files, oversized files and long videos', () => {
  assert.equal(validateLandingUpload(videoResult, 'video').duration, 10);
  for (const result of [
    { ...videoResult, duration: 31 },
    { ...videoResult, height: 0 },
    { ...videoResult, duration: undefined },
    { ...videoResult, format: 'mp3' },
    { ...videoResult, bytes: 21 * 1024 * 1024 },
    { ...videoResult, secure_url: 'https://evil.invalid/video.mp4' },
  ])
    assert.throws(() => validateLandingUpload(result as UploadApiResponse, 'video'));
  assert.throws(() => validateLandingUpload({ ...imageResult, bytes: 6 * 1024 * 1024 }, 'image'));
  assert.throws(() => validateLandingUpload(videoResult, 'image'));
  assert.equal(
    landingConfigSchema.safeParse({ ...config, poster: validateLandingUpload(videoResult, 'video') }).success,
    false
  );
});

test('draft/upload/publish/reset are atomic, protect published media, and reject stale admin revisions', async (context) => {
  process.env.CLOUDINARY_URL ||= 'cloudinary://test-key:test-secret@test';
  let row: WebsiteContent | null = null;
  let providerResult = imageResult;
  let auditFails = false;
  const actions: string[] = [];
  const removed: string[] = [];
  const originalRead = prisma.websiteContent.findUnique;
  prisma.websiteContent.findUnique = (async () => row) as typeof originalRead;
  context.after(() => {
    prisma.websiteContent.findUnique = originalRead;
  });
  const tx = {
    $executeRaw: async () => 0,
    websiteContent: {
      upsert: async () =>
        (row ??= {
          id: 'landing-hero',
          revision: 0,
          draft: null,
          published: null,
          publishedAt: null,
          updatedAt: new Date(),
        }),
      update: async ({ data }: { data: Prisma.WebsiteContentUpdateInput }) => {
        assert.ok(row);
        for (const key of ['draft', 'published', 'publishedAt'] as const) {
          if (key in data) Object.assign(row, { [key]: data[key] === Prisma.DbNull ? null : data[key] });
        }
        row.revision++;
        return row;
      },
    },
    auditEvent: {
      create: async ({ data }: { data: { action: string } }) => {
        if (auditFails) throw new Error('Synthetic audit failure');
        actions.push(data.action);
      },
    },
  } as unknown as Prisma.TransactionClient;
  context.mock.method(prisma, '$transaction', async (work: (client: Prisma.TransactionClient) => Promise<unknown>) => {
    const before = row ? structuredClone(row) : null;
    try {
      return await work(tx);
    } catch (error) {
      row = before;
      throw error;
    }
  });
  context.mock.method(
    cloudinary.uploader,
    'upload_stream',
    (_options: unknown, callback: (error: null, result: UploadApiResponse) => void) => ({
      end: () => callback(null, providerResult),
    })
  );
  context.mock.method(cloudinary.uploader, 'destroy', async (id: string) => {
    removed.push(id);
    return { result: 'ok' };
  });
  const file = { mimetype: 'image/jpeg', size: 1000, buffer: Buffer.from('synthetic') };
  assert.equal(await Content.getPublic(), null);
  const uploaded = await Content.upload('admin-fixture', 0, 'asset', file);
  assert.equal(uploaded.revision, 1);
  assert.equal(await Content.getPublic(), null);
  await Content.saveText('admin-fixture', 1, 'New public preview');
  await Content.publish('admin-fixture', 2);
  assert.deepEqual(await Content.getPublic(), {
    kind: 'image',
    url: image.url,
    posterUrl: null,
    altText: 'New public preview',
  });
  providerResult = videoResult;
  const video = { ...file, mimetype: 'video/mp4' };
  await Content.upload('admin-fixture', 3, 'asset', video);
  assert.equal((await Content.getPublic())?.kind, 'image');
  await assert.rejects(() => Content.publish('admin-fixture', 3), /another session/);
  await Content.publish('admin-fixture', 4);
  assert.equal((await Content.getPublic())?.kind, 'video');
  assert.equal(
    (await Content.getPublic())?.posterUrl,
    'https://res.cloudinary.com/test/video/upload/so_1/v1/nutrimind/landing/video-1.jpg'
  );
  assert.equal((await Content.getAdmin()).draft?.posterUrl, (await Content.getPublic())?.posterUrl);
  await assert.rejects(() => Content.upload('admin-fixture', 4, 'asset', video), /another session/);
  assert.equal(removed.length, 1);
  auditFails = true;
  providerResult = imageResult;
  await assert.rejects(() => Content.upload('admin-fixture', 5, 'asset', file), /Synthetic audit failure/);
  assert.equal((await Content.getPublic())?.kind, 'video');
  assert.equal(removed.length, 2);
  auditFails = false;
  await Content.reset('admin-fixture', 5);
  assert.equal(await Content.getPublic(), null);
  assert.equal((await Content.getAdmin()).draft, null);
  await assert.rejects(() => Content.publish('admin-fixture', 6), /Upload an image or video/);
  assert.equal((await Content.getAdmin()).revision, 6);
  assert.ok(actions.includes('WEBSITE_MEDIA_PUBLISHED'));
  assert.equal(actions.at(-1), 'WEBSITE_MEDIA_RESET');
});

test('video posters use one-second JPG frames, preserve the upload version and allow a custom override', () => {
  const video = validateLandingUpload(videoResult, 'video');
  const videoConfig = { ...config, asset: video };
  const expected = 'https://res.cloudinary.com/test/video/upload/so_1/v1/nutrimind/landing/video-1.jpg';
  assert.equal(landingPosterUrl(videoConfig), expected);
  assert.equal(
    landingPosterUrl({ ...videoConfig, asset: { ...video, url: video.url.replace('.mp4', '.webm') } }),
    expected
  );
  assert.equal(landingPosterUrl({ ...videoConfig, poster: image }), image.url);
  assert.equal(
    landingPosterUrl({ ...videoConfig, asset: { ...video, duration: 0.5 } }),
    expected.replace('so_1', 'so_0')
  );
  assert.equal(landingPosterUrl(config), null);
  assert.equal(landingPosterUrl(null), null);
});
