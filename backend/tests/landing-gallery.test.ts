import assert from 'node:assert/strict';
import test from 'node:test';
import { v2 as cloudinary } from 'cloudinary';
import { getLandingGallery } from '../src/services/landing-gallery.service';

const image = {
  public_id: 'nutrimind/landing/saved-image',
  resource_type: 'image',
  type: 'upload',
  status: 'active',
  access_mode: 'public',
  secure_url: 'https://res.cloudinary.com/test/image/upload/v1/nutrimind/landing/saved-image.jpg',
  format: 'jpg',
  width: 1280,
  height: 720,
  bytes: 1000,
  created_at: '2026-10-04T03:00:00Z',
};
const video = {
  ...image,
  public_id: 'nutrimind/landing/saved-video',
  resource_type: 'video',
  secure_url: image.secure_url.replace('/image/', '/video/').replace('saved-image.jpg', 'saved-video.mp4'),
  format: 'mp4',
  duration: 10,
};

test('gallery uses a bounded website-only query and continues the same scope without exposing provider metadata', async (context) => {
  process.env.CLOUDINARY_URL ||= 'cloudinary://test-key:test-secret@test';
  const cursors: string[] = [];
  const builder = {
    sort_by: (field: string, direction: string) => {
      assert.equal(field, 'created_at');
      assert.equal(direction, 'desc');
      return builder;
    },
    max_results: (count: number) => {
      assert.equal(count, 24);
      return builder;
    },
    next_cursor: (cursor: string) => {
      cursors.push(cursor);
      return builder;
    },
    execute: async () => ({
      resources: [
        video,
        image,
        { ...image, public_id: 'nutrimind/meals/private' },
        { ...video, duration: 31 },
        { ...video, height: 0 },
        { ...image, type: 'private' },
        { ...image, access_mode: 'authenticated' },
        { ...image, status: 'not_found' },
      ],
      next_cursor: cursors.length ? undefined : 'second-page',
    }),
  };
  context.mock.method(cloudinary.search, 'expression', (expression: string) => {
    assert.equal(
      expression,
      'public_id:nutrimind/landing/* AND type:upload AND (resource_type:image OR resource_type:video)'
    );
    return builder;
  });
  const page = await getLandingGallery();
  assert.equal(page.items.length, 2);
  assert.equal(page.nextCursor, 'second-page');
  assert.match(page.items[0].posterUrl!, /video\/upload\/so_1\/v1/);
  assert.equal(page.items[1].posterUrl, null);
  assert.equal('access_mode' in page.items[0], false);
  assert.equal('created_by' in page.items[0], false);
  assert.equal((await getLandingGallery(page.nextCursor!)).nextCursor, null);
  assert.deepEqual(cursors, ['second-page']);
});

test('invalid cursors fail before calling the provider; outages remain failures rather than empty galleries', async (context) => {
  context.mock.method(cloudinary.search, 'expression', () => {
    throw new Error('Synthetic provider unavailable');
  });
  for (const cursor of ['', 'a'.repeat(2049), 'bad cursor', '{"expression":"other"}'])
    await assert.rejects(() => getLandingGallery(cursor), /Reload the upload gallery/);
  await assert.rejects(() => getLandingGallery(), /Synthetic provider unavailable/);
});
